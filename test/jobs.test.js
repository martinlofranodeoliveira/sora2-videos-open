import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { VideoJobs, configureGenerationQueue, scheduleGeneration, getGenerationQueueSnapshot } from "../src/index.js";

test("completed jobs preserve a validated immutable spec and return copies", async () => {
  let received;
  const jobs = new VideoJobs().register("local", async (spec) => { received = spec; return { outputId: "synthetic" }; });
  const operation = jobs.submit({ provider: "local", prompt: "  A forest  " });
  assert.equal(jobs.get(operation.id).status, "queued");
  const result = await operation.done;
  assert.equal(result.status, "completed");
  assert.equal(received.prompt, "A forest");
  assert.equal(Object.isFrozen(received), true);
  result.result.outputId = "changed";
  assert.equal(jobs.get(operation.id).result.outputId, "synthetic");
  assert.equal(jobs.list().length, 1);
});

test("provider errors never disclose their internal message", async () => {
  const jobs = new VideoJobs().register("local", async () => { throw new Error("PRIVATE_PROVIDER_DIAGNOSTIC"); });
  const operation = jobs.submit({ provider: "local", prompt: "A forest" });
  await assert.rejects(operation.done, { message: "Provider operation failed" });
  assert.equal(jobs.get(operation.id).status, "failed");
  assert.equal(JSON.stringify(jobs.list()).includes("PRIVATE_PROVIDER_DIAGNOSTIC"), false);
});

test("nonserializable and oversized provider results fail", async () => {
  for (const result of [1n, { large: "x".repeat(66000) }]) {
    const jobs = new VideoJobs().register("local", async () => result);
    const operation = jobs.submit({ provider: "local", prompt: "A forest" });
    await assert.rejects(operation.done);
    assert.equal(jobs.get(operation.id).status, "failed");
  }
});

test("invalid requests never create jobs", () => {
  const jobs = new VideoJobs().register("local", async () => ({}));
  for (const options of [{ provider: "missing", prompt: "Hello" }, { provider: "local", prompt: "" }, { provider: "local", prompt: "x".repeat(10001) }, { provider: "local", prompt: "Hello", seconds: 0 }, { provider: "local", prompt: "Hello", seconds: 1.5 }, { provider: "local", prompt: "Hello", size: "9000x720" }, { provider: "local", prompt: "Hello", size: "1x2" }]) {
    assert.throws(() => jobs.submit(options));
  }
  assert.equal(jobs.list().length, 0);
});

test("registration and capacity are bounded", async () => {
  assert.throws(() => new VideoJobs({ maxJobs: 0 }));
  const jobs = new VideoJobs({ maxJobs: 1 }).register("local", async () => ({}));
  assert.throws(() => jobs.register("local", async () => ({})));
  assert.throws(() => jobs.register("bad name", async () => ({})));
  assert.throws(() => jobs.register("other", async () => ({}), { startsPerMinute: 0.5 }));
  const first = jobs.submit({ provider: "local", prompt: "Hello" });
  assert.throws(() => jobs.forget(first.id));
  assert.throws(() => jobs.submit({ provider: "local", prompt: "Hello" }));
  await first.done;
  assert.equal(jobs.forget(first.id), true);
  assert.equal(jobs.get(first.id), undefined);
});

test("aborted queued work never calls its provider", async () => {
  let calls = 0;
  const jobs = new VideoJobs().register("local", async () => { calls += 1; return {}; }, { startsPerMinute: 1 });
  await jobs.submit({ provider: "local", prompt: "First" }).done;
  const controller = new AbortController();
  const second = jobs.submit({ provider: "local", prompt: "Second" }, { signal: controller.signal });
  controller.abort(new Error("CANCEL_REASON_PRIVATE"));
  await assert.rejects(second.done, { message: "Queued operation cancelled" });
  assert.equal(calls, 1);
  assert.equal(jobs.get(second.id).status, "cancelled");
});

test("preaborted work remains cancelled", async () => {
  let calls = 0;
  const jobs = new VideoJobs().register("local", async () => { calls += 1; return {}; });
  const controller = new AbortController(); controller.abort();
  const operation = jobs.submit({ provider: "local", prompt: "Hello" }, { signal: controller.signal });
  await assert.rejects(operation.done);
  assert.equal(calls, 0);
  assert.equal(jobs.get(operation.id).status, "cancelled");
});

test("different workspaces isolate their rate queues", async () => {
  const a = new VideoJobs().register("local", async () => ({}), { startsPerMinute: 1 });
  const b = new VideoJobs().register("local", async () => ({}), { startsPerMinute: 1 });
  await Promise.all([a.submit({ provider: "local", prompt: "A" }).done, b.submit({ provider: "local", prompt: "B" }).done]);
  assert.equal(a.list()[0].status, "completed"); assert.equal(b.list()[0].status, "completed");
});

test("positive fractional raw rate remains at least one", async () => {
  const key = randomUUID();
  configureGenerationQueue(key, { limitPerMinute: 0.5 });
  assert.equal(getGenerationQueueSnapshot()[key].limitPerMinute, 1);
  assert.equal(await scheduleGeneration(key, { execute: () => "done" }), "done");
});

test("rate-limited pending work keeps a standalone process alive", async () => {
  const entry = new URL('../src/index.js', import.meta.url).href;
  const script = `import { VideoJobs } from ${JSON.stringify(entry)}; const jobs=new VideoJobs().register('local',async()=>({}),{startsPerMinute:1}); await jobs.submit({provider:'local',prompt:'first'}).done; console.log('FIRST_COMPLETED'); await jobs.submit({provider:'local',prompt:'second'}).done;`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  const result = await new Promise(resolve => {
    const timer = setTimeout(() => { child.kill('SIGTERM'); resolve('still-alive'); }, 1000);
    child.once('exit', code => { clearTimeout(timer); resolve(`early-exit:${code}`); });
    child.once('error', error => { clearTimeout(timer); resolve(error.message); });
  });
  assert.match(output, /FIRST_COMPLETED/);
  assert.equal(result, 'still-alive');
});
