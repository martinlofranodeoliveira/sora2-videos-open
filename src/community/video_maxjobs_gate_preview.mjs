export function runFeature(payload) {
  if (payload === null) {
    throw new TypeError("INVALID_MAX_JOBS");
  }
  if (typeof payload !== "object") {
    throw new TypeError("INVALID_MAX_JOBS");
  }
  if (Array.isArray(payload)) {
    throw new TypeError("INVALID_MAX_JOBS");
  }
  const entries = Object.entries(payload);
  if (entries.length !== 1) {
    throw new TypeError("INVALID_MAX_JOBS");
  }
  const store = new Map();
  for (const pair of Object.entries(payload)) {
    const k = pair[0];
    const v = pair[1];
    if (k !== "maxJobs") {
      throw new TypeError("INVALID_MAX_JOBS");
    }
    store.set(k, v);
  }
  const value = store.get("maxJobs");
  if (Number.isSafeInteger(value)) {
    if (value >= 1) {
      return { maxJobs: value };
    }
  }
  throw new TypeError("INVALID_MAX_JOBS");
}
