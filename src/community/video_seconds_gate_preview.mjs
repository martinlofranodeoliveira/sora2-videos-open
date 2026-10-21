export function runFeature(payload) {
  if (payload === null) {
    throw new TypeError("INVALID_SECONDS_GATE_PREVIEW");
  }
  if (typeof payload !== "object") {
    throw new TypeError("INVALID_SECONDS_GATE_PREVIEW");
  }
  if (Array.isArray(payload)) {
    throw new TypeError("INVALID_SECONDS_GATE_PREVIEW");
  }
  if (Object.entries(payload).length !== 1) {
    throw new TypeError("INVALID_SECONDS_GATE_PREVIEW");
  }
  const store = new Map();
  for (const entry of Object.entries(payload)) {
    const key = entry[0];
    const value = entry[1];
    store.set(key, value);
  }
  if (store.size !== 1) {
    throw new TypeError("INVALID_SECONDS_GATE_PREVIEW");
  }
  if (store.has("seconds") === false) {
    throw new TypeError("INVALID_SECONDS_GATE_PREVIEW");
  }
  const seconds = store.get("seconds");
  if (typeof seconds !== "number") {
    throw new TypeError("INVALID_SECONDS_GATE_PREVIEW");
  }
  if (Number.isSafeInteger(seconds) === false) {
    throw new TypeError("INVALID_SECONDS_GATE_PREVIEW");
  }
  if (seconds < 1) {
    throw new TypeError("INVALID_SECONDS_GATE_PREVIEW");
  }
  if (seconds > 120) {
    throw new TypeError("INVALID_SECONDS_GATE_PREVIEW");
  }
  const result = { seconds: seconds };
  return result;
}
