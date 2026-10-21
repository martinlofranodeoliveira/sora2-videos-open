export function runFeature(payload) {
  if (payload === null) {
    throw new TypeError("INVALID_INSPECTION_INPUT");
  }
  if (typeof payload !== "object") {
    throw new TypeError("INVALID_INSPECTION_INPUT");
  }
  if (Array.isArray(payload)) {
    throw new TypeError("INVALID_INSPECTION_INPUT");
  }
  const outerKeys = Object.keys(payload);
  if (outerKeys.length !== 1) {
    throw new TypeError("INVALID_INSPECTION_INPUT");
  }
  const onlyKey = outerKeys[0];
  if (onlyKey !== "raw") {
    throw new TypeError("INVALID_INSPECTION_INPUT");
  }
  const raw = payload.raw;
  if (raw === null) {
    return { status: "error", code: "INSPECTION_FAILED" };
  }
  if (typeof raw !== "object") {
    return { status: "error", code: "INSPECTION_FAILED" };
  }
  if (Array.isArray(raw)) {
    return { status: "error", code: "INSPECTION_FAILED" };
  }
  const formatRaw = raw.format;
  const durationRaw = raw.durationSeconds;
  const bytesRaw = raw.bytes;
  const widthRaw = raw.width;
  const heightRaw = raw.height;
  const codecRaw = raw.codec;
  const audioRaw = raw.audioStreams;
  if (formatRaw !== undefined && formatRaw !== null) {
    if (typeof formatRaw !== "string") {
      return { status: "error", code: "INSPECTION_FAILED" };
    }
    if (formatRaw.length < 1) {
      return { status: "error", code: "INSPECTION_FAILED" };
    }
    if (formatRaw.length > 32) {
      return { status: "error", code: "INSPECTION_FAILED" };
    }
  }
  if (codecRaw !== undefined && codecRaw !== null) {
    if (typeof codecRaw !== "string") {
      return { status: "error", code: "INSPECTION_FAILED" };
    }
    if (codecRaw.length < 1) {
      return { status: "error", code: "INSPECTION_FAILED" };
    }
    if (codecRaw.length > 32) {
      return { status: "error", code: "INSPECTION_FAILED" };
    }
  }
  if (durationRaw !== undefined && durationRaw !== null) {
    if (Number.isFinite(durationRaw) === false) {
      return { status: "error", code: "INSPECTION_FAILED" };
    }
    if (durationRaw <= 0) {
      return { status: "error", code: "INSPECTION_FAILED" };
    }
    if (durationRaw > 86400) {
      return { status: "error", code: "INSPECTION_FAILED" };
    }
  }
  if (bytesRaw !== undefined && bytesRaw !== null) {
    if (Number.isSafeInteger(bytesRaw) === false) {
      return { status: "error", code: "INSPECTION_FAILED" };
    }
    if (bytesRaw < 0) {
      return { status: "error", code: "INSPECTION_FAILED" };
    }
    if (bytesRaw > 9007199254740991) {
      return { status: "error", code: "INSPECTION_FAILED" };
    }
  }
  if (Number.isSafeInteger(widthRaw) === false) {
    return { status: "error", code: "INSPECTION_FAILED" };
  }
  if (widthRaw < 1) {
    return { status: "error", code: "INSPECTION_FAILED" };
  }
  if (widthRaw > 8192) {
    return { status: "error", code: "INSPECTION_FAILED" };
  }
  if (Number.isSafeInteger(heightRaw) === false) {
    return { status: "error", code: "INSPECTION_FAILED" };
  }
  if (heightRaw < 1) {
    return { status: "error", code: "INSPECTION_FAILED" };
  }
  if (heightRaw > 8192) {
    return { status: "error", code: "INSPECTION_FAILED" };
  }
  if (Number.isSafeInteger(audioRaw) === false) {
    return { status: "error", code: "INSPECTION_FAILED" };
  }
  if (audioRaw < 0) {
    return { status: "error", code: "INSPECTION_FAILED" };
  }
  if (audioRaw > 32) {
    return { status: "error", code: "INSPECTION_FAILED" };
  }
  const format = formatRaw === undefined ? null : formatRaw === null ? null : formatRaw;
  const durationSeconds = durationRaw === undefined ? null : durationRaw === null ? null : durationRaw;
  const bytes = bytesRaw === undefined ? null : bytesRaw === null ? null : bytesRaw;
  const width = widthRaw;
  const height = heightRaw;
  const codec = codecRaw === undefined ? null : codecRaw === null ? null : codecRaw;
  const audioStreams = audioRaw;
  return {
    status: "ok",
    video: {
      format: format,
      durationSeconds: durationSeconds,
      bytes: bytes,
      width: width,
      height: height,
      codec: codec,
      audioStreams: audioStreams
    }
  };
}
