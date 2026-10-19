import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setImmediate } from "node:timers/promises";
import queueApi from "../src/generationQueue.js";
import {
  configureGenerationQueue,
  scheduleGeneration,
  shutdownGenerationQueue,
  getGenerationQueueSnapshot,
  GenerationQueuePriority,
  VideoJobs,
} from "../src/index.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function closedError(error) {
  assert.equal(error instanceof Error, true);
  assert.equal(error.code, "QUEUE_SHUTDOWN");
  assert.equal(Object.hasOwn(error, "cause"), false);
  return true;
}

function snapshot(key) { return getGenerationQueueSnapshot()[key]; }

test("shutdown is available on named and default APIs and validates names without creating queues", () => {
  assert.equal(queueApi.shutdownGenerationQueue, shutdownGenerationQueue);
  const before = Object.keys(getGenerationQueueSnapshot());
  for (const name of [undefined, null, "", 0, false, {}, []]) {
    assert.throws(() => shutdownGenerationQueue(name), TypeError);
  }
  const unknown = randomUUID();
  assert.equal(shutdownGenerationQueue(unknown), false);
  assert.deepEqual(Object.keys(getGenerationQueueSnapshot()), before);
  configureGenerationQueue(unknown, { limitPerMinute: 10 });
  assert.equal(shutdownGenerationQueue(unknown), true);
  assert.equal(shutdownGenerationQueue(unknown), false);
});

test("shutdown cancels both pending priorities while preserving a running result", async () => {
  const key = randomUUID();
  const queue = configureGenerationQueue(key, { limitPerMinute: 10, maxConcurrent: 1 });
  const gate = deferred();
  const starts = [];
  const running = scheduleGeneration(key, { execute: () => { starts.push("running"); return gate.promise; } });
  const low = scheduleGeneration(key, { execute: () => starts.push("low") });
  const high = scheduleGeneration(key, { priority: GenerationQueuePriority.HIGH, execute: () => starts.push("high") });
  const rejected = [assert.rejects(low, closedError), assert.rejects(high, closedError)];
  await setImmediate();
  assert.deepEqual(starts, ["running"]);
  assert.equal(snapshot(key).closed, false);
  assert.equal(shutdownGenerationQueue(key), true);
  assert.equal(queue.timer, null);
  assert.equal(snapshot(key).closed, true);
  assert.equal(snapshot(key).pending, 0);
  assert.equal(snapshot(key).active, 1);
  assert.equal(snapshot(key).recentStarts, 1);
  await Promise.all(rejected);
  gate.resolve("original result");
  assert.equal(await running, "original result");
  assert.equal(snapshot(key).active, 0);
  assert.equal(queue.timer, null);
  assert.deepEqual(starts, ["running"]);
});

test("shutdown preserves a slot reserved before its execution microtask", async () => {
  const key = randomUUID();
  configureGenerationQueue(key, { limitPerMinute: 10, maxConcurrent: 1 });
  let calls = 0;
  const running = scheduleGeneration(key, { execute: () => ++calls });
  const pending = scheduleGeneration(key, { execute: () => ++calls });
  const rejection = assert.rejects(pending, closedError);
  assert.equal(calls, 0);
  assert.equal(shutdownGenerationQueue(key), true);
  assert.equal(await running, 1);
  await rejection;
  assert.equal(calls, 1);
});

test("running rejection retains its original outcome after closure", async () => {
  const key = randomUUID();
  configureGenerationQueue(key, { limitPerMinute: 10, maxConcurrent: 1 });
  const gate = deferred();
  const failure = new Error("synthetic adapter failure");
  const running = scheduleGeneration(key, { execute: () => gate.promise });
  const rejection = assert.rejects(running, error => error === failure);
  await setImmediate();
  shutdownGenerationQueue(key);
  gate.reject(failure);
  await rejection;
  assert.equal(snapshot(key).active, 0);
  assert.equal(snapshot(key).closed, true);
});

test("closure removes pending abort listeners and does not inspect new enqueue signals", async () => {
  const key = randomUUID();
  configureGenerationQueue(key, { limitPerMinute: 10, maxConcurrent: 1 });
  const gate = deferred();
  const running = scheduleGeneration(key, { execute: () => gate.promise });
  const controller = new AbortController();
  const signal = controller.signal;
  const add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal);
  let adds = 0, removes = 0;
  signal.addEventListener = (...args) => { adds += 1; return add(...args); };
  signal.removeEventListener = (...args) => { removes += 1; return remove(...args); };
  const pending = scheduleGeneration(key, { signal, execute: () => "must not run" });
  const rejection = assert.rejects(pending, closedError);
  assert.equal(adds, 1);
  shutdownGenerationQueue(key);
  assert.equal(removes, 1);
  controller.abort(new Error("SYNTHETIC_PRIVATE_ABORT_REASON"));
  await rejection;
  await assert.rejects(scheduleGeneration(key, {
    execute: () => "must not run",
    signal: { get aborted() { throw new Error("closed queue must not inspect signal"); } },
  }), closedError);
  assert.equal(snapshot(key).recentStarts, 1);
  assert.equal(snapshot(key).pending, 0);
  gate.resolve();
  await running;
});

