import test from "node:test";
import assert from "node:assert/strict";
import { inspectVideoBatch } from "../src/index.js";
import { inspectVideoBatch as directBatch } from "../src/mediaBatch.js";

function validVideo(overrides = {}) {
  return {
    format: "mov,mp4",
    durationSeconds: 1.2,
    bytes: 40,
    width: 1280,
    height: 720,
    codec: "h264",
    audioStreams: 1,
    ...overrides
  };
}

function makeGate() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

test("exports batch from index and mediaBatch", () => {
  assert.equal(typeof inspectVideoBatch, "function");
  assert.equal(typeof directBatch, "function");
});

test("empty batch returns empty array via Promise without calling inspector", async () => {
  let calls = 0;
  const inspector = async () => { calls += 1; return validVideo(); };
  const out = inspectVideoBatch([], { inspector });
  assert.ok(out instanceof Promise);
  assert.deepEqual(await out, []);
  assert.equal(calls, 0);
});

test("preserves order despite out-of-order completion", async () => {
  const resolvers = new Map();
  const inspector = (file) => new Promise((resolve) => { resolvers.set(file, resolve); });
  const files = ["order-a.mp4", "order-b.mp4", "order-c.mp4"];
  const pending = inspectVideoBatch(files, { inspector, concurrency: 3, timeout: 5000 });
  await new Promise((r) => setTimeout(r, 5));
  resolvers.get("order-c.mp4")(validVideo({ durationSeconds: 3, bytes: 3 }));
  resolvers.get("order-a.mp4")(validVideo({ durationSeconds: 1, bytes: 1 }));
  resolvers.get("order-b.mp4")(validVideo({ durationSeconds: 2, bytes: 2 }));
  const results = await pending;
  assert.deepEqual(results.map((r) => r.index), [0, 1, 2]);
  assert.equal(results[0].video.durationSeconds, 1);
  assert.equal(results[1].video.durationSeconds, 2);
  assert.equal(results[2].video.durationSeconds, 3);
});

test("accepts sync inspector and executes duplicates in index order", async () => {
  const calls = [];
  const inspector = (file, opts) => {
    calls.push([file, opts.timeout]);
    return validVideo();
  };
  const results = await inspectVideoBatch(["dup.mp4", "dup.mp4", "other.mp4"], { inspector, concurrency: 2, timeout: 1000 });
  assert.deepEqual(calls.map((c) => c[0]), ["dup.mp4", "dup.mp4", "other.mp4"]);
  assert.deepEqual(results.map((r) => r.index), [0, 1, 2]);
  assert.ok(results.every((r) => r.status === "ok"));
  assert.notEqual(results[0].video, results[1].video);
  assert.deepEqual(results[0].video, results[1].video);
});

test("never exceeds concurrency and frees slot only on settle", async () => {
  const gates = [makeGate(), makeGate(), makeGate(), makeGate()];
  let active = 0;
  let max = 0;
  const started = [];
  const inspector = (file) => {
    const idx = Number(file.slice(1));
    started.push(file);
    active += 1;
    max = Math.max(max, active);
    return gates[idx].promise.then(() => {
      active -= 1;
      return validVideo();
    });
  };
  const pending = inspectVideoBatch(["f0", "f1", "f2", "f3"], { inspector, concurrency: 2, timeout: 2000 });
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(started, ["f0", "f1"]);
  assert.ok(max <= 2);
  gates[0].resolve();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(started, ["f0", "f1", "f2"]);
  gates[1].resolve();
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(started, ["f0", "f1", "f2", "f3"]);
  gates[2].resolve();
  gates[3].resolve();
  const results = await pending;
  assert.equal(results.length, 4);
  assert.ok(max <= 2);
  assert.equal(max, 2);
  assert.ok(results.every((r) => r.status === "ok"));
});

test("forwards only timeout with defaults", async () => {
  const seen = [];
  const inspector = async (file, opts) => {
    seen.push(opts);
    assert.deepEqual(Object.keys(opts), ["timeout"]);
    return validVideo();
  };
  await inspectVideoBatch(["a.mp4"], { inspector, concurrency: 1, timeout: 7777 });
  assert.equal(seen[0].timeout, 7777);
  seen.length = 0;
  await inspectVideoBatch(["a.mp4"], { inspector });
  assert.equal(seen[0].timeout, 15000);
  seen.length = 0;
  await inspectVideoBatch(["a.mp4"], { inspector, concurrency: undefined, timeout: undefined });
  assert.equal(seen[0].timeout, 15000);
});

