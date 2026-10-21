export function runFeature(payload) {
  if (payload === null) {
    throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
  }
  if (typeof payload !== 'object') {
    throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
  }
  if (Array.isArray(payload) === true) {
    throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
  }
  const topPairs = Object.entries(payload);
  if (topPairs.length !== 1) {
    throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
  }
  const holder = new Map();
  holder.set('entries', null);
  holder.set('ready', 0);
  for (const pair of Object.entries(payload)) {
    const topKey = pair[0];
    if (topKey !== 'entries') {
      throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
    }
    const topVal = pair[1];
    holder.set('entries', topVal);
    holder.set('ready', 1);
  }
  if (holder.get('ready') !== 1) {
    throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
  }
  const entries = holder.get('entries');
  if (Array.isArray(entries) === false) {
    throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
  }
  if (entries.length > 32) {
    throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
  }
  const densePairs = Object.entries(entries);
  if (densePairs.length !== entries.length) {
    throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
  }
  const counts = new Map();
  counts.set('ok', 0);
  counts.set('errors', 0);
  for (const element of entries) {
    if (element === null) {
      throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
    }
    if (typeof element !== 'object') {
      throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
    }
    if (Array.isArray(element) === true) {
      throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
    }
    const statusBox = new Map();
    statusBox.set('found', 0);
    statusBox.set('value', null);
    for (const innerPair of Object.entries(element)) {
      const innerKey = innerPair[0];
      if (innerKey !== 'status') {
        continue;
      }
      const innerVal = innerPair[1];
      statusBox.set('value', innerVal);
      statusBox.set('found', 1);
    }
    if (statusBox.get('found') !== 1) {
      throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
    }
    const status = statusBox.get('value');
    if (typeof status !== 'string') {
      throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
    }
    if (status !== 'ok') {
      if (status !== 'error') {
        throw new TypeError('INVALID_BATCH_SUMMARY_PREVIEW');
      }
    }
    if (status === 'ok') {
      counts.set('ok', counts.get('ok') + 1);
    }
    if (status === 'error') {
      counts.set('errors', counts.get('errors') + 1);
    }
  }
  return {
    total: entries.length,
    ok: counts.get('ok'),
    errors: counts.get('errors')
  };
}
