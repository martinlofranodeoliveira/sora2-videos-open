export function runFeature(payload) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload) === true) {
    throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
  }
  const topEntries = Object.entries(payload);
  if (topEntries.length !== 1) {
    throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
  }
  const topMap = new Map();
  for (const entry of topEntries) {
    const key = entry[0];
    const value = entry[1];
    if (typeof key !== "string") {
      throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
    }
    topMap.set(key, value);
  }
  if (topMap.has("pending") === false) {
    throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
  }
  if (topMap.size !== 1) {
    throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
  }
  const pending = topMap.get("pending");
  if (Array.isArray(pending) === false) {
    throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
  }
  if (pending.length < 0 || pending.length > 32) {
    throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
  }
  const pendingEntries = Object.entries(pending);
  if (pendingEntries.length !== pending.length) {
    throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
  }
  for (const element of pending) {
    if (typeof element !== "object" || element === null || Array.isArray(element) === true) {
      throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
    }
    const elementEntries = Object.entries(element);
    if (elementEntries.length !== 2) {
      throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
    }
    const elementMap = new Map();
    for (const elementEntry of elementEntries) {
      const elementKey = elementEntry[0];
      const elementValue = elementEntry[1];
      if (typeof elementKey !== "string") {
        throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
      }
      elementMap.set(elementKey, elementValue);
    }
    if (elementMap.has("id") === false) {
      throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
    }
    if (elementMap.has("priority") === false) {
      throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
    }
    if (elementMap.size !== 2) {
      throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
    }
    const id = elementMap.get("id");
    const priority = elementMap.get("priority");
    if (typeof id !== "string" || id.length < 1 || id.length > 128) {
      throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
    }
    if (typeof priority !== "string") {
      throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
    }
    if (priority !== "high" && priority !== "low") {
      throw new TypeError("INVALID_PRIORITY_ORDER_PREVIEW");
    }
  }
  const highIds = [];
  for (const element of pending) {
    const elementEntries = Object.entries(element);
    const elementMap = new Map();
    for (const elementEntry of elementEntries) {
      elementMap.set(elementEntry[0], elementEntry[1]);
    }
    const priority = elementMap.get("priority");
    const id = elementMap.get("id");
    if (priority === "high") {
      highIds.push(id);
    }
  }
  const lowIds = [];
  for (const element of pending) {
    const elementEntries = Object.entries(element);
    const elementMap = new Map();
    for (const elementEntry of elementEntries) {
      elementMap.set(elementEntry[0], elementEntry[1]);
    }
    const priority = elementMap.get("priority");
    const id = elementMap.get("id");
    if (priority === "low") {
      lowIds.push(id);
    }
  }
  const orderedIds = [];
  for (const value of highIds) {
    orderedIds.push(value);
  }
  for (const value of lowIds) {
    orderedIds.push(value);
  }
  return { orderedIds: orderedIds };
}
