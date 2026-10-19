const ONE_MINUTE_MS = 60 * 1000;

function shutdownError() {
  const error = new Error("Generation queue is shut down");
  error.code = "QUEUE_SHUTDOWN";
  return error;
}

export const GenerationQueuePriority = Object.freeze({
  HIGH: "high",
  LOW: "low",
});

class ProviderRateQueue {
  constructor({ label, limitPerMinute, maxConcurrent }) {
    this.label = label ?? "queue";
    this.limitPerMinute = ProviderRateQueue.normalizeLimit(limitPerMinute);
    this.maxConcurrent = ProviderRateQueue.normalizeConcurrency(maxConcurrent);
    this.active = 0;
    this.recentStarts = [];
    this.highQueue = [];
    this.lowQueue = [];
    this.timer = null;
    this.processing = false;
    this.closed = false;
  }

  static normalizeLimit(limit) {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 1;
    }
    return Math.max(1, Math.floor(parsed));
  }

  static normalizeConcurrency(limit) {
    if (limit === undefined) return Infinity;
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new TypeError("maxConcurrent must be a positive integer");
    }
    return limit;
  }

  setLimit(limit) {
    this.setLimits(ProviderRateQueue.normalizeLimit(limit), this.maxConcurrent);
  }

  setLimits(limitPerMinute, maxConcurrent) {
    if (this.closed) throw shutdownError();
    // Apply both limits before draining: a lower concurrency cap must not race
    // with starts released by a higher per-minute rate.
    this.limitPerMinute = limitPerMinute;
    this.maxConcurrent = maxConcurrent;
    this.process();
  }

  enqueue(execute, options = {}) {
    if (typeof execute !== "function") {
      throw new Error("enqueue requires an executable function");
    }
    if (this.closed) return Promise.reject(shutdownError());

    const priority =
      options.priority === GenerationQueuePriority.HIGH
        ? GenerationQueuePriority.HIGH
        : GenerationQueuePriority.LOW;

    const entry = {
      execute,
      priority,
      enqueuedAt: Date.now(),
      cancelled: false,
      started: false,
      cleanupAbort: null,
    };

    return new Promise((resolve, reject) => {
      entry.resolve = resolve;
      entry.reject = reject;

      const { signal } = options;
      if (signal) {
        if (signal.aborted) {
          entry.cancelled = true;
          reject(signal.reason ?? new Error("Operação cancelada antes de entrar na fila."));
          return;
        }

        const abortHandler = () => {
          if (entry.started) {
            return;
          }
          entry.cancelled = true;
          this.removeEntry(entry);
          entry.cleanupAbort?.();
          const abortError =
            signal.reason instanceof Error
              ? signal.reason
              : new Error("Operação cancelada enquanto aguardava na fila.");
          reject(abortError);
          this.process();
        };

        signal.addEventListener("abort", abortHandler, { once: true });
        entry.cleanupAbort = () => {
          signal.removeEventListener("abort", abortHandler);
        };
      }

      if (priority === GenerationQueuePriority.HIGH) {
        this.highQueue.push(entry);
      } else {
        this.lowQueue.push(entry);
      }

      this.process();
    });
  }

  shutdown() {
    if (this.closed) return false;
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;

    // Remove the entries before rejecting them. Running entries, including
    // reserved slots whose execute microtask has not run yet, remain intact.
    const pending = [...this.highQueue, ...this.lowQueue];
    this.highQueue = [];
    this.lowQueue = [];
    for (const entry of pending) {
      entry.cancelled = true;
      entry.cleanupAbort?.();
      entry.cleanupAbort = null;
      entry.reject(shutdownError());
    }
    return true;
  }

  removeEntry(entry) {
    const removeFrom = (queue) => {
      const index = queue.indexOf(entry);
      if (index !== -1) {
        queue.splice(index, 1);
        return true;
      }
      return false;
    };

    if (removeFrom(this.highQueue)) {
      return true;
    }
    return removeFrom(this.lowQueue);
  }

  cleanupTimestamps() {
    if (!this.recentStarts.length) {
      return;
    }
    const cutoff = Date.now() - ONE_MINUTE_MS;
    while (this.recentStarts.length && this.recentStarts[0] <= cutoff) {
      this.recentStarts.shift();
    }
  }

  pendingEntries() {
    return this.highQueue.length + this.lowQueue.length;
  }

  canStartAnother() {
    return this.active < this.maxConcurrent && this.recentStarts.length < this.limitPerMinute;
  }

  nextEntry() {
    while (this.highQueue.length) {
      const entry = this.highQueue.shift();
      if (!entry || entry.cancelled) {
        continue;
      }
      return entry;
    }
    while (this.lowQueue.length) {
      const entry = this.lowQueue.shift();
      if (!entry || entry.cancelled) {
        continue;
      }
      return entry;
    }
    return null;
  }

  startEntry(entry) {
    entry.started = true;
    entry.cleanupAbort?.();
    entry.cleanupAbort = null;
    this.active += 1;
    this.recentStarts.push(Date.now());

    Promise.resolve()
      .then(() => entry.execute())
      .finally(() => {
        this.active -= 1;
        this.process();
      })
      .then(entry.resolve, entry.reject);
  }

  scheduleTimerIfNeeded() {
    if (this.closed) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      return;
    }
    // Completion wakes a queue with no free slots. A timer in that state is
    // unnecessary, and can spin at 0 ms after the rate window expires.
    const waitingForRate = this.pendingEntries() > 0
      && this.active < this.maxConcurrent
      && this.recentStarts.length >= this.limitPerMinute;
    if (this.timer) {
      if (!waitingForRate) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      return;
    }

    if (!waitingForRate || !this.recentStarts.length) {
      return;
    }

    const now = Date.now();
    const oldestStart = this.recentStarts[0];
    const delay = Math.max(0, oldestStart + ONE_MINUTE_MS - now);

    this.timer = setTimeout(() => {
      this.timer = null;
      this.process();
    }, delay || 0);

    // Pending work must keep a standalone Node process alive.
  }

  process() {
    if (this.closed || this.processing) {
      return;
    }

    this.processing = true;
    try {
      this.cleanupTimestamps();
      while (this.canStartAnother()) {
        const entry = this.nextEntry();
        if (!entry) {
          break;
        }
        this.startEntry(entry);
      }
    } finally {
      this.processing = false;
    }

    this.scheduleTimerIfNeeded();
  }

  snapshot() {
    return {
      label: this.label,
      limitPerMinute: this.limitPerMinute,
      maxConcurrent: Number.isFinite(this.maxConcurrent) ? this.maxConcurrent : null,
      active: this.active,
      closed: this.closed,
      recentStarts: this.recentStarts.length,
      highQueue: this.highQueue.length,
      lowQueue: this.lowQueue.length,
      pending: this.pendingEntries(),
    };
  }
}

