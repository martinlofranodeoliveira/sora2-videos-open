import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runFeature } from "../src/community/video_priority_order_preview.mjs";

function throwsInvalid(fn) {
  assert.throws(fn, (err) => err instanceof TypeError && err.message === "INVALID_PRIORITY_ORDER_PREVIEW");
}

describe("video priority order preview", () => {
  it("empty pending returns empty orderedIds without throwing or mutating", () => {
    const input = { pending: [] };
    const before = JSON.stringify(input);
    const result = runFeature(input);
    assert.deepStrictEqual(result, { orderedIds: [] });
    assert.deepStrictEqual(Object.keys(result), ["orderedIds"]);
    assert.strictEqual(JSON.stringify(input), before);
    assert.deepStrictEqual(input, { pending: [] });
  });

  it("high entries appear first preserving FIFO within each priority", () => {
    const result = runFeature({
      pending: [
        { id: "a", priority: "low" },
        { id: "b", priority: "high" },
        { id: "c", priority: "low" }
      ]
    });
    assert.deepStrictEqual(result, { orderedIds: ["b", "a", "c"] });
  });

  it("matches contract examples", () => {
    assert.deepStrictEqual(runFeature({ pending: [] }), { orderedIds: [] });
    assert.deepStrictEqual(
      runFeature({ pending: [{ id: "j1", priority: "high" }, { id: "j2", priority: "high" }, { id: "j3", priority: "low" }] }),
      { orderedIds: ["j1", "j2", "j3"] }
    );
    assert.deepStrictEqual(
      runFeature({ pending: [{ id: "l1", priority: "low" }, { id: "l2", priority: "low" }] }),
      { orderedIds: ["l1", "l2"] }
    );
    assert.deepStrictEqual(
      runFeature({ pending: [{ id: "h1", priority: "high" }, { id: "h2", priority: "high" }] }),
      { orderedIds: ["h1", "h2"] }
    );
  });

  it("rejects non-object, Array, null, missing pending or extra top-level keys", () => {
    throwsInvalid(() => runFeature(null));
    throwsInvalid(() => runFeature(undefined));
    throwsInvalid(() => runFeature("x"));
    throwsInvalid(() => runFeature(42));
    throwsInvalid(() => runFeature(true));
    throwsInvalid(() => runFeature([]));
    throwsInvalid(() => runFeature([{ pending: [] }]));
    throwsInvalid(() => runFeature({}));
    throwsInvalid(() => runFeature({ other: [] }));
    throwsInvalid(() => runFeature({ pending: [], extra: 1 }));
    throwsInvalid(() => runFeature({ pending: [], pending2: [] }));
    throwsInvalid(() => runFeature({ pending: undefined }));
    throwsInvalid(() => runFeature({ pending: null }));
    throwsInvalid(() => runFeature({ pending: "nope" }));
    throwsInvalid(() => runFeature({ pending: 1 }));
    throwsInvalid(() => runFeature({ pending: true }));
    throwsInvalid(() => runFeature({ pending: {} }));
  });

  it("rejects sparse, overlong, non-object elements and invalid id or priority", () => {
    const sparse = new Array(2);
    sparse[1] = { id: "b", priority: "high" };
    throwsInvalid(() => runFeature({ pending: sparse }));
    const hole = [{ id: "a", priority: "low" }, { id: "b", priority: "low" }];
    delete hole[0];
    throwsInvalid(() => runFeature({ pending: hole }));
    const overlong = [];
    for (let i = 0; i < 33; i += 1) {
      overlong.push({ id: "x" + String(i), priority: "low" });
    }
    throwsInvalid(() => runFeature({ pending: overlong }));
    throwsInvalid(() => runFeature({ pending: [null] }));
    throwsInvalid(() => runFeature({ pending: [undefined] }));
    throwsInvalid(() => runFeature({ pending: ["a"] }));
    throwsInvalid(() => runFeature({ pending: [42] }));
    throwsInvalid(() => runFeature({ pending: [true] }));
    throwsInvalid(() => runFeature({ pending: [[]] }));
    throwsInvalid(() => runFeature({ pending: [{ id: "a", priority: "low", extra: 1 }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: "a" }] }));
    throwsInvalid(() => runFeature({ pending: [{ priority: "low" }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: "", priority: "low" }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: 1, priority: "low" }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: true, priority: "low" }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: [], priority: "low" }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: {}, priority: "low" }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: null, priority: "low" }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: "a".repeat(129), priority: "low" }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: "a", priority: "medium" }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: "a", priority: "HIGH" }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: "a", priority: 1 }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: "a", priority: true }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: "a", priority: [] }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: "a", priority: {} }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: "a", priority: null }] }));
    throwsInvalid(() => runFeature({ pending: [{ id: "a", priority: undefined }] }));
  });

  it("returns only orderedIds with fresh array and unchanged input", () => {
    const input = {
      pending: [
        { id: "a", priority: "low" },
        { id: "b", priority: "high" }
      ]
    };
    const snapshot = JSON.stringify(input);
    const result = runFeature(input);
    assert.deepStrictEqual(result, { orderedIds: ["b", "a"] });
    assert.deepStrictEqual(Object.keys(result), ["orderedIds"]);
    assert.ok(Array.isArray(result.orderedIds));
    assert.notStrictEqual(result, input);
    assert.notStrictEqual(result.orderedIds, input.pending);
    result.orderedIds.push("mutate");
    assert.strictEqual(input.pending.length, 2);
    assert.strictEqual(JSON.stringify(input), snapshot);
    const second = runFeature(input);
    assert.deepStrictEqual(second, { orderedIds: ["b", "a"] });
    assert.notStrictEqual(second.orderedIds, result.orderedIds);
  });
});
