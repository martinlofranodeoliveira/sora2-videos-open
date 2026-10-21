export function runFeature(payload) {
  if (payload === null) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  if (typeof payload !== 'object') {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  if (Array.isArray(payload) === true) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  for (const entry of Object.entries(payload)) {
    const key = entry[0];
    if (key !== 'provider' && key !== 'prompt' && key !== 'seconds' && key !== 'size') {
      throw new TypeError('INVALID_JOB_SPEC');
    }
  }
  const providerValue = payload.provider;
  if (typeof providerValue !== 'string') {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  if (/^[a-z][a-z0-9-]{0,39}$/.test(providerValue) === false) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  const promptValue = payload.prompt;
  if (typeof promptValue !== 'string') {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  if (promptValue.length < 1 || promptValue.length > 10000) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  const trimmedPrompt = promptValue.trim();
  if (trimmedPrompt.length < 1) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  const rawSeconds = payload.seconds;
  const effectiveSeconds = rawSeconds === undefined ? 8 : rawSeconds;
  if (Number.isSafeInteger(effectiveSeconds) === false) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  if (effectiveSeconds < 1 || effectiveSeconds > 120) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  const rawSize = payload.size;
  const effectiveSize = rawSize === undefined ? '1280x720' : rawSize;
  if (typeof effectiveSize !== 'string') {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  const sizeParts = effectiveSize.split('x');
  if (sizeParts.length !== 2) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  const widthText = sizeParts[0];
  const heightText = sizeParts[1];
  if (/^[0-9]{2,4}$/.test(widthText) === false) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  if (/^[0-9]{2,4}$/.test(heightText) === false) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  const rebuiltSize = widthText + 'x' + heightText;
  if (rebuiltSize !== effectiveSize) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  const widthNumber = Number(widthText);
  const heightNumber = Number(heightText);
  if (Number.isSafeInteger(widthNumber) === false) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  if (Number.isSafeInteger(heightNumber) === false) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  if (widthNumber < 64 || widthNumber > 4096) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  if (heightNumber < 64 || heightNumber > 4096) {
    throw new TypeError('INVALID_JOB_SPEC');
  }
  return {
    provider: providerValue,
    prompt: trimmedPrompt,
    seconds: effectiveSeconds,
    size: effectiveSize
  };
}