const providerQueues = new Map();

export function configureGenerationQueue(providerType, options = {}) {
  if (!providerType || typeof providerType !== "string") {
    throw new Error("providerType is required to configure a generation queue");
  }

  let queue = providerQueues.get(providerType);
  if (queue?.closed) throw shutdownError();
  const limitPerMinute = ProviderRateQueue.normalizeLimit(options.limitPerMinute ?? 1);
  const label = options.label ?? providerType;
  // Omitting this option keeps an existing cap; new queues remain unlimited.
  const maxConcurrent = options.maxConcurrent === undefined
    ? (queue?.maxConcurrent ?? Infinity)
    : ProviderRateQueue.normalizeConcurrency(options.maxConcurrent);

  if (!queue) {
    queue = new ProviderRateQueue({ label, limitPerMinute,
      maxConcurrent: Number.isFinite(maxConcurrent) ? maxConcurrent : undefined });
    providerQueues.set(providerType, queue);
  } else {
    queue.label = label;
    queue.setLimits(limitPerMinute, maxConcurrent);
  }

  return queue;
}

export function scheduleGeneration(providerType, options = {}) {
  const queue = providerQueues.get(providerType);
  if (!queue) {
    throw new Error(`Generation queue not configured for provider '${providerType}'.`);
  }

  const execute = options.execute;
  if (typeof execute !== "function") {
    throw new Error("scheduleGeneration requires an executable function");
  }

  return queue.enqueue(execute, {
    priority: options.priority,
    signal: options.signal,
  });
}

export function shutdownGenerationQueue(providerType) {
  if (typeof providerType !== "string" || providerType.length === 0) {
    throw new TypeError("providerType must be a nonempty string");
  }
  return providerQueues.get(providerType)?.shutdown() ?? false;
}

export function getGenerationQueueSnapshot() {
  const snapshot = {};
  for (const [providerType, queue] of providerQueues.entries()) {
    // Define an own property so legal names such as __proto__ remain ordinary
    // JSON keys instead of invoking Object.prototype's legacy setter.
    Object.defineProperty(snapshot, providerType, {
      value: queue.snapshot(), enumerable: true, configurable: true, writable: true,
    });
  }
  return snapshot;
}

export default {
  configureGenerationQueue,
  scheduleGeneration,
  shutdownGenerationQueue,
  getGenerationQueueSnapshot,
  GenerationQueuePriority,
};
