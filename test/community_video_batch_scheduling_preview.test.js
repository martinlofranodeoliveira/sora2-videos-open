import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/video_batch_scheduling_preview.mjs";

function rejects(value) {
  assert.throws(() => runFeature(value), (err) => err instanceof TypeError && err.message === "INVALID_BATCH_SCHEDULING_PREVIEW");
}

describe("payload shape", () => {
  it("rejects null, array and non-objects", () => {
    rejects(null);
    rejects(undefined);
    rejects([]);
    rejects([1, 2]);
    rejects("x");
    rejects(42);
    rejects(true);
  });
  it("rejects missing, extra and wrong keys", () => {
    rejects({});
    rejects({ fileCount: 2 });
    rejects({ concurrency: 2 });
    rejects({ fileCount: 2, concurrency: 2, extra: 1 });
    rejects({ fileCount: 2, concurrency: 2, FileCount: 2 });
    rejects({ files: 2, concurrency: 2 });
    rejects({ fileCount: 2, parallel: 2 });
  });
  it("accepts keys in either order", () => {
    const a = runFeature({ fileCount: 3, concurrency: 2 });
    const b = runFeature({ concurrency: 2, fileCount: 3 });
    assert.deepStrictEqual(a, b);
  });
});

describe("fileCount validation", () => {
  it("rejects invalid fileCount", () => {
    rejects({ fileCount: undefined, concurrency: 2 });
    rejects({ fileCount: null, concurrency: 2 });
    rejects({ fileCount: "3", concurrency: 2 });
    rejects({ fileCount: true, concurrency: 2 });
    rejects({ fileCount: [], concurrency: 2 });
    rejects({ fileCount: {}, concurrency: 2 });
    rejects({ fileCount: 1.5, concurrency: 2 });
    rejects({ fileCount: -1, concurrency: 2 });
    rejects({ fileCount: 33, concurrency: 2 });
    rejects({ fileCount: 9007199254740992, concurrency: 2 });
    rejects({ fileCount: NaN, concurrency: 2 });
    rejects({ fileCount: Infinity, concurrency: 2 });
  });
});

describe("concurrency validation", () => {
  it("rejects invalid concurrency", () => {
    rejects({ fileCount: 2, concurrency: undefined });
    rejects({ fileCount: 2, concurrency: null });
    rejects({ fileCount: 2, concurrency: "2" });
    rejects({ fileCount: 2, concurrency: true });
    rejects({ fileCount: 2, concurrency: [] });
    rejects({ fileCount: 2, concurrency: {} });
    rejects({ fileCount: 2, concurrency: 0 });
    rejects({ fileCount: 2, concurrency: 1.5 });
    rejects({ fileCount: 2, concurrency: -1 });
    rejects({ fileCount: 2, concurrency: 5 });
    rejects({ fileCount: 2, concurrency: NaN });
  });
});

describe("valid scheduling", () => {
  it("chunks 3 files with concurrency 2", () => {
    assert.deepStrictEqual(runFeature({ fileCount: 3, concurrency: 2 }), { startOrder: [0, 1, 2], batches: [[0, 1], [2]] });
  });
  it("handles zero files", () => {
    assert.deepStrictEqual(runFeature({ fileCount: 0, concurrency: 2 }), { startOrder: [], batches: [] });
  });
  it("chunks 5 files with concurrency 4", () => {
    assert.deepStrictEqual(runFeature({ fileCount: 5, concurrency: 4 }), { startOrder: [0, 1, 2, 3, 4], batches: [[0, 1, 2, 3], [4]] });
  });
  it("fills first batches fully", () => {
    assert.deepStrictEqual(runFeature({ fileCount: 7, concurrency: 3 }), { startOrder: [0, 1, 2, 3, 4, 5, 6], batches: [[0, 1, 2], [3, 4, 5], [6]] });
  });
  it("supports concurrency 1 and boundary 32", () => {
    const one = runFeature({ fileCount: 2, concurrency: 1 });
    assert.deepStrictEqual(one, { startOrder: [0, 1], batches: [[0], [1]] });
    const big = runFeature({ fileCount: 32, concurrency: 4 });
    assert.strictEqual(big.startOrder.length, 32);
    assert.strictEqual(big.batches.length, 8);
  });
  it("keeps key order, no mutation, no shared refs, deterministic", () => {
    const input = { fileCount: 4, concurrency: 2 };
    const out = runFeature(input);
    assert.deepStrictEqual(Object.keys(out), ["startOrder", "batches"]);
    assert.deepStrictEqual(input, { fileCount: 4, concurrency: 2 });
    const again = runFeature({ fileCount: 4, concurrency: 2 });
    assert.deepStrictEqual(out, again);
    assert.notStrictEqual(out, again);
    assert.notStrictEqual(out.startOrder, again.startOrder);
    assert.notStrictEqual(out.batches, again.batches);
    out.startOrder.push(99);
    out.batches.push([99]);
    const fresh = runFeature({ fileCount: 4, concurrency: 2 });
    assert.deepStrictEqual(fresh, { startOrder: [0, 1, 2, 3], batches: [[0, 1], [2, 3]] });
  });
});
