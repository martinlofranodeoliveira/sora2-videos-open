import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/video_raw_queue_name_preview.mjs";

function expectInvalid(payload) {
  assert.throws(() => runFeature(payload), (err) => {
    assert.equal(err instanceof TypeError, true);
    assert.equal(err.message, "INVALID_RAW_QUEUE_NAME_PREVIEW");
    return true;
  });
}

describe("video raw queue name preview", () => {
  it("accepts simple queue name", () => {
    const out = runFeature({ queue: "renderer" });
    assert.deepEqual(out, { queue: "renderer" });
    assert.deepEqual(Object.keys(out), ["queue"]);
  });

  it("accepts single char and single space and symbols", () => {
    assert.deepEqual(runFeature({ queue: "a" }), { queue: "a" });
    assert.deepEqual(runFeature({ queue: " " }), { queue: " " });
    assert.deepEqual(runFeature({ queue: "a b!@#-$_." }), { queue: "a b!@#-$_." });
  });

  it("accepts __proto__ literally as raw string", () => {
    const out = runFeature({ queue: "__proto__" });
    assert.deepEqual(out, { queue: "__proto__" });
    assert.deepEqual(Object.keys(out), ["queue"]);
    assert.equal(Object.getOwnPropertyNames(out).length, 1);
  });

  it("accepts 256 length boundary but rejects 257", () => {
    const ok = "a".repeat(256);
    assert.deepEqual(runFeature({ queue: ok }), { queue: ok });
    expectInvalid({ queue: "a".repeat(257) });
  });

  it("rejects non-object payloads", () => {
    expectInvalid(null);
    expectInvalid(undefined);
    expectInvalid("renderer");
    expectInvalid(42);
    expectInvalid(true);
    expectInvalid(false);
    expectInvalid([]);
    expectInvalid([{ queue: "a" }]);
  });

  it("rejects wrong shape objects", () => {
    expectInvalid({});
    expectInvalid({ queue: "a", extra: "b" });
    expectInvalid({ wrong: "a" });
    expectInvalid({ Queue: "a" });
    expectInvalid({ queue: "a", Queue: "a" });
  });

  it("rejects invalid queue values without coercion", () => {
    expectInvalid({});
    expectInvalid({ queue: undefined });
    expectInvalid({ queue: null });
    expectInvalid({ queue: "" });
    expectInvalid({ queue: 0 });
    expectInvalid({ queue: 1 });
    expectInvalid({ queue: true });
    expectInvalid({ queue: false });
    expectInvalid({ queue: ["a"] });
    expectInvalid({ queue: [] });
    expectInvalid({ queue: {} });
    expectInvalid({ queue: { toString: "a" } });
  });

  it("preserves input, returns fresh object, deterministic", () => {
    const input = { queue: "renderer" };
    const before = JSON.stringify(input);
    const first = runFeature(input);
    const second = runFeature(input);
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(input, { queue: "renderer" });
    assert.notEqual(first, input);
    assert.notEqual(second, input);
    assert.notEqual(first, second);
    assert.deepEqual(first, second);
    first.queue = "mutated";
    assert.equal(input.queue, "renderer");
    assert.equal(second.queue, "renderer");
  });
});
