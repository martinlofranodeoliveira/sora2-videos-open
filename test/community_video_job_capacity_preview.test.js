import { test } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/video_job_capacity_preview.mjs";

function throwsInvalid(fn) {
  assert.throws(fn, { name: "TypeError", message: "INVALID_CAPACITY_PREVIEW" });
}

test("example currentCount 3 maxJobs 10", () => {
  const out = runFeature({ currentCount: 3, maxJobs: 10 });
  assert.deepEqual(out, { maxJobs: 10, currentCount: 3, canSubmit: true, remaining: 7 });
});

test("example defaults to 1000 when maxJobs omitted", () => {
  const out = runFeature({ currentCount: 1000 });
  assert.deepEqual(out, { maxJobs: 1000, currentCount: 1000, canSubmit: false, remaining: 0 });
});

test("example single slot", () => {
  const out = runFeature({ currentCount: 0, maxJobs: 1 });
  assert.deepEqual(out, { maxJobs: 1, currentCount: 0, canSubmit: true, remaining: 1 });
});

test("explicit undefined maxJobs defaults to 1000", () => {
  const out = runFeature({ currentCount: 0, maxJobs: undefined });
  assert.deepEqual(out, { maxJobs: 1000, currentCount: 0, canSubmit: true, remaining: 1000 });
});

test("canSubmit false when equal and when above", () => {
  assert.deepEqual(runFeature({ currentCount: 5, maxJobs: 5 }), { maxJobs: 5, currentCount: 5, canSubmit: false, remaining: 0 });
  assert.deepEqual(runFeature({ currentCount: 9, maxJobs: 5 }), { maxJobs: 5, currentCount: 9, canSubmit: false, remaining: 0 });
});

test("rejects Array null and non-object payloads", () => {
  throwsInvalid(() => runFeature([]));
  throwsInvalid(() => runFeature([1]));
  throwsInvalid(() => runFeature(null));
  throwsInvalid(() => runFeature(undefined));
  throwsInvalid(() => runFeature("x"));
  throwsInvalid(() => runFeature(42));
  throwsInvalid(() => runFeature(true));
  throwsInvalid(() => runFeature(9007199254740991));
});

test("rejects unexpected own keys", () => {
  throwsInvalid(() => runFeature({ currentCount: 1, maxJobs: 10, extra: 1 }));
  throwsInvalid(() => runFeature({ currentCount: 1, foo: 2 }));
  throwsInvalid(() => runFeature({ maxJobs: 5, currentCount: 1, remaining: 1 }));
});

test("rejects invalid maxJobs without coercion", () => {
  const bad = [null, 0, -1, -100, 1.5, "10", "1000", NaN, Infinity, -Infinity, true, false, [], {}];
  for (const v of bad) {
    throwsInvalid(() => runFeature({ currentCount: 0, maxJobs: v }));
  }
});

test("rejects invalid currentCount without coercion", () => {
  throwsInvalid(() => runFeature({}));
  throwsInvalid(() => runFeature({ maxJobs: 10 }));
  const bad = [undefined, null, -1, -5, 1.5, "3", "0", NaN, Infinity, -Infinity, true, false, [], {}, 9007199254740992];
  for (const v of bad) {
    throwsInvalid(() => runFeature({ currentCount: v, maxJobs: 10 }));
    throwsInvalid(() => runFeature({ currentCount: v }));
  }
});

test("returns ordered fresh object without mutation", () => {
  const input = { maxJobs: 10, currentCount: 3 };
  const before = JSON.stringify(input);
  const out = runFeature(input);
  assert.deepEqual(Object.keys(out), ["maxJobs", "currentCount", "canSubmit", "remaining"]);
  assert.equal(Object.keys(out).length, 4);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(input, { maxJobs: 10, currentCount: 3 });
  const again = runFeature({ maxJobs: 10, currentCount: 3 });
  assert.deepEqual(out, again);
  assert.notEqual(out, again);
});

test("deterministic and supports boundary safe integers", () => {
  const a = runFeature({ currentCount: 0, maxJobs: 9007199254740991 });
  assert.deepEqual(a, { maxJobs: 9007199254740991, currentCount: 0, canSubmit: true, remaining: 9007199254740991 });
  const b = runFeature({ currentCount: 9007199254740991, maxJobs: 9007199254740991 });
  assert.deepEqual(b, { maxJobs: 9007199254740991, currentCount: 9007199254740991, canSubmit: false, remaining: 0 });
  throwsInvalid(() => runFeature({ currentCount: 0, maxJobs: 9007199254740992 }));
  throwsInvalid(() => runFeature({ currentCount: 0, maxJobs: 0 }));
});
