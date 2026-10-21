export function runFeature(payload) {
  if (typeof payload !== "object" || payload === null) {
    throw new TypeError("INVALID_RAW_QUEUE_NAME_PREVIEW");
  }
  if (Array.isArray(payload) === true) {
    throw new TypeError("INVALID_RAW_QUEUE_NAME_PREVIEW");
  }
  const listed = Object.entries(payload);
  if (listed.length !== 1) {
    throw new TypeError("INVALID_RAW_QUEUE_NAME_PREVIEW");
  }
  for (const row of listed) {
    if (row[0] !== "queue") {
      throw new TypeError("INVALID_RAW_QUEUE_NAME_PREVIEW");
    }
  }
  const box = new Map();
  for (const row of listed) {
    box.set(row[0], row[1]);
  }
  if (box.size !== 1) {
    throw new TypeError("INVALID_RAW_QUEUE_NAME_PREVIEW");
  }
  const queue = box.get("queue");
  if (typeof queue !== "string") {
    throw new TypeError("INVALID_RAW_QUEUE_NAME_PREVIEW");
  }
  if (queue.length < 1 || queue.length > 256) {
    throw new TypeError("INVALID_RAW_QUEUE_NAME_PREVIEW");
  }
  return { queue: queue };
}
