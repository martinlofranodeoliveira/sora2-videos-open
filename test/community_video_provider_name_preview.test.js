import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/video_provider_name_preview.mjs";

function expectInvalid(value) {
  let failed = false;
  try {
    runFeature(value);
    failed = true;
  } catch (err) {
    assert.ok(err instanceof TypeError);
    assert.strictEqual(err.message, "INVALID_PROVIDER_NAME_PREVIEW");
  }
  assert.strictEqual(failed, false);
}

describe("video provider name preview", () => {
  it("accepts my-provider with exact key order", () => {
    const out = runFeature({ name: "my-provider" });
    assert.deepStrictEqual(out, { name: "my-provider", length: 11 });
    assert.deepStrictEqual(Object.keys(out), ["name", "length"]);
    assert.strictEqual(out.length, 11);
    assert.strictEqual(Number.isSafeInteger(out.length), true);
  });

  it("accepts minimal and typical names", () => {
    assert.deepStrictEqual(runFeature({ name: "a" }), { name: "a", length: 1 });
    assert.deepStrictEqual(runFeature({ name: "renderer-01" }), { name: "renderer-01", length: 11 });
    assert.deepStrictEqual(Object.keys(runFeature({ name: "a" })), ["name", "length"]);
  });

  it("accepts 40 chars and rejects 41 chars", () => {
    const ok = "abcdefghijklmnopqrstuvwxyz0123456789abcd";
    assert.strictEqual(ok.length, 40);
    const out = runFeature({ name: ok });
    assert.strictEqual(out.length, 40);
    assert.strictEqual(out.name, ok);
    assert.deepStrictEqual(Object.keys(out), ["name", "length"]);
    const tooLong = ok + "e";
    assert.strictEqual(tooLong.length, 41);
    expectInvalid({ name: tooLong });
  });

  it("returns fresh objects and preserves input", () => {
    const input = { name: "my-provider" };
    const before = JSON.stringify(input);
    const firstOut = runFeature(input);
    const secondOut = runFeature(input);
    assert.strictEqual(JSON.stringify(input), before);
    assert.deepStrictEqual(input, { name: "my-provider" });
    assert.notStrictEqual(firstOut, secondOut);
    assert.deepStrictEqual(firstOut, secondOut);
    assert.deepStrictEqual(Object.keys(firstOut), ["name", "length"]);
    firstOut.length = 999;
    assert.strictEqual(secondOut.length, 11);
    assert.strictEqual(JSON.stringify(input), before);
  });

  it("is deterministic", () => {
    const a = runFeature({ name: "renderer-01" });
    const b = runFeature({ name: "renderer-01" });
    assert.deepStrictEqual(a, b);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), { name: "renderer-01", length: 11 });
  });

  it("rejects envelope violations", () => {
    expectInvalid(null);
    expectInvalid(undefined);
    expectInvalid(42);
    expectInvalid("my-provider");
    expectInvalid(true);
    expectInvalid([{ name: "abc" }]);
    expectInvalid([]);
    expectInvalid({});
    expectInvalid({ name: "abc", extra: "x" });
    expectInvalid({ foo: "bar" });
    expectInvalid({ NAME: "abc" });
  });

  it("rejects invalid names without coercion", () => {
    expectInvalid({ name: "" });
    expectInvalid({ name: "My-Provider" });
    expectInvalid({ name: "ABC" });
    expectInvalid({ name: "1abc" });
    expectInvalid({ name: "-abc" });
    expectInvalid({ name: "my_provider" });
    expectInvalid({ name: "my provider" });
    expectInvalid({ name: "my/provider" });
    expectInvalid({ name: "my.provider" });
    expectInvalid({ name: 123 });
    expectInvalid({ name: 0 });
    expectInvalid({ name: true });
    expectInvalid({ name: false });
    expectInvalid({ name: null });
    expectInvalid({ name: undefined });
    expectInvalid({ name: ["a"] });
    expectInvalid({ name: { value: "a" } });
    expectInvalid({});
  });

  it("keeps outputs in safe JSON domain", () => {
    const out = runFeature({ name: "my-provider" });
    const text = JSON.stringify(out);
    assert.ok(text.length < 65536);
    const round = JSON.parse(text);
    assert.deepStrictEqual(round, { name: "my-provider", length: 11 });
    assert.strictEqual(Number.isFinite(round.length), true);
    assert.strictEqual(Number.isSafeInteger(round.length), true);
  });

  it("uses only pure deterministic operations", () => {
    const src = runFeature.toString();
    assert.ok(src.includes("Object.entries"));
    assert.ok(src.includes("Map"));
    assert.ok(src.includes(".get("));
    assert.ok(src.includes(".set("));
    assert.ok(src.includes("for"));
    assert.ok(!src.includes("prototype"));
    assert.ok(!src.includes("constructor"));
    assert.ok(!src.includes("Date"));
    assert.ok(!src.includes("import"));
  });
});