test("closure clears a referenced rate timer and mock time cannot start cancelled work", async context => {
  context.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const key = randomUUID();
  const queue = configureGenerationQueue(key, { limitPerMinute: 1 });
  await scheduleGeneration(key, { execute: () => "first" });
  let calls = 0;
  const pending = scheduleGeneration(key, { execute: () => ++calls });
  const rejection = assert.rejects(pending, closedError);
  assert.notEqual(queue.timer, null);
  shutdownGenerationQueue(key);
  assert.equal(queue.timer, null);
  context.mock.timers.tick(120000);
  await rejection;
  assert.equal(calls, 0);
  assert.equal(queue.timer, null);
  assert.equal(snapshot(key).recentStarts, 1, "shutdown retains start accounting");
});

test("closed queues cannot be reconfigured or consume more starts", async () => {
  const key = "synthetic-private-id-" + randomUUID();
  configureGenerationQueue(key, { limitPerMinute: 10, maxConcurrent: 2, label: "original" });
  shutdownGenerationQueue(key);
  const before = snapshot(key);
  assert.throws(() => configureGenerationQueue(key, { label: "changed", limitPerMinute: 100, maxConcurrent: 4 }), closedError);
  await assert.rejects(scheduleGeneration(key, { execute: () => "must not run" }), error => {
    closedError(error);
    assert.equal(error.message.includes(key), false);
    return true;
  });
  assert.deepEqual(snapshot(key), before);
});

test("all special provider names remain own JSON properties on an ordinary snapshot", async () => {
  const names = ["__proto__", "constructor", "toString", " "];
  for (const name of names) {
    configureGenerationQueue(name, { limitPerMinute: 10 });
    assert.equal(await scheduleGeneration(name, { execute: () => name }), name);
  }
  shutdownGenerationQueue("__proto__");
  const value = getGenerationQueueSnapshot();
  assert.equal(Object.getPrototypeOf(value), Object.prototype);
  const serialized = JSON.parse(JSON.stringify(value));
  for (const name of names) {
    assert.equal(Object.hasOwn(value, name), true);
    assert.equal(Object.getOwnPropertyDescriptor(value, name).enumerable, true);
    assert.equal(Object.hasOwn(serialized, name), true);
    assert.equal(serialized[name].closed, name === "__proto__");
  }
  assert.equal(Object.hasOwn(Object.prototype, "closed"), false);
});

test("VideoJobs shutdown isolates providers and workspaces, settles pending records, and prevents new records", async () => {
  const gate = deferred();
  const jobs = new VideoJobs().register("local", async () => { await gate.promise; return { outputId: "synthetic" }; }, { maxConcurrent: 1 });
  jobs.register("other", async () => ({ outputId: "other synthetic" }));
  const workspace = new VideoJobs().register("local", async () => ({ outputId: "separate synthetic" }));
  const running = jobs.submit({ provider: "local", prompt: "running synthetic" });
  const pending = jobs.submit({ provider: "local", prompt: "pending synthetic" });
  const rejection = assert.rejects(pending.done, { message: "Queued operation cancelled" });
  await setImmediate();
  assert.equal(jobs.shutdown("local"), true);
  assert.equal(jobs.shutdown("local"), false);
  assert.equal(jobs.shutdown("unknown"), false);
  assert.throws(() => jobs.submit({ provider: "local", prompt: "rejected synthetic" }), closedError);
  assert.equal(jobs.list().length, 2);
  await rejection;
  assert.equal(jobs.get(pending.id).status, "cancelled");
  assert.equal(jobs.get(running.id).status, "running");
  await jobs.submit({ provider: "other", prompt: "unaffected synthetic" }).done;
  await workspace.submit({ provider: "local", prompt: "unaffected synthetic" }).done;
  gate.resolve();
  assert.equal((await running.done).status, "completed");
  assert.equal(jobs.forget(pending.id), true);
  assert.throws(() => jobs.register("local", async () => ({})), /already registered/);
});

test("VideoJobs validates shutdown names and recognizes externally closed raw queues before capacity checks", async () => {
  const jobs = new VideoJobs({ maxJobs: 1 });
  for (const name of [undefined, null, "", 1, "bad name", "A", "x".repeat(41)]) {
    assert.throws(() => jobs.shutdown(name), TypeError);
  }
  const before = new Set(Object.keys(getGenerationQueueSnapshot()));
  jobs.register("local", async () => ({}));
  const key = Object.keys(getGenerationQueueSnapshot()).find(name => !before.has(name));
  assert.ok(key);
  await jobs.submit({ provider: "local", prompt: "capacity fixture" }).done;
  assert.equal(shutdownGenerationQueue(key), true);
  assert.throws(() => jobs.submit({ provider: "local", prompt: "closed before capacity" }), closedError);
  assert.equal(jobs.list().length, 1);
  assert.equal(jobs.shutdown("local"), false);
});

test("shutdown lets a standalone process exit after cancelling rate-blocked work", async () => {
  const entry = new URL("../src/index.js", import.meta.url).href;
  const script = `import {configureGenerationQueue,scheduleGeneration,shutdownGenerationQueue} from ${JSON.stringify(entry)};
configureGenerationQueue('synthetic',{limitPerMinute:1});
await scheduleGeneration('synthetic',{execute:()=>null});
const pending=scheduleGeneration('synthetic',{execute:()=>{throw new Error('must not run');}});
shutdownGenerationQueue('synthetic');
try {await pending;} catch(error) {if(error.code!=='QUEUE_SHUTDOWN') throw error;}
console.log('CLOSED');`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "", diagnostics = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { diagnostics += chunk; });
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill("SIGTERM"); resolve("timeout"); }, 1500);
    child.once("exit", code => { clearTimeout(timer); resolve(code); });
    child.once("error", error => { clearTimeout(timer); reject(error); });
  });
  assert.equal(result, 0, diagnostics);
  assert.match(output, /CLOSED/);
});
