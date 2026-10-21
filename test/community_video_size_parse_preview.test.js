import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/video_size_parse_preview.mjs";

function expectInvalid(value) {
  assert.throws(() => runFeature(value), (err) => err instanceof TypeError && err.message === "INVALID_SIZE_PARSE_PREVIEW");
}

describe("video size parse preview", () => {
  it("parses 1280x720 with exact key order", () => {
    const out = runFeature({ size: "1280x720" });
    assert.deepEqual(out, { width: 1280, height: 720 });
    assert.deepEqual(Object.keys(out), ["width", "height"]);
    assert.equal(Object.keys(out).length, 2);
  });

  it("parses boundary minima and maxima", () => {
    assert.deepEqual(runFeature({ size: "64x64" }), { width: 64, height: 64 });
    assert.deepEqual(runFeature({ size: "4096x4096" }), { width: 4096, height: 4096 });
    assert.deepEqual(Object.keys(runFeature({ size: "64x64" })), ["width", "height"]);
    assert.strictEqual(typeof runFeature({ size: "64x64" }).width, "number");
    assert.strictEqual(typeof runFeature({ size: "4096x4096" }).height, "number");
  });

  it("rejects out-of-range boundaries", () => {
    expectInvalid({ size: "63x64" });
    expectInvalid({ size: "64x63" });
    expectInvalid({ size: "4097x720" });
    expectInvalid({ size: "720x4097" });
    expectInvalid({ size: "4096x4097" });
    expectInvalid({ size: "10x10" });
  });

  it("rejects malformed texts", () => {
    expectInvalid({ size: "" });
    expectInvalid({});
    expectInvalid({ foo: "1280x720" });
    expectInvalid({ size: "1280x720", extra: 1 });
    expectInvalid({ size: "1280x720", size2: "64x64" });
    expectInvalid({ size: "1280*720" });
    expectInvalid({ size: "1280x" });
    expectInvalid({ size: "x720" });
    expectInvalid({ size: "1x1" });
    expectInvalid({ size: "1x720" });
    expectInvalid({ size: "12345x720" });
    expectInvalid({ size: "720x12345" });
    expectInvalid({ size: " 1280x720" });
    expectInvalid({ size: "1280x720 " });
    expectInvalid({ size: "1280x720\n" });
    expectInvalid({ size: "1280x720\r" });
    expectInvalid({ size: "1280X720" });
    expectInvalid({ size: "1280 x720" });
    expectInvalid({ size: "-64x64" });
    expectInvalid({ size: "+64x64" });
    expectInvalid({ size: "64.0x64" });
    expectInvalid({ size: "1280xx720" });
    expectInvalid({ size: "1280x720x100" });
  });

  it("rejects non-string sizes and bad payloads", () => {
    expectInvalid({ size: 720 });
    expectInvalid({ size: null });
    expectInvalid({ size: undefined });
    expectInvalid({ size: true });
    expectInvalid({ size: false });
    expectInvalid({ size: [] });
    expectInvalid({ size: {} });
    expectInvalid({ size: ["1280x720"] });
    expectInvalid(null);
    expectInvalid(undefined);
    expectInvalid([]);
    expectInvalid("1280x720");
    expectInvalid(123);
    expectInvalid(true);
  });

  it("preserves input and returns fresh objects", () => {
    const input = { size: "1280x720" };
    const before = JSON.stringify(input);
    const a = runFeature(input);
    const b = runFeature(input);
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(input, { size: "1280x720" });
    assert.deepEqual(a, { width: 1280, height: 720 });
    assert.deepEqual(b, { width: 1280, height: 720 });
    assert.notStrictEqual(a, b);
    const input2 = { size: "64x64" };
    const snap = JSON.stringify(input2);
    runFeature(input2);
    assert.equal(JSON.stringify(input2), snap);
  });

  it("is deterministic", () => {
    const first = runFeature({ size: "1920x1080" });
    const second = runFeature({ size: "1920x1080" });
    assert.deepEqual(first, second);
    assert.deepEqual(first, { width: 1920, height: 1080 });
  });
});
