import { randomUUID } from "node:crypto";
import { configureGenerationQueue, scheduleGeneration, shutdownGenerationQueue } from "./generationQueue.js";

/** In-memory orchestration. Providers receive only the validated public job spec. */
export class VideoJobs {
  #jobs = new Map();
  #providers = new Map();
  #queuePrefix = randomUUID();

  constructor({ maxJobs = 1000 } = {}) {
    if (!Number.isSafeInteger(maxJobs) || maxJobs < 1) throw new TypeError("maxJobs must be a positive integer");
    this.maxJobs = maxJobs;
  }

  register(name, execute, { startsPerMinute = 10, maxConcurrent } = {}) {
    if (typeof name !== "string" || !/^[a-z][a-z0-9-]{0,39}$/.test(name)) throw new TypeError("Invalid provider name");
    if (typeof execute !== "function") throw new TypeError("A provider must be a function");
    if (!Number.isSafeInteger(startsPerMinute) || startsPerMinute < 1) throw new TypeError("startsPerMinute must be a positive integer");
    if (this.#providers.has(name)) throw new Error("Provider is already registered");
    const queue = `${this.#queuePrefix}:${name}`;
    const rateQueue = configureGenerationQueue(queue, { limitPerMinute: startsPerMinute, maxConcurrent, label: name });
    this.#providers.set(name, { execute, queue, rateQueue });
    return this;
  }

  shutdown(name) {
    if (typeof name !== "string" || !/^[a-z][a-z0-9-]{0,39}$/.test(name)) throw new TypeError("Invalid provider name");
    const adapter = this.#providers.get(name);
    return adapter ? shutdownGenerationQueue(adapter.queue) : false;
  }

  submit({ provider, prompt, seconds = 8, size = "1280x720" } = {}, { signal } = {}) {
    const adapter = this.#providers.get(provider);
    if (!adapter) throw new Error("Unknown provider");
    if (adapter.rateQueue.closed) {
      const error = new Error("Generation queue is shut down");
      error.code = "QUEUE_SHUTDOWN";
      throw error;
    }
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 10000) throw new TypeError("prompt must contain 1–10000 characters");
    if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 120) throw new TypeError("seconds must be an integer between 1 and 120");
    if (typeof size !== "string") throw new TypeError("size must be WIDTHxHEIGHT");
    const dimensions = size.split("x");
    if (dimensions.length !== 2) throw new TypeError("size must be WIDTHxHEIGHT");
    const [widthText, heightText] = dimensions;
    if (!/^[0-9]{2,4}$/.test(widthText) || !/^[0-9]{2,4}$/.test(heightText)) throw new TypeError("size must be WIDTHxHEIGHT");
    if (`${widthText}x${heightText}` !== size) throw new TypeError("size must be WIDTHxHEIGHT");
    const [width, height] = [Number(widthText), Number(heightText)];
    if (width < 64 || height < 64 || width > 4096 || height > 4096) throw new TypeError("Dimensions must be between 64 and 4096 pixels");
    if (this.#jobs.size >= this.maxJobs) throw new Error("Job capacity reached; forget a completed job first");
    const id = randomUUID();
    const spec = Object.freeze({ prompt: prompt.trim(), seconds, size });
    const record = { id, provider, spec, status: "queued", createdAt: new Date().toISOString() };
    this.#jobs.set(id, record);
    const done = scheduleGeneration(adapter.queue, { signal, execute: async () => {
      record.status = "running";
      try {
        const value = await adapter.execute(spec, { signal });
        // Only a safe serializable result envelope is retained, not provider config.
        const serialized = JSON.stringify(value);
        if (!serialized || Buffer.byteLength(serialized) > 65536) throw new Error("Provider result must be serializable and at most 64 KiB");
        record.result = JSON.parse(serialized);
        record.status = "completed";
        return this.get(id);
      } catch {
        record.status = signal?.aborted ? "cancelled" : "failed";
        record.error = "Provider operation failed";
        throw new Error(record.error);
      }
    }}).catch((error) => {
      if (record.status === "queued") { record.status = "cancelled"; record.error = "Queued operation cancelled"; }
      throw new Error(record.error || "Video operation failed", { cause: undefined });
    });
    // The caller may choose to await done later; prevent unhandled rejections meanwhile.
    done.catch(() => {});
    return { id, done };
  }

  get(id) {
    const record = this.#jobs.get(id);
    return record ? structuredClone(record) : undefined;
  }

  list() { return [...this.#jobs.keys()].map((id) => this.get(id)); }

  forget(id) {
    const record = this.#jobs.get(id);
    if (record && ["queued", "running"].includes(record.status)) throw new Error("Cannot forget an active job");
    return this.#jobs.delete(id);
  }
}
