import { test } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/video_maxjobs_gate_preview.mjs";

function rejectsInvalid(payload) {
  assert.throws(() => runFeature(payload), { name: "TypeError", message: "INVALID_MAX_JOBS" });
}

test("accepts integer 1 and returns fresh object without mutating input", () => {
  const input = { maxJobs: 1 };
  const snapshot = JSON.stringify(input);
  const out = runFeature(input);
  assert.deepEqual(out, { maxJobs: 1 });
  assert.deepEqual(Object.entries(out), Object.entries({ maxJobs: 1 }));
  assert.notEqual(out, input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(Object.entries(out).length, 1);
});

test("accepts integer 1000 preserving input structure", () => {
  const input = { maxJobs: 1000 };
  const snapshot = JSON.stringify(input);
  const out = runFeature(input);
  assert.deepEqual(out, { maxJobs: 1000 });
  assert.notEqual(out, input);
  assert.equal(JSON.stringify(input), snapshot);
});

test("accepts integer 10 example", () => {
  const out = runFeature({ maxJobs: 10 });
  assert.deepEqual(out, { maxJobs: 10 });
});

test("rejects 0, negatives, fractions and numeric strings without coercion", () => {
  rejectsInvalid({ maxJobs: 0 });
  rejectsInvalid({ maxJobs: -1 });
  rejectsInvalid({ maxJobs: -100 });
  rejectsInvalid({ maxJobs: 1.5 });
  rejectsInvalid({ maxJobs: 2.7 });
  rejectsInvalid({ maxJobs: 0.5 });
  rejectsInvalid({ maxJobs: "10" });
  rejectsInvalid({ maxJobs: "1" });
  rejectsInvalid({ maxJobs: "1000" });
});

test("rejects null, booleans, arrays, objects and missing or extra keys", () => {
  rejectsInvalid(null);
  rejectsInvalid(undefined);
  rejectsInvalid(1);
  rejectsInvalid("maxJobs");
  rejectsInvalid(true);
  rejectsInvalid(false);
  rejectsInvalid([]);
  rejectsInvalid([1]);
  rejectsInvalid({});
  rejectsInvalid({ foo: 1 });
  rejectsInvalid({ maxJobs: 1, extra: 2 });
  rejectsInvalid({ maxJobs: 1, other: 1 });
  rejectsInvalid({ maxJobs: null });
  rejectsInvalid({ maxJobs: true });
  rejectsInvalid({ maxJobs: false });
  rejectsInvalid({ maxJobs: [] });
  rejectsInvalid({ maxJobs: {} });
  rejectsInvalid({ maxJobs: "10" });
});

test("stays deterministic with fresh references", () => {
  const first = runFeature({ maxJobs: 7 });
  const second = runFeature({ maxJobs: 7 });
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.deepEqual(first, { maxJobs: 7 });
});
