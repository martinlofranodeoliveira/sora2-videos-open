import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/video_inspection_normalizer.mjs";

function throwsInvalid(fn) {
  assert.throws(fn, (e) => e instanceof TypeError && e.message === "INVALID_INSPECTION_INPUT");
}

function validRaw() {
  return { format: "mp4", durationSeconds: 1.5, bytes: 42, width: 640, height: 480, codec: "h264", audioStreams: 1 };
}

describe("outer envelope throws INVALID_INSPECTION_INPUT", () => {
  it("null throws", () => { throwsInvalid(() => runFeature(null)); });
  it("array throws", () => { throwsInvalid(() => runFeature([])); });
  it("string throws", () => { throwsInvalid(() => runFeature("x")); });
  it("number throws", () => { throwsInvalid(() => runFeature(1)); });
  it("boolean throws", () => { throwsInvalid(() => runFeature(true)); });
  it("undefined throws", () => { throwsInvalid(() => runFeature(undefined)); });
  it("empty object throws", () => { throwsInvalid(() => runFeature({})); });
  it("missing raw throws", () => { throwsInvalid(() => runFeature({ other: 1 })); });
  it("renamed key throws", () => { throwsInvalid(() => runFeature({ Raw: {} })); });
  it("two keys throws", () => { throwsInvalid(() => runFeature({ raw: {}, extra: 1 })); });
  it("raw plus second key throws", () => {
    throwsInvalid(() => runFeature({ raw: validRaw(), foo: "bar" }));
  });
  it("exactly one raw key passes outer check", () => {
    const out = runFeature({ raw: null });
    assert.deepStrictEqual(out, { status: "error", code: "INSPECTION_FAILED" });
  });
});

