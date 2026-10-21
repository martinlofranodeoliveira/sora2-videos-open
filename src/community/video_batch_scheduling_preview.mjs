export function runFeature(payload) {
  if (typeof payload !== "object" || payload === null) {
    throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
  }
  if (Array.isArray(payload)) {
    throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
  }
  const entries = Object.entries(payload);
  if (entries.length !== 2) {
    throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
  }
  const table = new Map();
  for (const entry of entries) {
    const key = entry[0];
    const value = entry[1];
    if (key !== "fileCount" && key !== "concurrency") {
      throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
    }
    if (table.has(key)) {
      throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
    }
    table.set(key, value);
  }
  if (table.has("fileCount") === false) {
    throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
  }
  if (table.has("concurrency") === false) {
    throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
  }
  if (table.size !== 2) {
    throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
  }
  const fileCount = table.get("fileCount");
  const concurrency = table.get("concurrency");
  if (typeof fileCount !== "number") {
    throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
  }
  if (Number.isSafeInteger(fileCount) === false) {
    throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
  }
  if (fileCount < 0 || fileCount > 32) {
    throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
  }
  if (typeof concurrency !== "number") {
    throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
  }
  if (Number.isSafeInteger(concurrency) === false) {
    throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
  }
  if (concurrency < 1 || concurrency > 4) {
    throw new TypeError("INVALID_BATCH_SCHEDULING_PREVIEW");
  }
  const startOrder = [];
  for (let n = 0; n < fileCount; n = n + 1) {
    startOrder.push(n);
  }
  const batches = [];
  let current = [];
  for (const id of startOrder) {
    current.push(id);
    if (current.length === concurrency) {
      batches.push(current);
      current = [];
    }
  }
  if (current.length !== 0) {
    batches.push(current);
  }
  return { startOrder: startOrder, batches: batches };
}
