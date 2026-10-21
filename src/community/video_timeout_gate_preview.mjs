export function runFeature(payload) {
  if (typeof payload !== "object") {
    throw new TypeError("INVALID_TIMEOUT_GATE_PREVIEW");
  }
  if (payload === null) {
    throw new TypeError("INVALID_TIMEOUT_GATE_PREVIEW");
  }
  if (Array.isArray(payload) === true) {
    throw new TypeError("INVALID_TIMEOUT_GATE_PREVIEW");
  }
  const entries = Object.entries(payload);
  if (entries.length !== 1) {
    throw new TypeError("INVALID_TIMEOUT_GATE_PREVIEW");
  }
  const first = entries[0];
  const firstKey = first[0];
  if (firstKey !== "timeout") {
    throw new TypeError("INVALID_TIMEOUT_GATE_PREVIEW");
  }
  const store = new Map();
  for (const entry of Object.entries(payload)) {
    const entryKey = entry[0];
    const entryValue = entry[1];
    store.set(entryKey, entryValue);
  }
  if (store.size !== 1) {
    throw new TypeError("INVALID_TIMEOUT_GATE_PREVIEW");
  }
  if (store.has("timeout") === false) {
    throw new TypeError("INVALID_TIMEOUT_GATE_PREVIEW");
  }
  const keys = [];
  for (const entry of entries) {
    const k = entry[0];
    keys.push(k);
  }
  if (keys.length !== 1) {
    throw new TypeError("INVALID_TIMEOUT_GATE_PREVIEW");
  }
  const timeout = store.get("timeout");
  if (typeof timeout !== "number") {
    throw new TypeError("INVALID_TIMEOUT_GATE_PREVIEW");
  }
  if (Number.isSafeInteger(timeout) === false) {
    throw new TypeError("INVALID_TIMEOUT_GATE_PREVIEW");
  }
  if (timeout < 1) {
    throw new TypeError("INVALID_TIMEOUT_GATE_PREVIEW");
  }
  if (timeout > 30000) {
    throw new TypeError("INVALID_TIMEOUT_GATE_PREVIEW");
  }
  return { timeout: timeout };
}