describe("non-object raw returns error envelope", () => {
  it("null raw returns error", () => {
    assert.deepStrictEqual(runFeature({ raw: null }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("string raw returns error", () => {
    assert.deepStrictEqual(runFeature({ raw: "video" }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("number raw returns error", () => {
    assert.deepStrictEqual(runFeature({ raw: 5 }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("boolean raw returns error", () => {
    assert.deepStrictEqual(runFeature({ raw: false }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("array raw returns error", () => {
    assert.deepStrictEqual(runFeature({ raw: [] }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("error envelope has exact keys in order", () => {
    const out = runFeature({ raw: null });
    assert.deepStrictEqual(Object.keys(out), ["status", "code"]);
  });
});

describe("full valid raw", () => {
  it("returns ok with ordered video and no extra keys", () => {
    const out = runFeature({ raw: validRaw() });
    assert.strictEqual(out.status, "ok");
    assert.deepStrictEqual(Object.keys(out), ["status", "video"]);
    assert.deepStrictEqual(Object.keys(out.video), ["format", "durationSeconds", "bytes", "width", "height", "codec", "audioStreams"]);
    assert.deepStrictEqual(out.video, validRaw());
  });
  it("contract example minimal valid", () => {
    const out = runFeature({ raw: { width: 1280, height: 720, audioStreams: 0 } });
    assert.deepStrictEqual(out, { status: "ok", video: { format: null, durationSeconds: null, bytes: null, width: 1280, height: 720, codec: null, audioStreams: 0 } });
  });
  it("missing height returns error", () => {
    const raw = { format: "mp4", durationSeconds: 1.5, bytes: 42, codec: "h264", width: 640, audioStreams: 1 };
    assert.deepStrictEqual(runFeature({ raw }), { status: "error", code: "INSPECTION_FAILED" });
  });
});

describe("optional normalization to null", () => {
  it("missing optionals normalize to null", () => {
    const out = runFeature({ raw: { width: 640, height: 480, audioStreams: 2 } });
    assert.deepStrictEqual(out.video, { format: null, durationSeconds: null, bytes: null, width: 640, height: 480, codec: null, audioStreams: 2 });
  });
  it("null optionals normalize to null", () => {
    const out = runFeature({ raw: { format: null, durationSeconds: null, bytes: null, codec: null, width: 640, height: 480, audioStreams: 1 } });
    assert.strictEqual(out.status, "ok");
    assert.deepStrictEqual(out.video.format, null);
    assert.deepStrictEqual(out.video.durationSeconds, null);
    assert.deepStrictEqual(out.video.bytes, null);
    assert.deepStrictEqual(out.video.codec, null);
  });
  it("undefined optionals normalize to null", () => {
    const out = runFeature({ raw: { format: undefined, durationSeconds: undefined, bytes: undefined, codec: undefined, width: 10, height: 10, audioStreams: 0 } });
    assert.deepStrictEqual(out.video.format, null);
    assert.deepStrictEqual(out.video.codec, null);
    assert.deepStrictEqual(out.video.bytes, null);
    assert.deepStrictEqual(out.video.durationSeconds, null);
  });
});

describe("required validation", () => {
  it("missing width returns error", () => {
    assert.deepStrictEqual(runFeature({ raw: { height: 480, audioStreams: 1 } }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("null width returns error", () => {
    assert.deepStrictEqual(runFeature({ raw: { width: null, height: 480, audioStreams: 1 } }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("zero width returns error", () => {
    const r = validRaw(); r.width = 0;
    assert.deepStrictEqual(runFeature({ raw: r }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("fractional width returns error", () => {
    const r = validRaw(); r.width = 640.5;
    assert.deepStrictEqual(runFeature({ raw: r }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("string width returns error", () => {
    const r = validRaw(); r.width = "640";
    assert.deepStrictEqual(runFeature({ raw: r }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("out of range width returns error", () => {
    const r = validRaw(); r.width = 8193;
    assert.deepStrictEqual(runFeature({ raw: r }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("invalid height variants return error", () => {
    for (const h of [undefined, null, 0, 1.5, "480", 9000]) {
      const r = validRaw(); r.height = h;
      assert.deepStrictEqual(runFeature({ raw: r }), { status: "error", code: "INSPECTION_FAILED" });
    }
  });
  it("invalid audioStreams variants return error", () => {
    for (const a of [undefined, null, -1, 33, 1.5, "1", true]) {
      const r = validRaw(); r.audioStreams = a;
      assert.deepStrictEqual(runFeature({ raw: r }), { status: "error", code: "INSPECTION_FAILED" });
    }
  });
  it("boundary required values pass", () => {
    const a = runFeature({ raw: { width: 1, height: 1, audioStreams: 0 } });
    assert.strictEqual(a.status, "ok");
    const b = runFeature({ raw: { width: 8192, height: 8192, audioStreams: 32 } });
    assert.strictEqual(b.status, "ok");
  });
});

describe("invalid optionals and extra keys", () => {
  it("empty format returns error", () => {
    const r = validRaw(); r.format = "";
    assert.deepStrictEqual(runFeature({ raw: r }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("overlong format returns error", () => {
    const r = validRaw(); r.format = "x".repeat(33);
    assert.deepStrictEqual(runFeature({ raw: r }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("boolean format returns error", () => {
    const r = validRaw(); r.format = true;
    assert.deepStrictEqual(runFeature({ raw: r }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("non-finite duration returns error", () => {
    for (const d of [NaN, Infinity, -Infinity, 0, -1, 86401, "1.5"]) {
      const r = validRaw(); r.durationSeconds = d;
      assert.deepStrictEqual(runFeature({ raw: r }), { status: "error", code: "INSPECTION_FAILED" });
    }
  });
  it("negative and non-integer bytes return error", () => {
    for (const b of [-1, 1.5, "42", true, NaN]) {
      const r = validRaw(); r.bytes = b;
      assert.deepStrictEqual(runFeature({ raw: r }), { status: "error", code: "INSPECTION_FAILED" });
    }
  });
  it("invalid codec returns error", () => {
    const r = validRaw(); r.codec = "";
    assert.deepStrictEqual(runFeature({ raw: r }), { status: "error", code: "INSPECTION_FAILED" });
  });
  it("unknown extra keys ignored", () => {
    const raw = { format: "mp4", durationSeconds: 2, bytes: 10, width: 320, height: 240, codec: "h264", audioStreams: 1, extra: "yes", path: "/tmp/a", nested: { a: 1 } };
    const out = runFeature({ raw });
    assert.strictEqual(out.status, "ok");
    assert.deepStrictEqual(Object.keys(out.video).length, 7);
  });
  it("inputs are not mutated and results are fresh", () => {
    const raw = validRaw();
    const payload = { raw };
    const before = JSON.stringify(payload);
    const first = runFeature(payload);
    const second = runFeature(payload);
    assert.strictEqual(JSON.stringify(payload), before);
    assert.deepStrictEqual(first, second);
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first.video, second.video);
  });
});
