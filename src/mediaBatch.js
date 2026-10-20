import { inspectVideo as defaultInspectVideo } from "./media.js";

const INVALID_MEDIA_BATCH_INPUT = "INVALID_MEDIA_BATCH_INPUT";
const INSPECTION_FAILED = "INSPECTION_FAILED";
const FORMAT_CODEC_RE = /^[A-Za-z0-9_,.-]+$/;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_TIMEOUT = 15000;

function invalid() {
  throw new TypeError(INVALID_MEDIA_BATCH_INPUT);
}

function isPlainOptionsObject(value) {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function projectVideo(raw) {
  if (raw === null || typeof raw !== "object") return null;
  let formatRaw;
  let durationRaw;
  let bytesRaw;
  let widthRaw;
  let heightRaw;
  let codecRaw;
  let audioRaw;
  try {
    formatRaw = raw.format;
    durationRaw = raw.durationSeconds;
    bytesRaw = raw.bytes;
    widthRaw = raw.width;
    heightRaw = raw.height;
    codecRaw = raw.codec;
    audioRaw = raw.audioStreams;
  } catch {
    return null;
  }
  let format;
  if (formatRaw === undefined || formatRaw === null) {
    format = null;
  } else if (typeof formatRaw === "string" && formatRaw.length >= 1 && formatRaw.length <= 128 && FORMAT_CODEC_RE.test(formatRaw)) {
    format = formatRaw;
  } else {
    return null;
  }
  let codec;
  if (codecRaw === undefined || codecRaw === null) {
    codec = null;
  } else if (typeof codecRaw === "string" && codecRaw.length >= 1 && codecRaw.length <= 128 && FORMAT_CODEC_RE.test(codecRaw)) {
    codec = codecRaw;
  } else {
    return null;
  }
  let durationSeconds;
  if (durationRaw === undefined || durationRaw === null) {
    durationSeconds = null;
  } else if (typeof durationRaw === "number" && Number.isFinite(durationRaw) && durationRaw >= 0) {
    durationSeconds = durationRaw;
  } else {
    return null;
  }
  let bytes;
  if (bytesRaw === undefined || bytesRaw === null) {
    bytes = null;
  } else if (Number.isSafeInteger(bytesRaw) && bytesRaw >= 0) {
    bytes = bytesRaw;
  } else {
    return null;
  }
  if (!Number.isSafeInteger(widthRaw) || widthRaw < 1 || widthRaw > 65535) return null;
  if (!Number.isSafeInteger(heightRaw) || heightRaw < 1 || heightRaw > 65535) return null;
  if (!Number.isSafeInteger(audioRaw) || audioRaw < 0 || audioRaw > 256) return null;
  return {
    format,
    durationSeconds,
    bytes,
    width: widthRaw,
    height: heightRaw,
    codec,
    audioStreams: audioRaw
  };
}

export async function inspectVideoBatch(files, options = {}) {
  if (!Array.isArray(files)) invalid();
  const count = files.length;
  if (!Number.isInteger(count) || count < 0 || count > 32) invalid();
  const inputs = new Array(count);
  for (let i = 0; i < count; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(files, i)) invalid();
    let value;
    try {
      value = files[i];
    } catch {
      invalid();
    }
    if (typeof value !== "string") invalid();
    if (value.length < 1 || value.length > 4096) invalid();
    if (value.includes("\0")) invalid();
    inputs[i] = value;
  }
  if (!isPlainOptionsObject(options)) invalid();
  const ownNames = Object.getOwnPropertyNames(options);
  let ownSymbols;
  try {
    ownSymbols = Object.getOwnPropertySymbols(options);
  } catch {
    invalid();
  }
  if (ownSymbols.length !== 0) invalid();
  const allowed = new Set(["inspector", "concurrency", "timeout"]);
  for (const key of ownNames) {
    if (!allowed.has(key)) invalid();
  }
  let inspectorRaw;
  let concurrencyRaw;
  let timeoutRaw;
  try {
    inspectorRaw = Object.prototype.hasOwnProperty.call(options, "inspector") ? options.inspector : undefined;
    concurrencyRaw = Object.prototype.hasOwnProperty.call(options, "concurrency") ? options.concurrency : undefined;
    timeoutRaw = Object.prototype.hasOwnProperty.call(options, "timeout") ? options.timeout : undefined;
  } catch {
    invalid();
  }
  let inspector = defaultInspectVideo;
  let concurrency = DEFAULT_CONCURRENCY;
  let timeout = DEFAULT_TIMEOUT;
  if (inspectorRaw !== undefined) {
    if (typeof inspectorRaw !== "function") invalid();
    inspector = inspectorRaw;
  }
  if (concurrencyRaw !== undefined) {
    if (!Number.isInteger(concurrencyRaw) || concurrencyRaw < 1 || concurrencyRaw > 4) invalid();
    concurrency = concurrencyRaw;
  }
  if (timeoutRaw !== undefined) {
    if (!Number.isInteger(timeoutRaw) || timeoutRaw < 1 || timeoutRaw > 30000) invalid();
    timeout = timeoutRaw;
  }
  if (count === 0) return [];
  const results = new Array(count);
  async function runEntry(idx) {
    const file = inputs[idx];
    let raw;
    try {
      raw = await inspector(file, { timeout });
    } catch {
      return { index: idx, status: "error", code: INSPECTION_FAILED };
    }
    try {
      const video = projectVideo(raw);
      if (video === null) return { index: idx, status: "error", code: INSPECTION_FAILED };
      return { index: idx, status: "ok", video };
    } catch {
      return { index: idx, status: "error", code: INSPECTION_FAILED };
    }
  }
  let cursor = 0;
  let inFlight = 0;
  let settled = 0;
  await new Promise((resolve) => {
    function onSettled(entry, idx) {
      results[idx] = entry;
      inFlight -= 1;
      settled += 1;
      if (settled === count) {
        resolve();
      } else {
        launch();
      }
    }
    function launch() {
      while (inFlight < concurrency && cursor < count) {
        const idx = cursor;
        cursor += 1;
        inFlight += 1;
        runEntry(idx).then(
          (entry) => onSettled(entry, idx),
          () => onSettled({ index: idx, status: "error", code: INSPECTION_FAILED }, idx)
        );
      }
    }
    launch();
  });
  return results;
}
