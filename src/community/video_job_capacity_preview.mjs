export function runFeature(payload) {
  if (payload === null) {
    throw new TypeError("INVALID_CAPACITY_PREVIEW");
  }
  if (typeof payload !== "object") {
    throw new TypeError("INVALID_CAPACITY_PREVIEW");
  }
  if (Array.isArray(payload)) {
    throw new TypeError("INVALID_CAPACITY_PREVIEW");
  }
  const entries = Object.entries(payload);
  const store = new Map();
  for (const entry of entries) {
    const key = entry[0];
    const value = entry[1];
    if (key !== "maxJobs") {
      if (key !== "currentCount") {
        throw new TypeError("INVALID_CAPACITY_PREVIEW");
      }
    }
    store.set(key, value);
  }
  const rawMax = store.get("maxJobs");
  const effectiveMax = rawMax === undefined ? 1000 : rawMax;
  if (Number.isSafeInteger(effectiveMax) === false) {
    throw new TypeError("INVALID_CAPACITY_PREVIEW");
  }
  if (effectiveMax < 1) {
    throw new TypeError("INVALID_CAPACITY_PREVIEW");
  }
  if (effectiveMax > 9007199254740991) {
    throw new TypeError("INVALID_CAPACITY_PREVIEW");
  }
  const rawCount = store.get("currentCount");
  if (Number.isSafeInteger(rawCount) === false) {
    throw new TypeError("INVALID_CAPACITY_PREVIEW");
  }
  if (rawCount < 0) {
    throw new TypeError("INVALID_CAPACITY_PREVIEW");
  }
  if (rawCount > 9007199254740991) {
    throw new TypeError("INVALID_CAPACITY_PREVIEW");
  }
  const canSubmit = rawCount < effectiveMax;
  const remaining = canSubmit ? effectiveMax - rawCount : 0;
  return { maxJobs: effectiveMax, currentCount: rawCount, canSubmit: canSubmit, remaining: remaining };
}
