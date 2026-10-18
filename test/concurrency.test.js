import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import {
  configureGenerationQueue,
  scheduleGeneration,
  getGenerationQueueSnapshot,
  GenerationQueuePriority,
  VideoJobs,
} from "../src/index.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function snapshot(key) { return getGenerationQueueSnapshot()[key]; }

test("concurrency bounds unresolved executions and a completed slot starts only one successor", async () => {
  const key = randomUUID();
  const queue = configureGenerationQueue(key, { limitPerMinute: 100, maxConcurrent: 2 });
  const gates = Array.from({ length: 5 }, deferred);
  const started = [];
  let active = 0, peak = 0;
  const operations = gates.map((gate, index) => scheduleGeneration(key, { execute: async () => {
    started.push(index);
    peak = Math.max(peak, ++active);
    await gate.promise;
    active -= 1;
    return index;
  } }));
  await setImmediate();
  assert.deepEqual(started, [0, 1]);
  assert.equal(snapshot(key).active, 2);
  assert.equal(snapshot(key).pending, 3);
  assert.equal(snapshot(key).maxConcurrent, 2);
  assert.equal(queue.timer, null, "concurrency-only waiting does not create a timer");

  gates[0].resolve();
  assert.equal(await operations[0], 0);
  await setImmediate();
  assert.deepEqual(started, [0, 1, 2]);
  assert.equal(snapshot(key).active, 2);
  for (const gate of gates) gate.resolve();
  assert.deepEqual(await Promise.all(operations), [0, 1, 2, 3, 4]);
  assert.equal(peak, 2);
  assert.equal(snapshot(key).active, 0);
  assert.equal(snapshot(key).pending, 0);
});

test("rejections and synchronous throws release concurrency slots", async () => {
  const key = randomUUID();
  configureGenerationQueue(key, { limitPerMinute: 100, maxConcurrent: 1 });
  const first = deferred();
  const starts = [];
  const failing = scheduleGeneration(key, { execute: () => { starts.push("first"); return first.promise; } });
  const firstFailure = assert.rejects(failing, /simulated failure/);
  const throwing = scheduleGeneration(key, { execute: () => { starts.push("second"); throw new Error("simulated throw"); } });
  const secondFailure = assert.rejects(throwing, /simulated throw/);
  const last = scheduleGeneration(key, { execute: () => { starts.push("third"); return "ok"; } });
  await setImmediate();
  assert.deepEqual(starts, ["first"]);
  first.reject(new Error("simulated failure"));
  await Promise.all([firstFailure, secondFailure]);
  assert.equal(await last, "ok");
  assert.deepEqual(starts, ["first", "second", "third"]);
  assert.equal(snapshot(key).active, 0);
});

test("cancelling a concurrency-blocked job removes it without stalling later work", async () => {
  const key = randomUUID();
  configureGenerationQueue(key, { limitPerMinute: 100, maxConcurrent: 1 });
  const first = deferred();
  const starts = [];
  const running = scheduleGeneration(key, { execute: () => { starts.push("first"); return first.promise; } });
  const controller = new AbortController();
  const cancelled = scheduleGeneration(key, { signal: controller.signal, execute: () => starts.push("cancelled") });
  const cancellation = assert.rejects(cancelled, /cancelled fixture/);
  const later = scheduleGeneration(key, { execute: () => { starts.push("later"); return "done"; } });
  controller.abort(new Error("cancelled fixture"));
  await cancellation;
  assert.equal(snapshot(key).pending, 1);
  first.resolve();
  await running;
  assert.equal(await later, "done");
  assert.deepEqual(starts, ["first", "later"]);
  assert.equal(snapshot(key).active, 0);
});

test("raising and lowering a cap drains safely and preserves existing work", async () => {
  const key = randomUUID();
  configureGenerationQueue(key, { limitPerMinute: 100, maxConcurrent: 2 });
  const gates = Array.from({ length: 4 }, deferred);
  const starts = [];
  const operations = gates.map((gate, index) => scheduleGeneration(key, { execute: () => {
    starts.push(index); return gate.promise;
  } }));
  await setImmediate();
  configureGenerationQueue(key, { limitPerMinute: 100, maxConcurrent: 1 });
  assert.equal(snapshot(key).active, 2, "lowering never aborts running adapters");
  gates[0].resolve();
  await operations[0];
  await setImmediate();
  assert.deepEqual(starts, [0, 1]);
  gates[1].resolve();
  await operations[1];
  await setImmediate();
  assert.deepEqual(starts, [0, 1, 2]);
  configureGenerationQueue(key, { limitPerMinute: 100, maxConcurrent: 2 });
  await setImmediate();
  assert.deepEqual(starts, [0, 1, 2, 3]);
  configureGenerationQueue(key, { limitPerMinute: 100 });
  assert.equal(snapshot(key).maxConcurrent, 2, "a rate-only update retains the cap");
  for (const gate of gates) gate.resolve();
  await Promise.all(operations);
});

