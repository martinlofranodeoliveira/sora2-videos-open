import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/video_shutdown_preview.mjs";

function throwsInvalid(payload) {
  assert.throws(() => runFeature(payload), (err) => err instanceof TypeError && err.message === "INVALID_SHUTDOWN_PREVIEW");
}

function checkKeysAndShape(result, expectedResult, expectedReason) {
  assert.deepEqual(Object.keys(result), ["result", "reason"]);
  assert.equal(result.result, expectedResult);
  assert.equal(result.reason, expectedReason);
  assert.equal(Object.keys(result).length, 2);
}

describe("video shutdown preview valid outcomes", () => {
  it("will-close when registered and not closed", () => {
    const out = runFeature({ name: "my-provider", registered: ["my-provider"], closed: [] });
    assert.deepEqual(out, { result: true, reason: "will-close" });
    checkKeysAndShape(out, true, "will-close");
  });
  it("unknown when absent from registered regardless of closed", () => {
    const out = runFeature({ name: "other-one", registered: ["my-provider"], closed: [] });
    assert.deepEqual(out, { result: false, reason: "unknown" });
    checkKeysAndShape(out, false, "unknown");
    const out2 = runFeature({ name: "other-one", registered: ["my-provider"], closed: ["other-one", "my-provider"] });
    assert.deepEqual(out2, { result: false, reason: "unknown" });
  });
  it("already-closed when in both registered and closed", () => {
    const out = runFeature({ name: "my-provider", registered: ["my-provider"], closed: ["my-provider"] });
    assert.deepEqual(out, { result: false, reason: "already-closed" });
    checkKeysAndShape(out, false, "already-closed");
  });
  it("handles empty lists and multiple entries", () => {
    const a = runFeature({ name: "a", registered: [], closed: [] });
    assert.deepEqual(a, { result: false, reason: "unknown" });
    const b = runFeature({ name: "b-2", registered: ["a", "b-2", "c-3"], closed: ["a"] });
    assert.deepEqual(b, { result: true, reason: "will-close" });
    const c = runFeature({ name: "a", registered: ["a", "b-2"], closed: ["b-2", "a"] });
    assert.deepEqual(c, { result: false, reason: "already-closed" });
  });
  it("returns fresh objects with no shared references and deterministic", () => {
    const payload = { name: "my-provider", registered: ["my-provider"], closed: [] };
    const r1 = runFeature(payload);
    const r2 = runFeature(payload);
    assert.deepEqual(r1, r2);
    assert.notEqual(r1, r2);
    r1.result = false;
    const r3 = runFeature(payload);
    assert.equal(r3.result, true);
    assert.equal(r3.reason, "will-close");
  });
  it("preserves input with no mutation", () => {
    const payload = { name: "my-provider", registered: ["my-provider", "other-one"], closed: ["other-one"] };
    const before = JSON.stringify(payload);
    const out = runFeature(payload);
    assert.deepEqual(out, { result: true, reason: "will-close" });
    assert.equal(JSON.stringify(payload), before);
    assert.deepEqual(payload.registered, ["my-provider", "other-one"]);
    assert.deepEqual(payload.closed, ["other-one"]);
  });
});

describe("video shutdown preview invalid inputs", () => {
  it("rejects non-object, null and Array payloads", () => {
    throwsInvalid(null);
    throwsInvalid(undefined);
    throwsInvalid(42);
    throwsInvalid("x");
    throwsInvalid(true);
    throwsInvalid([]);
    throwsInvalid([{ name: "a", registered: [], closed: [] }]);
  });
  it("rejects extra keys and missing keys", () => {
    throwsInvalid({ name: "a", registered: [], closed: [], extra: 1 });
    throwsInvalid({ name: "a", registered: [] });
    throwsInvalid({ name: "a", closed: [] });
    throwsInvalid({ registered: [], closed: [] });
    throwsInvalid({});
    throwsInvalid({ name: "a", registered: [], closed: [], Name: "a" });
  });
  it("rejects invalid name values", () => {
    throwsInvalid({ name: undefined, registered: [], closed: [] });
    throwsInvalid({ name: null, registered: [], closed: [] });
    throwsInvalid({ name: "", registered: [], closed: [] });
    throwsInvalid({ name: "A-provider", registered: [], closed: [] });
    throwsInvalid({ name: "1provider", registered: [], closed: [] });
    throwsInvalid({ name: "-provider", registered: [], closed: [] });
    throwsInvalid({ name: "my_provider", registered: [], closed: [] });
    throwsInvalid({ name: "my provider", registered: [], closed: [] });
    throwsInvalid({ name: "my.provider", registered: [], closed: [] });
    throwsInvalid({ name: 123, registered: [], closed: [] });
    throwsInvalid({ name: true, registered: [], closed: [] });
    throwsInvalid({ name: ["a"], registered: [], closed: [] });
    throwsInvalid({ name: {}, registered: [], closed: [] });
    throwsInvalid({ name: "a".repeat(41), registered: [], closed: [] });
  });
  it("rejects invalid registered and closed", () => {
    throwsInvalid({ name: "a", registered: undefined, closed: [] });
    throwsInvalid({ name: "a", registered: null, closed: [] });
    throwsInvalid({ name: "a", registered: "a", closed: [] });
    throwsInvalid({ name: "a", registered: [], closed: undefined });
    throwsInvalid({ name: "a", registered: [], closed: null });
    throwsInvalid({ name: "a", registered: [], closed: {} });
    throwsInvalid({ name: "a", registered: [123], closed: [] });
    throwsInvalid({ name: "a", registered: [true], closed: [] });
    throwsInvalid({ name: "a", registered: [null], closed: [] });
    throwsInvalid({ name: "a", registered: [""], closed: [] });
    throwsInvalid({ name: "a", registered: ["Bad"], closed: [] });
    throwsInvalid({ name: "a", registered: [], closed: ["Bad"] });
    throwsInvalid({ name: "a", registered: ["a".repeat(41)], closed: [] });
    const over = Array.from({ length: 33 }, () => "a");
    throwsInvalid({ name: "a", registered: over, closed: [] });
    throwsInvalid({ name: "a", registered: [], closed: over });
  });
  it("rejects sparse arrays and invalid characters", () => {
    const sparseReg = ["a"];
    sparseReg.length = 2;
    throwsInvalid({ name: "a", registered: sparseReg, closed: [] });
    const sparseClosed = ["a"];
    sparseClosed.length = 3;
    throwsInvalid({ name: "a", registered: ["a"], closed: sparseClosed });
    const hole = new Array(2);
    throwsInvalid({ name: "a", registered: hole, closed: [] });
    throwsInvalid({ name: "my@provider", registered: [], closed: [] });
    throwsInvalid({ name: "a", registered: ["my/provider"], closed: [] });
    throwsInvalid({ name: "a", registered: [], closed: ["under_score"] });
  });
  it("does not mutate invalid payloads", () => {
    const payload = { name: "Bad", registered: [], closed: [] };
    const before = JSON.stringify(payload);
    try {
      runFeature(payload);
    } catch {
    }
    assert.equal(JSON.stringify(payload), before);
  });
});
