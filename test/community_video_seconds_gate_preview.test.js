import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/video_seconds_gate_preview.mjs";

function expectInvalid(payload) {
  assert.throws(() => runFeature(payload), (err) => {
    assert.ok(err instanceof TypeError);
    assert.strictEqual(err.message, "INVALID_SECONDS_GATE_PREVIEW");
    return true;
  });
}

describe("video_seconds_gate_preview", () => {
  it("accepts {seconds:8} and returns fresh {seconds:8} with only that key", () => {
    const input = { seconds: 8 };
    const before = JSON.stringify(input);
    const out = runFeature(input);
    assert.deepStrictEqual(out, { seconds: 8 });
    assert.deepStrictEqual(Object.keys(out), ["seconds"]);
    assert.notStrictEqual(out, input);
    assert.strictEqual(JSON.stringify(input), before);
    assert.strictEqual(JSON.stringify(out), '{"seconds":8}');
  });

  it("accepts boundary values 1 and 120 exactly", () => {
    assert.deepStrictEqual(runFeature({ seconds: 1 }), { seconds: 1 });
    assert.deepStrictEqual(runFeature({ seconds: 120 }), { seconds: 120 });
    assert.deepStrictEqual(Object.keys(runFeature({ seconds: 1 })), ["seconds"]);
    assert.deepStrictEqual(Object.keys(runFeature({ seconds: 120 })), ["seconds"]);
  });

  it("rejects null, arrays, empty objects, missing seconds, and extra keys", () => {
    expectInvalid(null);
    expectInvalid(undefined);
    expectInvalid([]);
    expectInvalid([1]);
    expectInvalid({});
    expectInvalid({ foo: 1 });
    expectInvalid({ second: 8 });
    expectInvalid({ Seconds: 8 });
    expectInvalid({ SECONDS: 8 });
    expectInvalid({ seconds: 8, extra: 1 });
    expectInvalid({ seconds: 8, foo: 2 });
    expectInvalid({ a: 1, b: 2 });
    expectInvalid("seconds");
    expectInvalid(8);
    expectInvalid(true);
    expectInvalid(false);
  });

  it("rejects non-integer, string, boolean, null, NaN, Infinity, zero, negative, fractional, over-range", () => {
    expectInvalid({ seconds: undefined });
    expectInvalid({ seconds: null });
    expectInvalid({ seconds: "8" });
    expectInvalid({ seconds: "1" });
    expectInvalid({ seconds: true });
    expectInvalid({ seconds: false });
    expectInvalid({ seconds: 0 });
    expectInvalid({ seconds: -1 });
    expectInvalid({ seconds: -8 });
    expectInvalid({ seconds: 1.5 });
    expectInvalid({ seconds: 8.5 });
    expectInvalid({ seconds: 0.5 });
    expectInvalid({ seconds: NaN });
    expectInvalid({ seconds: Infinity });
    expectInvalid({ seconds: -Infinity });
    expectInvalid({ seconds: 121 });
    expectInvalid({ seconds: 1000 });
    expectInvalid({ seconds: 9007199254740991 });
    expectInvalid({ seconds: [] });
    expectInvalid({ seconds: {} });
    expectInvalid({ seconds: [8] });
    expectInvalid({ seconds: new Number(8) });
  });

  it("preserves input, returns fresh object, and is deterministic", () => {
    const input = { seconds: 8 };
    const snapshot = JSON.stringify(input);
    const first = runFeature(input);
    const second = runFeature(input);
    assert.deepStrictEqual(first, second);
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first, input);
    assert.strictEqual(JSON.stringify(input), snapshot);
    assert.deepStrictEqual(input, { seconds: 8 });
    const b1 = { seconds: 1 };
    const b120 = { seconds: 120 };
    assert.deepStrictEqual(runFeature(b1), { seconds: 1 });
    assert.deepStrictEqual(runFeature(b120), { seconds: 120 });
    assert.deepStrictEqual(b1, { seconds: 1 });
    assert.deepStrictEqual(b120, { seconds: 120 });
  });
});