test("rejects invalid files without calling inspector or echoing data", async () => {
  const marker = "echo-marker-987654321";
  async function expectInvalid(files) {
    let calls = 0;
    const inspector = async () => { calls += 1; return validVideo(); };
    try {
      await inspectVideoBatch(files, { inspector });
      assert.fail("should reject");
    } catch (err) {
      assert.ok(err instanceof TypeError);
      assert.equal(err.message, "INVALID_MEDIA_BATCH_INPUT");
      assert.equal(String(err.stack).includes(marker), false);
    }
    assert.equal(calls, 0);
  }
  await expectInvalid("a.mp4");
  await expectInvalid(null);
  await expectInvalid({});
  await expectInvalid([`${marker}.mp4`, 123]);
  await expectInvalid(["ok.mp4", null]);
  await expectInvalid([""]);
  await expectInvalid(["a\0b.mp4"]);
  await expectInvalid(["a".repeat(4097)]);
  await expectInvalid([new String("a.mp4")]);
  await expectInvalid([123]);
  await expectInvalid(new Array(2));
  const sparse = ["a.mp4", "b.mp4"];
  delete sparse[0];
  await expectInvalid(sparse);
  const tooMany = new Array(33).fill("a.mp4");
  await expectInvalid(tooMany);
  const ok32 = new Array(32).fill("a.mp4");
  let calls = 0;
  const inspector = async () => { calls += 1; return validVideo(); };
  const results = await inspectVideoBatch(ok32, { inspector });
  assert.equal(results.length, 32);
  assert.equal(calls, 32);
});

test("rejects invalid options without calling inspector", async () => {
  async function expectInvalidOptions(extra) {
    let calls = 0;
    const inspector = async () => { calls += 1; return validVideo(); };
    const opts = { inspector, ...extra };
    try {
      await inspectVideoBatch(["a.mp4"], opts);
      assert.fail("should reject");
    } catch (err) {
      assert.ok(err instanceof TypeError);
      assert.equal(err.message, "INVALID_MEDIA_BATCH_INPUT");
    }
    assert.equal(calls, 0);
  }
  let calls = 0;
  const counting = async () => { calls += 1; return validVideo(); };
  await assert.rejects(inspectVideoBatch(["a.mp4"], null), { name: "TypeError", message: "INVALID_MEDIA_BATCH_INPUT" });
  await assert.rejects(inspectVideoBatch(["a.mp4"], []), { name: "TypeError", message: "INVALID_MEDIA_BATCH_INPUT" });
  await assert.rejects(inspectVideoBatch(["a.mp4"], Object.create({})), { name: "TypeError", message: "INVALID_MEDIA_BATCH_INPUT" });
  calls = 0;
  await expectInvalidOptions({ extra: 1 });
  const withSymbol = { inspector: counting };
  withSymbol[Symbol("s")] = 1;
  await assert.rejects(inspectVideoBatch(["a.mp4"], withSymbol), { name: "TypeError", message: "INVALID_MEDIA_BATCH_INPUT" });
  assert.equal(calls, 0);
  await expectInvalidOptions({ inspector: "x" });
  await expectInvalidOptions({ inspector: null });
  await expectInvalidOptions({ concurrency: 0 });
  await expectInvalidOptions({ concurrency: 5 });
  await expectInvalidOptions({ concurrency: 1.5 });
  await expectInvalidOptions({ concurrency: "2" });
  await expectInvalidOptions({ concurrency: null });
  await expectInvalidOptions({ timeout: 0 });
  await expectInvalidOptions({ timeout: 30001 });
  await expectInvalidOptions({ timeout: 1.5 });
  await expectInvalidOptions({ timeout: null });
  const ok1 = await inspectVideoBatch(["a.mp4"], { inspector: counting, concurrency: 1, timeout: 1 });
  assert.equal(ok1[0].status, "ok");
  const ok4 = await inspectVideoBatch(["a.mp4"], { inspector: counting, concurrency: 4, timeout: 30000 });
  assert.equal(ok4[0].status, "ok");
});

test("projects seven fields, normalizes nullable, ignores unknown without reading", async () => {
  const inspector = async () => {
    const out = {
      format: "mov,mp4",
      durationSeconds: 1.2,
      bytes: 40,
      width: 1280,
      height: 720,
      codec: "h264",
      audioStreams: 1,
      extra: "ignore-me"
    };
    Object.defineProperty(out, "unread", { enumerable: true, get() { throw new Error("must not read"); } });
    return out;
  };
  const [entry] = await inspectVideoBatch(["a.mp4"], { inspector });
  assert.deepEqual(entry, { index: 0, status: "ok", video: { format: "mov,mp4", durationSeconds: 1.2, bytes: 40, width: 1280, height: 720, codec: "h264", audioStreams: 1 } });
  const minimal = async () => ({ width: 640, height: 480, audioStreams: 0 });
  const [e2] = await inspectVideoBatch(["b.mp4"], { inspector: minimal });
  assert.deepEqual(e2, { index: 0, status: "ok", video: { format: null, durationSeconds: null, bytes: null, width: 640, height: 480, codec: null, audioStreams: 0 } });
  const explicitNull = async () => ({ format: null, durationSeconds: null, bytes: null, width: 64, height: 64, codec: null, audioStreams: 0 });
  const [e3] = await inspectVideoBatch(["c.mp4"], { inspector: explicitNull });
  assert.deepEqual(e3.video, { format: null, durationSeconds: null, bytes: null, width: 64, height: 64, codec: null, audioStreams: 0 });
});

