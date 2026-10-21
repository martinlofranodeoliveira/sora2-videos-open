export function runFeature(payload) {
  if (typeof payload !== 'object') {
    throw new TypeError('INVALID_BATCH_INPUT');
  }
  if (payload === null) {
    throw new TypeError('INVALID_BATCH_INPUT');
  }
  if (Array.isArray(payload) === true) {
    throw new TypeError('INVALID_BATCH_INPUT');
  }
  const allowed = new Map();
  allowed.set('files', true);
  allowed.set('concurrency', true);
  allowed.set('timeout', true);
  const fields = new Map();
  for (const entry of Object.entries(payload)) {
    const key = entry[0];
    const value = entry[1];
    if (allowed.has(key) === false) {
      throw new TypeError('INVALID_BATCH_INPUT');
    }
    fields.set(key, value);
  }
  if (fields.has('files') === false) {
    throw new TypeError('INVALID_BATCH_INPUT');
  }
  const filesValue = fields.get('files');
  if (Array.isArray(filesValue) === false) {
    throw new TypeError('INVALID_BATCH_INPUT');
  }
  if (filesValue.length > 32) {
    throw new TypeError('INVALID_BATCH_INPUT');
  }
  const files = [];
  for (const item of filesValue) {
    if (typeof item !== 'string') {
      throw new TypeError('INVALID_BATCH_INPUT');
    }
    if (item.length < 1) {
      throw new TypeError('INVALID_BATCH_INPUT');
    }
    if (item.length > 4096) {
      throw new TypeError('INVALID_BATCH_INPUT');
    }
    files.push(item);
  }
  const concurrencyRaw = fields.get('concurrency');
  const concurrency = concurrencyRaw === undefined ? 2 : concurrencyRaw;
  if (Number.isSafeInteger(concurrency) === false) {
    throw new TypeError('INVALID_BATCH_INPUT');
  }
  if (concurrency < 1) {
    throw new TypeError('INVALID_BATCH_INPUT');
  }
  if (concurrency > 4) {
    throw new TypeError('INVALID_BATCH_INPUT');
  }
  const timeoutRaw = fields.get('timeout');
  const timeout = timeoutRaw === undefined ? 15000 : timeoutRaw;
  if (Number.isSafeInteger(timeout) === false) {
    throw new TypeError('INVALID_BATCH_INPUT');
  }
  if (timeout < 1) {
    throw new TypeError('INVALID_BATCH_INPUT');
  }
  if (timeout > 30000) {
    throw new TypeError('INVALID_BATCH_INPUT');
  }
  return { files, concurrency, timeout };
}
