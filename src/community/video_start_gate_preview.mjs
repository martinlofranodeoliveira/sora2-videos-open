export function runFeature(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('INVALID_START_GATE_PREVIEW');
  }
  const allowed = new Map();
  allowed.set('maxConcurrent', true);
  allowed.set('active', true);
  allowed.set('rateAvailable', true);
  allowed.set('closed', true);
  const store = new Map();
  for (const entry of Object.entries(payload)) {
    const key = entry[0];
    const value = entry[1];
    if (allowed.get(key) !== true) {
      throw new TypeError('INVALID_START_GATE_PREVIEW');
    }
    store.set(key, value);
  }
  const maxConcurrent = store.get('maxConcurrent');
  const active = store.get('active');
  const rateAvailable = store.get('rateAvailable');
  const closed = store.get('closed');
  if (maxConcurrent !== null) {
    if (Number.isSafeInteger(maxConcurrent) !== true) {
      throw new TypeError('INVALID_START_GATE_PREVIEW');
    }
    if (maxConcurrent < 1) {
      throw new TypeError('INVALID_START_GATE_PREVIEW');
    }
  }
  if (Number.isSafeInteger(active) !== true) {
    throw new TypeError('INVALID_START_GATE_PREVIEW');
  }
  if (active < 0) {
    throw new TypeError('INVALID_START_GATE_PREVIEW');
  }
  if (rateAvailable !== true && rateAvailable !== false) {
    throw new TypeError('INVALID_START_GATE_PREVIEW');
  }
  if (closed !== true && closed !== false) {
    throw new TypeError('INVALID_START_GATE_PREVIEW');
  }
  if (closed === true) {
    return { canStart: false, blockedBy: 'closed' };
  }
  if (rateAvailable === false) {
    return { canStart: false, blockedBy: 'rate' };
  }
  if (maxConcurrent !== null) {
    if (active >= maxConcurrent) {
      return { canStart: false, blockedBy: 'concurrency' };
    }
  }
  return { canStart: true, blockedBy: null };
}
