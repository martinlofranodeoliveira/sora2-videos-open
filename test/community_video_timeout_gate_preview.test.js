import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/video_timeout_gate_preview.mjs";

function throwsInvalid(fn) {
  assert.throws(fn, (err) => {
    assert.equal(err instanceof TypeError, true);
    assert.equal(err.message, "INVALID_TIMEOUT_GATE_PREVIEW");
    return true;
  });
}

describe("video timeout gate preview payload shape", () => {
  it("rejects non-object, null and Array payloads", () => {
    throwsInvalid(() => runFeature(undefined));
    throwsInvalid(() => runFeature(null));
    throwsInvalid(() => runFeature(42));
    throwsInvalid(() => runFeature("timeout"));
    throwsInvalid(() => runFeature(true));
    throwsInvalid(() => runFeature([]));
    throwsInvalid(() => runFeature([1]));
    throwsInvalid(() => runFeature([{ timeout: 5 }]));
  });
  it("rejects payload without exactly one own key timeout", () => {
    throwsInvalid(() => runFeature({}));
    throwsInvalid(() => runFeature({ other: 5 }));
    throwsInvalid(() => runFeature({ Timeout: 5 }));
    throwsInvalid(() => runFeature({ timeout: 5, extra: 1 }));
    throwsInvalid(() => runFeature({ a: 1, b: 2 }));
  });
});

describe("video timeout gate preview value gate", () => {
  it("rejects missing and non-number timeouts without coercion", () => {
    throwsInvalid(() => runFeature({}));
    throwsInvalid(() => runFeature({ timeout: undefined }));
    throwsInvalid(() => runFeature({ timeout: null }));
    throwsInvalid(() => runFeature({ timeout: "5000" }));
    throwsInvalid(() => runFeature({ timeout: "1" }));
    throwsInvalid(() => runFeature({ timeout: true }));
    throwsInvalid(() => runFeature({ timeout: false }));
    throwsInvalid(() => runFeature({ timeout: [] }));
    throwsInvalid(() => runFeature({ timeout: {} }));
  });
  it("rejects fractions, NaN, Infinity, zero, negatives and over-range", () => {
    throwsInvalid(() => runFeature({ timeout: 1.5 }));
    throwsInvalid(() => runFeature({ timeout: 5000.5 }));
    throwsInvalid(() => runFeature({ timeout: Number.NaN }));
    throwsInvalid(() => runFeature({ timeout: Number.POSITIVE_INFINITY }));
    throwsInvalid(() => runFeature({ timeout: Number.NEGATIVE_INFINITY }));
    throwsInvalid(() => runFeature({ timeout: 0 }));
    throwsInvalid(() => runFeature({ timeout: -1 }));
    throwsInvalid(() => runFeature({ timeout: -5000 }));
    throwsInvalid(() => runFeature({ timeout: 30001 }));
    throwsInvalid(() => runFeature({ timeout: 100000 }));
  });
});

describe("video timeout gate preview valid cases", () => {
  it("accepts 5000 example", () => {
    assert.deepEqual(runFeature({ timeout: 5000 }), { timeout: 5000 });
  });
  it("accepts boundary 1 and 30000 with only key timeout", () => {
    const one = runFeature({ timeout: 1 });
    assert.deepEqual(one, { timeout: 1 });
    assert.deepEqual(Object.keys(one), ["timeout"]);
    const max = runFeature({ timeout: 30000 });
    assert.deepEqual(max, { timeout: 30000 });
    assert.deepEqual(Object.keys(max), ["timeout"]);
  });
  it("echoes value with fresh object and unmutated input", () => {
    const input = { timeout: 1234 };
    const snapshot = { timeout: 1234 };
    const out = runFeature(input);
    assert.equal(out.timeout, 1234);
    assert.deepEqual(out, { timeout: 1234 });
    assert.equal(out !== input, true);
    assert.deepEqual(input, snapshot);
    assert.deepEqual(Object.keys(out), ["timeout"]);
  });
  it("is deterministic and returns fresh refs", () => {
    const first = runFeature({ timeout: 777 });
    const second = runFeature({ timeout: 777 });
    assert.deepEqual(first, second);
    assert.equal(first !== second, true);
  });
});
