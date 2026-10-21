export function runFeature(payload) {
  if (payload === null) {
    throw new TypeError("INVALID_PROVIDER_NAME_PREVIEW");
  }
  if (typeof payload !== "object") {
    throw new TypeError("INVALID_PROVIDER_NAME_PREVIEW");
  }
  if (Array.isArray(payload)) {
    throw new TypeError("INVALID_PROVIDER_NAME_PREVIEW");
  }
  const entries = Object.entries(payload);
  if (entries.length !== 1) {
    throw new TypeError("INVALID_PROVIDER_NAME_PREVIEW");
  }
  const store = new Map();
  for (const entry of entries) {
    const ky = entry[0];
    const vl = entry[1];
    if (ky !== "name") {
      throw new TypeError("INVALID_PROVIDER_NAME_PREVIEW");
    }
    store.set(ky, vl);
  }
  const chosen = store.get("name");
  if (typeof chosen !== "string") {
    throw new TypeError("INVALID_PROVIDER_NAME_PREVIEW");
  }
  const total = chosen.length;
  if (total < 1) {
    throw new TypeError("INVALID_PROVIDER_NAME_PREVIEW");
  }
  if (total > 40) {
    throw new TypeError("INVALID_PROVIDER_NAME_PREVIEW");
  }
  if (Number.isSafeInteger(total) === false) {
    throw new TypeError("INVALID_PROVIDER_NAME_PREVIEW");
  }
  const firstCode = chosen.charCodeAt(0);
  if (firstCode < 97) {
    throw new TypeError("INVALID_PROVIDER_NAME_PREVIEW");
  }
  if (firstCode > 122) {
    throw new TypeError("INVALID_PROVIDER_NAME_PREVIEW");
  }
  for (const ch of chosen) {
    const code = ch.charCodeAt(0);
    const isHyphen = code === 45;
    const isDigit = code >= 48 && code <= 57;
    const isLower = code >= 97 && code <= 122;
    if (isHyphen === false) {
      if (isDigit === false) {
        if (isLower === false) {
          throw new TypeError("INVALID_PROVIDER_NAME_PREVIEW");
        }
      }
    }
  }
  return { name: chosen, length: total };
}
