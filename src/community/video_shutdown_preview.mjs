export function runFeature(payload) {
  if (typeof payload !== "object") {
    throw new TypeError("INVALID_SHUTDOWN_PREVIEW");
  }
  if (payload === null) {
    throw new TypeError("INVALID_SHUTDOWN_PREVIEW");
  }
  if (Array.isArray(payload) === true) {
    throw new TypeError("INVALID_SHUTDOWN_PREVIEW");
  }
  const fieldMap = new Map();
  for (const entry of Object.entries(payload)) {
    const k = entry[0];
    const v = entry[1];
    if (k !== "name" && k !== "registered" && k !== "closed") {
      throw new TypeError("INVALID_SHUTDOWN_PREVIEW");
    }
    fieldMap.set(k, v);
  }
  if (fieldMap.size !== 3) {
    throw new TypeError("INVALID_SHUTDOWN_PREVIEW");
  }
  if (fieldMap.has("name") === false) {
    throw new TypeError("INVALID_SHUTDOWN_PREVIEW");
  }
  if (fieldMap.has("registered") === false) {
    throw new TypeError("INVALID_SHUTDOWN_PREVIEW");
  }
  if (fieldMap.has("closed") === false) {
    throw new TypeError("INVALID_SHUTDOWN_PREVIEW");
  }
  const nameValue = fieldMap.get("name");
  const registeredValue = fieldMap.get("registered");
  const closedValue = fieldMap.get("closed");
  if (isValidName(nameValue) === false) {
    throw new TypeError("INVALID_SHUTDOWN_PREVIEW");
  }
  if (isValidList(registeredValue) === false) {
    throw new TypeError("INVALID_SHUTDOWN_PREVIEW");
  }
  if (isValidList(closedValue) === false) {
    throw new TypeError("INVALID_SHUTDOWN_PREVIEW");
  }
  if (isPresent(nameValue, registeredValue) === false) {
    return { result: false, reason: "unknown" };
  }
  if (isPresent(nameValue, closedValue) === true) {
    return { result: false, reason: "already-closed" };
  }
  return { result: true, reason: "will-close" };
}
function isValidName(value) {
  if (typeof value !== "string") {
    return false;
  }
  if (value.length < 1) {
    return false;
  }
  if (value.length > 40) {
    return false;
  }
  const bad = [];
  for (const entry of Object.entries(value)) {
    const idx = entry[0];
    const ch = entry[1];
    if (idx === "0") {
      const okFirst = ch >= "a" && ch <= "z";
      if (okFirst === false) {
        bad.push(idx);
      }
    } else {
      const isLower = ch >= "a" && ch <= "z";
      const isDigit = ch >= "0" && ch <= "9";
      const isHyphen = ch === "-";
      if (isLower === false && isDigit === false && isHyphen === false) {
        bad.push(idx);
      }
    }
  }
  if (bad.length !== 0) {
    return false;
  }
  return true;
}
function isValidList(arr) {
  if (Array.isArray(arr) === false) {
    return false;
  }
  if (arr.length > 32) {
    return false;
  }
  const entries = Object.entries(arr);
  if (entries.length !== arr.length) {
    return false;
  }
  const bad = [];
  for (const item of Object.values(arr)) {
    if (isValidName(item) === false) {
      bad.push("x");
    }
  }
  if (bad.length !== 0) {
    return false;
  }
  return true;
}
function isPresent(target, list) {
  for (const item of Object.values(list)) {
    if (item === target) {
      return true;
    }
  }
  return false;
}