test("rate and concurrency updates are atomic", async () => {
  const key = randomUUID();
  const queue = configureGenerationQueue(key, { limitPerMinute: 1, maxConcurrent: 2 });
  const first = deferred();
  const starts = [];
  const running = scheduleGeneration(key, { execute: () => { starts.push("running"); return first.promise; } });
  const next = scheduleGeneration(key, { execute: () => { starts.push("next"); return "done"; } });
  await setImmediate();
  assert.notEqual(queue.timer, null, "rate-blocked work with a free slot needs a timer");
  configureGenerationQueue(key, { limitPerMinute: 100, maxConcurrent: 1 });
  await setImmediate();
  assert.deepEqual(starts, ["running"]);
  assert.equal(queue.timer, null, "a cap update cancels a now-unnecessary rate timer");
  first.resolve();
  await running;
  assert.equal(await next, "done");
});

test("priority respects both the rolling rate window and running slots", async (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const key = randomUUID();
  const queue = configureGenerationQueue(key, { limitPerMinute: 2, maxConcurrent: 1 });
  const first = deferred(), high = deferred();
  const starts = [];
  const a = scheduleGeneration(key, { execute: () => { starts.push("first"); return first.promise; } });
  const low = scheduleGeneration(key, { execute: () => { starts.push("low"); return "low"; } });
  const urgent = scheduleGeneration(key, { priority: GenerationQueuePriority.HIGH, execute: () => { starts.push("high"); return high.promise; } });
  await setImmediate();
  first.resolve();
  await a;
  await setImmediate();
  assert.deepEqual(starts, ["first", "high"]);
  assert.equal(queue.timer, null, "completion will wake work while every slot is busy");
  high.resolve("high");
  assert.equal(await urgent, "high");
  assert.notEqual(queue.timer, null, "the exhausted rate budget still blocks the next start");
  context.mock.timers.tick(59999);
  await setImmediate();
  assert.deepEqual(starts, ["first", "high"]);
  context.mock.timers.tick(1);
  assert.equal(await low, "low");
  assert.deepEqual(starts, ["first", "high", "low"]);
  assert.equal(queue.timer, null);
  assert.equal(snapshot(key).active, 0);
});

test("a cap-blocked queue needs no timer even after the rate window expires", async (context) => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 200000 });
  const key = randomUUID();
  const queue = configureGenerationQueue(key, { limitPerMinute: 1, maxConcurrent: 1 });
  const gate = deferred();
  const running = scheduleGeneration(key, { execute: () => gate.promise });
  const next = scheduleGeneration(key, { execute: () => "later" });
  await setImmediate();
  assert.equal(queue.timer, null);
  context.mock.timers.tick(120000);
  assert.equal(queue.timer, null);
  assert.equal(snapshot(key).pending, 1);
  gate.resolve();
  await running;
  assert.equal(await next, "later");
  assert.equal(queue.timer, null);
});

test("invalid caps fail before creating or changing a queue", () => {
  const key = randomUUID();
  configureGenerationQueue(key, { limitPerMinute: 10, maxConcurrent: 2, label: "original" });
  for (const maxConcurrent of [0, -1, 1.5, NaN, Infinity, null, "2", false, Number.MAX_SAFE_INTEGER + 1]) {
    const fresh = randomUUID();
    assert.throws(() => configureGenerationQueue(fresh, { maxConcurrent }), /maxConcurrent must be a positive integer/);
    assert.equal(snapshot(fresh), undefined);
    assert.throws(() => configureGenerationQueue(key, { maxConcurrent, limitPerMinute: 100, label: "changed" }), /maxConcurrent/);
    assert.equal(snapshot(key).label, "original");
    assert.equal(snapshot(key).limitPerMinute, 10);
    assert.equal(snapshot(key).maxConcurrent, 2);
    assert.throws(() => new VideoJobs().register("local", async () => ({}), { maxConcurrent }), /maxConcurrent/);
  }
});

test("omitting the option preserves unlimited concurrency and serializable snapshots", async () => {
  const key = randomUUID();
  configureGenerationQueue(key, { limitPerMinute: 10 });
  const gates = Array.from({ length: 4 }, deferred);
  const operations = gates.map(gate => scheduleGeneration(key, { execute: () => gate.promise }));
  await setImmediate();
  assert.equal(snapshot(key).active, 4);
  assert.equal(snapshot(key).maxConcurrent, null);
  assert.equal(JSON.parse(JSON.stringify(snapshot(key))).maxConcurrent, null);
  for (const gate of gates) gate.resolve();
  await Promise.all(operations);
});

test("VideoJobs registration passes the provider concurrency limit through", async () => {
  const gate = deferred();
  let calls = 0;
  const jobs = new VideoJobs().register("local", async () => {
    calls += 1;
    if (calls === 1) await gate.promise;
    return { outputId: `synthetic-${calls}` };
  }, { startsPerMinute: 100, maxConcurrent: 1 });
  const first = jobs.submit({ provider: "local", prompt: "First synthetic fixture" });
  const second = jobs.submit({ provider: "local", prompt: "Second synthetic fixture" });
  await setImmediate();
  assert.equal(calls, 1);
  assert.equal(jobs.get(first.id).status, "running");
  assert.equal(jobs.get(second.id).status, "queued");
  gate.resolve();
  await Promise.all([first.done, second.done]);
  assert.equal(calls, 2);
  assert.equal(jobs.get(second.id).status, "completed");
});