test("invalid field values become fixed error", async () => {
  const badVideos = [
    validVideo({ format: "" }),
    validVideo({ format: "mp4\n" }),
    validVideo({ format: "mp4!" }),
    validVideo({ format: "x".repeat(129) }),
    validVideo({ codec: "" }),
    validVideo({ codec: "h264\n" }),
    validVideo({ durationSeconds: NaN }),
    validVideo({ durationSeconds: Infinity }),
    validVideo({ durationSeconds: -1 }),
    validVideo({ durationSeconds: "1" }),
    validVideo({ bytes: 1.5 }),
    validVideo({ bytes: -1 }),
    validVideo({ width: 0 }),
    validVideo({ width: 65536 }),
    validVideo({ width: null }),
    validVideo({ height: undefined }),
    validVideo({ audioStreams: -1 }),
    validVideo({ audioStreams: 257 }),
    validVideo({ audioStreams: null })
  ];
  for (const bad of badVideos) {
    const inspector = async () => bad;
    const [entry] = await inspectVideoBatch(["x.mp4"], { inspector });
    assert.deepEqual(entry, { index: 0, status: "error", code: "INSPECTION_FAILED" });
  }
  for (const badShape of [null, undefined, 42, "video", []]) {
    const inspector = async () => badShape;
    const [entry] = await inspectVideoBatch(["x.mp4"], { inspector });
    assert.deepEqual(entry, { index: 0, status: "error", code: "INSPECTION_FAILED" });
  }
});

test("sync throw, rejection and throwing getter continue batch with safe error", async () => {
  const good = validVideo();
  const throwingWidth = {};
  Object.defineProperty(throwingWidth, "format", { enumerable: true, value: "mp4" });
  Object.defineProperty(throwingWidth, "durationSeconds", { enumerable: true, value: 1 });
  Object.defineProperty(throwingWidth, "bytes", { enumerable: true, value: 1 });
  Object.defineProperty(throwingWidth, "width", { enumerable: true, get() { throw new Error("boom"); } });
  Object.defineProperty(throwingWidth, "height", { enumerable: true, value: 480 });
  Object.defineProperty(throwingWidth, "codec", { enumerable: true, value: "h264" });
  Object.defineProperty(throwingWidth, "audioStreams", { enumerable: true, value: 0 });
  let n = 0;
  const inspector = (file) => {
    n += 1;
    if (file === "a.mp4") throw new Error("sync boom with a.mp4 path");
    if (file === "b.mp4") return Promise.reject(new Error("async boom"));
    if (file === "c.mp4") return null;
    if (file === "d.mp4") return throwingWidth;
    return good;
  };
  const files = ["a.mp4", "b.mp4", "c.mp4", "d.mp4", "e.mp4"];
  const snapshot = [...files];
  const results = await inspectVideoBatch(files, { inspector, concurrency: 2 });
  assert.deepEqual(files, snapshot);
  assert.equal(n, 5);
  assert.deepEqual(results[0], { index: 0, status: "error", code: "INSPECTION_FAILED" });
  assert.deepEqual(results[1], { index: 1, status: "error", code: "INSPECTION_FAILED" });
  assert.deepEqual(results[2], { index: 2, status: "error", code: "INSPECTION_FAILED" });
  assert.deepEqual(results[3], { index: 3, status: "error", code: "INSPECTION_FAILED" });
  assert.deepEqual(results[4], { index: 4, status: "ok", video: { format: "mov,mp4", durationSeconds: 1.2, bytes: 40, width: 1280, height: 720, codec: "h264", audioStreams: 1 } });
  for (const entry of results.slice(0, 4)) {
    assert.deepEqual(Object.keys(entry).sort(), ["code", "index", "status"]);
    assert.equal(JSON.stringify(entry).includes("a.mp4"), false);
    assert.equal(JSON.stringify(entry).includes("boom"), false);
  }
});

test("does not mutate options and returns independent objects", async () => {
  const raw = validVideo();
  const inspector = async () => raw;
  const options = { inspector, concurrency: 2, timeout: 1234 };
  const frozen = { ...options };
  const results = await inspectVideoBatch(["m.mp4", "n.mp4"], options);
  assert.deepEqual(options, frozen);
  assert.notEqual(results[0], results[1]);
  assert.notEqual(results[0].video, results[1].video);
  assert.notEqual(results[0].video, raw);
  results[0].video.width = 9999;
  assert.equal(results[1].video.width, 1280);
});
