import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/video_job_forget_preview.mjs";

function rejectsInvalid(fn) {
  assert.throws(fn, (err) => err instanceof TypeError && err.message === "INVALID_FORGET_PREVIEW");
}

describe("invalid payload shape", () => {
  it("rejects null payload", () => {
    rejectsInvalid(() => runFeature(null));
  });
  it("rejects Array payload", () => {
    rejectsInvalid(() => runFeature([]));
    rejectsInvalid(() => runFeature([{ status: "queued" }]));
  });
  it("rejects non-object payloads", () => {
    rejectsInvalid(() => runFeature(undefined));
    rejectsInvalid(() => runFeature("queued"));
    rejectsInvalid(() => runFeature(42));
    rejectsInvalid(() => runFeature(true));
    rejectsInvalid(() => runFeature(() => {}));
  });
  it("rejects empty object and extra keys", () => {
    rejectsInvalid(() => runFeature({}));
    rejectsInvalid(() => runFeature({ status: "queued", extra: 1 }));
    rejectsInvalid(() => runFeature({ other: "queued" }));
    rejectsInvalid(() => runFeature({ status: "queued", canForget: false }));
  });
});

describe("invalid status values", () => {
  it("rejects missing and undefined status", () => {
    rejectsInvalid(() => runFeature({}));
    rejectsInvalid(() => runFeature({ status: undefined }));
  });
  it("rejects empty and whitespace status", () => {
    rejectsInvalid(() => runFeature({ status: "" }));
    rejectsInvalid(() => runFeature({ status: " " }));
    rejectsInvalid(() => runFeature({ status: " queued" }));
    rejectsInvalid(() => runFeature({ status: "queued " }));
  });
  it("rejects uppercase and wrong case", () => {
    rejectsInvalid(() => runFeature({ status: "QUEUED" }));
    rejectsInvalid(() => runFeature({ status: "Running" }));
    rejectsInvalid(() => runFeature({ status: "COMPLETED" }));
  });
  it("rejects non-string status without coercion", () => {
    rejectsInvalid(() => runFeature({ status: 0 }));
    rejectsInvalid(() => runFeature({ status: 1 }));
    rejectsInvalid(() => runFeature({ status: true }));
    rejectsInvalid(() => runFeature({ status: false }));
    rejectsInvalid(() => runFeature({ status: null }));
    rejectsInvalid(() => runFeature({ status: ["queued"] }));
    rejectsInvalid(() => runFeature({ status: { status: "queued" } }));
  });
  it("rejects unknown strings", () => {
    rejectsInvalid(() => runFeature({ status: "pending" }));
    rejectsInvalid(() => runFeature({ status: "done" }));
  });
});

describe("active statuses", () => {
  it("returns queued as active non-terminal", () => {
    const out = runFeature({ status: "queued" });
    assert.deepStrictEqual(out, { status: "queued", canForget: false, isActive: true, isTerminal: false });
    assert.deepStrictEqual(Object.keys(out), ["status", "canForget", "isActive", "isTerminal"]);
  });
  it("returns running as active non-terminal", () => {
    const out = runFeature({ status: "running" });
    assert.deepStrictEqual(out, { status: "running", canForget: false, isActive: true, isTerminal: false });
    assert.deepStrictEqual(Object.keys(out), ["status", "canForget", "isActive", "isTerminal"]);
  });
});

describe("terminal statuses", () => {
  it("returns completed as terminal forgettable", () => {
    const out = runFeature({ status: "completed" });
    assert.deepStrictEqual(out, { status: "completed", canForget: true, isActive: false, isTerminal: true });
  });
  it("returns failed as terminal forgettable", () => {
    const out = runFeature({ status: "failed" });
    assert.deepStrictEqual(out, { status: "failed", canForget: true, isActive: false, isTerminal: true });
  });
  it("returns cancelled as terminal forgettable", () => {
    const out = runFeature({ status: "cancelled" });
    assert.deepStrictEqual(out, { status: "cancelled", canForget: true, isActive: false, isTerminal: true });
  });
  it("returns fresh objects with no input mutation", () => {
    const a = runFeature({ status: "completed" });
    const b = runFeature({ status: "completed" });
    assert.deepStrictEqual(a, b);
    assert.notStrictEqual(a, b);
    const input = { status: "failed" };
    const before = JSON.stringify(input);
    const out = runFeature(input);
    assert.strictEqual(JSON.stringify(input), before);
    assert.deepStrictEqual(Object.keys(input), ["status"]);
    assert.strictEqual(Object.keys(out).length, 4);
  });
});

describe("deterministic pure transform", () => {
  it("is deterministic across repeated calls", () => {
    const first = runFeature({ status: "queued" });
    const second = runFeature({ status: "queued" });
    assert.deepStrictEqual(first, second);
    assert.deepStrictEqual(JSON.stringify(first), JSON.stringify(second));
  });
  it("exposes only the documented keys", () => {
    for (const status of ["queued", "running", "completed", "failed", "cancelled"]) {
      const out = runFeature({ status });
      assert.deepStrictEqual(Object.keys(out), ["status", "canForget", "isActive", "isTerminal"]);
    }
  });
});
