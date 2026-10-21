export function runFeature(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("INVALID_FORGET_PREVIEW");
  }
  const collected = new Map();
  for (const entry of Object.entries(payload)) {
    collected.set(entry[0], entry[1]);
  }
  if (collected.size !== 1) {
    throw new TypeError("INVALID_FORGET_PREVIEW");
  }
  if (collected.has("status") === false) {
    throw new TypeError("INVALID_FORGET_PREVIEW");
  }
  const status = collected.get("status");
  if (typeof status !== "string") {
    throw new TypeError("INVALID_FORGET_PREVIEW");
  }
  const allowed = new Map();
  allowed.set("queued", true);
  allowed.set("running", true);
  allowed.set("completed", true);
  allowed.set("failed", true);
  allowed.set("cancelled", true);
  if (allowed.has(status) === false) {
    throw new TypeError("INVALID_FORGET_PREVIEW");
  }
  const terminal = new Map();
  terminal.set("completed", true);
  terminal.set("failed", true);
  terminal.set("cancelled", true);
  const canForget = terminal.has(status);
  const active = new Map();
  active.set("queued", true);
  active.set("running", true);
  const isActive = active.has(status);
  const isTerminal = canForget;
  return { status: status, canForget: canForget, isActive: isActive, isTerminal: isTerminal };
}
