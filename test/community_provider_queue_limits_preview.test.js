import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/provider_queue_limits_preview.mjs";

function rejectsInvalid(payload) {
  assert.throws(() => runFeature(payload), { name: "TypeError", message: "INVALID_QUEUE_LIMITS" });
}

describe("provider queue limits preview", () => {
  it("rejects Array, null and non-object payloads", () => {
    rejectsInvalid(null);
    rejectsInvalid(undefined);
    rejectsInvalid([]);
    rejectsInvalid([1, 2]);
    rejectsInvalid("limits");
    rejectsInvalid(10);
    rejectsInvalid(0);
    rejectsInvalid(true);
    rejectsInvalid(false);
    rejectsInvalid(NaN);
    rejectsInvalid(() => {});
  });

  it("rejects any other own enumerable string key", () => {
    rejectsInvalid({ startsPerMinute: 10, maxConcurrent: 2, extra: 1 });
    rejectsInvalid({ foo: 1 });
    rejectsInvalid({ startsperminute: 10 });
    rejectsInvalid({ StartsPerMinute: 10 });
    rejectsInvalid({ maxConcurrent: 2, startsPerMinute: 10, queue: {} });
  });

  it("defaults missing or undefined fields", () => {
    assert.deepEqual(runFeature({}), { startsPerMinute: 10, maxConcurrent: null });
    assert.deepEqual(runFeature({ startsPerMinute: undefined }), { startsPerMinute: 10, maxConcurrent: null });
    assert.deepEqual(runFeature({ maxConcurrent: undefined }), { startsPerMinute: 10, maxConcurrent: null });
    assert.deepEqual(runFeature({ startsPerMinute: undefined, maxConcurrent: undefined }), { startsPerMinute: 10, maxConcurrent: null });
    assert.deepEqual(runFeature({ startsPerMinute: 5 }), { startsPerMinute: 5, maxConcurrent: null });
  });

  it("matches contract examples", () => {
    assert.deepEqual(runFeature({ maxConcurrent: 2, startsPerMinute: 10 }), { startsPerMinute: 10, maxConcurrent: 2 });
    assert.deepEqual(runFeature({}), { startsPerMinute: 10, maxConcurrent: null });
    assert.deepEqual(runFeature({ startsPerMinute: 5 }), { startsPerMinute: 5, maxConcurrent: null });
  });

  it("explicit null never means unlimited", () => {
    rejectsInvalid({ startsPerMinute: null });
    rejectsInvalid({ maxConcurrent: null });
    rejectsInvalid({ startsPerMinute: null, maxConcurrent: 2 });
    rejectsInvalid({ startsPerMinute: 10, maxConcurrent: null });
  });

  it("rejects invalid startsPerMinute without coercion", () => {
    rejectsInvalid({ startsPerMinute: 0 });
    rejectsInvalid({ startsPerMinute: -1 });
    rejectsInvalid({ startsPerMinute: 1.5 });
    rejectsInvalid({ startsPerMinute: "10" });
    rejectsInvalid({ startsPerMinute: "5" });
    rejectsInvalid({ startsPerMinute: NaN });
    rejectsInvalid({ startsPerMinute: Infinity });
    rejectsInvalid({ startsPerMinute: -Infinity });
    rejectsInvalid({ startsPerMinute: true });
    rejectsInvalid({ startsPerMinute: false });
    rejectsInvalid({ startsPerMinute: {} });
    rejectsInvalid({ startsPerMinute: [] });
    rejectsInvalid({ startsPerMinute: [10] });
    rejectsInvalid({ startsPerMinute: Number.MAX_SAFE_INTEGER + 1 });
  });

  it("rejects invalid maxConcurrent without coercion", () => {
    rejectsInvalid({ maxConcurrent: 0 });
    rejectsInvalid({ maxConcurrent: -2 });
    rejectsInvalid({ maxConcurrent: 2.5 });
    rejectsInvalid({ maxConcurrent: "2" });
    rejectsInvalid({ maxConcurrent: NaN });
    rejectsInvalid({ maxConcurrent: Infinity });
    rejectsInvalid({ maxConcurrent: true });
    rejectsInvalid({ maxConcurrent: false });
    rejectsInvalid({ maxConcurrent: {} });
    rejectsInvalid({ maxConcurrent: [] });
    rejectsInvalid({ maxConcurrent: Number.MAX_SAFE_INTEGER + 1 });
  });

  it("accepts safe integers >=1", () => {
    assert.deepEqual(runFeature({ startsPerMinute: 1 }), { startsPerMinute: 1, maxConcurrent: null });
    assert.deepEqual(runFeature({ startsPerMinute: 1, maxConcurrent: 1 }), { startsPerMinute: 1, maxConcurrent: 1 });
    assert.deepEqual(runFeature({ startsPerMinute: Number.MAX_SAFE_INTEGER, maxConcurrent: Number.MAX_SAFE_INTEGER }), { startsPerMinute: Number.MAX_SAFE_INTEGER, maxConcurrent: Number.MAX_SAFE_INTEGER });
  });

  it("returns fresh plain object with exact key order and no input mutation", () => {
    const input = { startsPerMinute: 7, maxConcurrent: 3 };
    const out = runFeature(input);
    assert.deepEqual(Object.keys(out), ["startsPerMinute", "maxConcurrent"]);
    assert.deepEqual(out, { startsPerMinute: 7, maxConcurrent: 3 });
    assert.deepEqual(input, { startsPerMinute: 7, maxConcurrent: 3 });
    const again = runFeature(input);
    assert.notEqual(out, again);
    assert.deepEqual(out, again);
    assert.notEqual(out, input);
    const emptyOut = runFeature({});
    assert.deepEqual(Object.keys(emptyOut), ["startsPerMinute", "maxConcurrent"]);
  });

  it("is deterministic", () => {
    const a = runFeature({ startsPerMinute: 9, maxConcurrent: 2 });
    const b = runFeature({ startsPerMinute: 9, maxConcurrent: 2 });
    assert.deepEqual(a, b);
    assert.notEqual(a, b);
    assert.deepEqual(runFeature({}), runFeature({}));
  });
});
