export function runFeature(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("INVALID_QUEUE_LIMITS");
  }
  for (const [key] of Object.entries(payload)) {
    if (key !== "startsPerMinute" && key !== "maxConcurrent") {
      throw new TypeError("INVALID_QUEUE_LIMITS");
    }
  }
  const rawStarts = payload.startsPerMinute;
  const rawConcurrent = payload.maxConcurrent;
  const startsPerMinute = rawStarts === undefined ? 10 : rawStarts;
  const maxConcurrent = rawConcurrent === undefined ? null : rawConcurrent;
  if (Number.isSafeInteger(startsPerMinute) === false || startsPerMinute < 1) {
    throw new TypeError("INVALID_QUEUE_LIMITS");
  }
  if (rawConcurrent === undefined) {
    return { startsPerMinute, maxConcurrent };
  }
  if (Number.isSafeInteger(maxConcurrent) === false || maxConcurrent < 1) {
    throw new TypeError("INVALID_QUEUE_LIMITS");
  }
  return { startsPerMinute, maxConcurrent };
}
