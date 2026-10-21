export function runFeature(payload) {
  if (payload === null) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  if (typeof payload !== "object") {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  if (Array.isArray(payload)) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  const entries = Object.entries(payload);
  if (entries.length !== 1) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  const table = new Map();
  for (const entry of Object.entries(payload)) {
    const entryKey = entry[0];
    const entryValue = entry[1];
    table.set(entryKey, entryValue);
  }
  if (table.size !== 1) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  if (table.has("size") === false) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  const size = table.get("size");
  if (typeof size !== "string") {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  const parts = size.split("x");
  if (parts.length !== 2) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  if (/^[0-9]{2,4}$/.test(parts[0]) === false) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  if (/^[0-9]{2,4}$/.test(parts[1]) === false) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  const canonical = parts[0] + "x" + parts[1];
  if (canonical !== size) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  const collected = [];
  collected.push(parts[0]);
  collected.push(parts[1]);
  const first = collected[0];
  const second = collected[1];
  if (/^[0-9]{2,4}$/.test(first) === false) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  if (/^[0-9]{2,4}$/.test(second) === false) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  const width = Number(parts[0]);
  const height = Number(parts[1]);
  if (Number.isSafeInteger(width) === false) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  if (Number.isSafeInteger(height) === false) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  if (width < 64) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  if (width > 4096) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  if (height < 64) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  if (height > 4096) {
    throw new TypeError("INVALID_SIZE_PARSE_PREVIEW");
  }
  const result = { width: width, height: height };
  return result;
}
