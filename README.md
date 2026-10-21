# Sora2 Videos Open

An independent MIT-licensed **video pipeline toolkit**, extracted and cleaned
from the owner's Sora2 Videos application. It provides per-provider rate queues,
job lifecycle tracking and local video inspection. It is not the original
commercial website or an official OpenAI SDK.

OpenAI retired Sora 2 and the Videos API on **September 24, 2026**. See the
[official deprecation notice](https://developers.openai.com/api/docs/deprecations#2026-03-24-sora-2-video-generation-models-and-videos-api).
This release therefore uses a provider-neutral interface. No working Sora 2
service, free video generation or external account is promised.

## Run

Node.js 22 or newer; no npm dependencies are required.

```sh
git clone https://github.com/martinlofranodeoliveira/sora2-videos-open.git
cd sora2-videos-open
npm test
npm run demo
node bin/video-workbench.js inspect /path/to/video.mp4
```

`demo` is explicitly a simulation and makes no network requests. `inspect` uses
a separately installed `ffprobe` to read an actual local video without uploading
it. Only local file protocols are enabled. No media files are distributed here.

## Use your own provider

```js
import { VideoJobs } from './src/index.js';
const jobs = new VideoJobs().register('my-provider', async (spec, { signal }) => {
  // Call a service or local generator you control here. Keep credentials private.
  // Return only a safe serializable result, such as a local output identifier.
  return { outputId: 'your-real-output-id' };
}, { startsPerMinute: 10, maxConcurrent: 2 });
const operation = jobs.submit({ provider: 'my-provider', prompt: 'A quiet forest', seconds: 8 });
const completed = await operation.done;
```

The example adapter is a placeholder: replace it with your real implementation.
Job records are in memory; they do not survive restart. Completed records can be
removed with `forget(id)`. Pending jobs can be cancelled with an `AbortSignal`;
running adapters must honor the supplied signal themselves. Caller-provided
adapters are trusted code and must return sanitized results. A maximum record
count bounds retention; large video data belongs in files, not job metadata.

`submit` requires `size` to be a primitive string exactly `WIDTHxHEIGHT` with
ASCII digits (2-4 digits per side, 64-4096 pixels each). Whitespace, line
terminators (`\r`, `\n`, `\u2028`, `\u2029`) or coerced objects throw
`TypeError` before a record is created or anything is enqueued. Validating
dimensions does not validate provider capability: providers enforce their own
supported resolutions and may reject a well-formed size.

## Rate and concurrency limits

`VideoJobs.register(name, adapter, options)` accepts two independent provider
limits:

- `startsPerMinute`: positive integer, default `10`. Bounds starts in a rolling
  60-second window. Completed or failed jobs still consume that start budget.
- `maxConcurrent`: optional positive safe integer. Bounds adapter calls still
  waiting for a result. A call keeps its slot until its returned promise settles,
  including rejection. Omitting this option preserves the previous behavior:
  unlimited simultaneous calls within the per-minute start budget. Set a cap
  explicitly for providers or local generators that have limited capacity.

Both limits must permit a start. A concurrency slot does not bypass an exhausted
rate budget; a queued cancellation consumes neither a slot nor a start. The
queue prioritizes pending high-priority entries before pending low-priority
entries, retaining FIFO order within each priority. Running calls are never
preempted. Cancellation of a running call is cooperative: its adapter must
settle its promise before the slot can be reused.

The raw queue API also accepts `maxConcurrent`:

```js
import {
  configureGenerationQueue,
  scheduleGeneration,
  getGenerationQueueSnapshot,
  GenerationQueuePriority,
} from './src/index.js';

configureGenerationQueue('renderer', { limitPerMinute: 10, maxConcurrent: 2 });
const result = await scheduleGeneration('renderer', {
  priority: GenerationQueuePriority.HIGH,
  execute: () => renderYourLocalVideo(), // Supply your own implementation.
});
console.log(getGenerationQueueSnapshot().renderer);
```

Calling `configureGenerationQueue` again updates an existing open queue atomically.
Increasing its cap can immediately start pending work if rate budget remains.
Lowering its cap leaves running work intact and blocks further starts until the
active count falls below the new cap. Omitting `maxConcurrent` on an existing
queue keeps its cap; a new queue starts unlimited. Raw `limitPerMinute` retains
its existing default and normalization rules: omitted or invalid values become
`1`, and positive fractions are rounded down to at least `1`.

The snapshot includes `active` (occupied slots), `maxConcurrent` (`null` for
unlimited), and `closed`, alongside the existing rate and pending counts.
Snapshots remain JSON serializable, including raw names such as `__proto__`.
Invalid concurrency caps, including `0`, fractions, numeric
strings, `null`, or `Infinity`, throw `TypeError` without changing the queue.
When only concurrency blocks progress, completion wakes the queue without a
polling timer. Rate-blocked pending work retains a referenced timer so a
standalone Node process stays alive until it can start.

The regression suite uses simulated adapters and controlled promises to cover
slot bounds, cancellation, rejection, reconfiguration and priority. A mock clock
tests the full rate window without waiting a real minute. These tests do not
generate videos or contact a provider.

## Shut down a provider

`VideoJobs.shutdown(name)` closes one registered provider in that manager:

```js
const closed = jobs.shutdown('my-provider');
// Await the done promises you already hold to observe their final outcomes.
```

It returns `true` on the first closure and `false` for an unknown or already
closed provider. Invalid names throw `TypeError`, using the same name rules as
`register`. Pending operations are removed from the queue, their abort listeners
are detached, and their `done` promises reject with `Queued operation cancelled`.
Their records become `cancelled` as those rejections settle. A later `submit`
throws an error with code `QUEUE_SHUTDOWN` before creating a job record, including
when the record capacity is full. Closure affects neither other providers nor
providers registered on another `VideoJobs` instance.

Running operations keep their slots and original outcomes. A slot is reserved
synchronously during scheduling, before the adapter's execution microtask. Such
an operation can still enter its adapter after shutdown, even if its job record
currently says `queued`. Shutdown cancels only operations that have not received
a slot; it does not abort signals or forcibly interrupt adapters. Running
cancellation remains cooperative.

The raw API exports `shutdownGenerationQueue(providerType)`, with the same
`true`/`false` result. It accepts any nonempty string literally; invalid inputs
throw `TypeError`. Pending and future raw queue operations reject with a generic
error whose code is `QUEUE_SHUTDOWN`. Closing a queue clears its rate timer;
later completions and timer callbacks cannot restart it. This can let a
standalone process exit once its other work has settled.

Closure is terminal: reconfiguring a closed raw queue throws `QUEUE_SHUTDOWN`,
and re-registering a provider on the same manager remains a duplicate error.
There is no reopen or registry-pruning operation. Closed queues remain visible
in snapshots with `closed: true`, their active count and retained start history;
shutdown does not erase history or release registry entries. Terminal job
records can still be removed with `forget(id)`. A new manager creates its own
queue namespace and independent limits.

Shutdown tests use controlled adapters, mock clocks, and a short child-process
exit check. They exercise pending priorities, timer/listener cleanup, reserved
slots, rejection redaction and isolation without contacting providers.

## Batch video inspection

`inspectVideoBatch(files, options)` inspects a small batch of local video paths with bounded parallelism. It is a thin batch wrapper around `inspectVideo`; it adds no shell, program execution, file reading or network of its own.

```js
import { inspectVideoBatch } from './src/index.js';

// Entirely synthetic injected inspector used for docs and tests.
const syntheticInspector = async (file, { timeout }) => ({
  format: 'mp4',
  durationSeconds: 1.5,
  bytes: 42,
  width: 640,
  height: 480,
  codec: 'h264',
  audioStreams: 1
});

const results = await inspectVideoBatch(['clip-a.mp4', 'clip-b.mp4'], {
  inspector: syntheticInspector,
  concurrency: 2,
  timeout: 5000
});

for (const entry of results) {
  if (entry.status === 'ok') {
    console.log(entry.index, entry.video.width, entry.video.height);
  } else {
    console.log(entry.index, entry.code); // always 'INSPECTION_FAILED'
  }
}
```

Scope and limits:

- `files` is a dense `Array` (every index has its own property) with 0 to 32 primitive strings, each 1 to 4096 UTF-16 units and without `NUL`. Duplicates are inspected once per occurrence in index order; entries are never deduplicated or coerced.
- `options` must be a plain object (`Object.prototype` or `null` prototype) containing only `inspector`, `concurrency` and `timeout`. `undefined` values use defaults. Any other string or symbol key, array, `null` or other prototype rejects with `TypeError('INVALID_MEDIA_BATCH_INPUT')` before the inspector runs.
- Defaults are `inspector: inspectVideo`, `concurrency: 2`, `timeout: 15000`. `concurrency` is an integer 1 to 4; `timeout` is an integer 1 to 30000. Only `{ timeout }` is forwarded as the second inspector argument.
- Scheduling fills free slots up to `concurrency` in index order and never exceeds it in flight; a slot is released only when that inspector promise settles. The result array preserves input order even when completions are out of order.
- Success entries are exactly `{ index, status: 'ok', video: { format, durationSeconds, bytes, width, height, codec, audioStreams } }` with no extra keys or shared references. Missing `format`, `durationSeconds`, `bytes` or `codec` normalizes to `null`; `width`, `height` and `audioStreams` are required. Unknown inspector fields are never read.
- Individual sync throws, rejections, missing/invalid metadata or throwing getters become exactly `{ index, status: 'error', code: 'INSPECTION_FAILED' }` without messages, stacks, paths or partial data. One entry never rejects the whole batch.

Mocked versus real: `test/media_batch.test.js` uses only injected synthetic inspectors and controlled promises to cover order, duplicates, limits, validation, projection and fixed errors. The default `inspector` is the real `inspectVideo(file, { timeout })`, which requires a separately installed `ffprobe` and a local file you choose, with `protocol_whitelist=file` and no shell. No free generation, working Sora 2 service, broad anonymization, callback sandbox or full SaaS is promised, and no real media, accounts or providers are used here.

## Public release boundaries

See [NOTICE.md](NOTICE.md). Provider secrets, business endpoints, billing,
customer data, marketing images, generated videos and old Git history were
excluded. Original applications are unchanged. This public repository contains
the reusable core, not every feature of the former SaaS.

## Roadmap

- Add a persistent job store with an explicit retention policy.
- Add adapters for currently supported providers, using mocked HTTP tests.
- Add batch media reports and cancellation-aware local rendering.

Contributions must include regression tests and use synthetic fixtures. See
[AGENTS.md](AGENTS.md). Code is MIT; external media and provider rights are separate.


<!-- community-core:video-inspection-normalizer -->
### Deterministic Video Inspection Result Normalizer

Lets toolkit users normalize raw local video inspection values locally with a pure deterministic check that mirrors inspectVideoBatch success projection, catching malformed metadata before reporting without ffprobe, shell, file reading, network, timers, or provider calls.

Reusable deterministic JSON core: `src/community/video_inspection_normalizer.mjs`, API `runFeature(payload)`. This module is independently tested; application/UI integration is outside this change.

Public API is runFeature(payload). payload must be a non-null non-Array object with exactly one own enumerable string key 'raw'; otherwise throws TypeError('INVALID_INSPECTION_INPUT') before reading inner value. Let raw be payload.raw with no coercion. If raw is not a non-null non-Array object return a fresh plain object {status:'error',code:'INSPECTION_FAILED'}. Otherwise read only raw.format, raw.durationSeconds, raw.bytes, raw.width, raw.height, raw.codec and raw.audioStreams; all other keys are ignored and never read. Normalize optionals: format if undefined or null or missing then null else must be a primitive string with length 1 to 32 else return error envelope; codec follows the same rule as format. durationSeconds if undefined or null or missing then null else must be a finite number with 0 < value <= 86400 else return error envelope. bytes if undefined or null or missing then null else must satisfy Number.isSafeInteger with 0 <= value <= 9007199254740991 else return error envelope. Validate required: width must satisfy Number.isSafeInteger with 1 <= value <= 8192 else return error envelope including when missing, null or undefined; height follows the same rule as width; audioStreams must satisfy Number.isSafeInteger with 0 <= value <= 32 else return error envelope including when missing, null or undefined. No coercion: numeric strings, booleans, NaN, Infinity or objects never satisfy numeric checks. On valid input return a fresh plain object {status:'ok',video:{format,durationSeconds,bytes,width,height,codec,audioStreams}} in this order with no extra keys and no shared references. On invalid raw content return a fresh plain object {status:'error',code:'INSPECTION_FAILED'} with no extra keys, messages, stacks or paths. Deterministic pure JSON transform mirroring inspectVideoBatch projection without inspector execution, shell, file reading, ffprobe, network, env, processes, time, Date, randomness, callbacks, dependencies or queue creation; never mutates inputs and never returns timestamps.

Examples (JSON input and expected output):

```json
{
  "input": {
    "raw": {
      "audioStreams": 1,
      "bytes": 42,
      "codec": "h264",
      "durationSeconds": 1.5,
      "format": "mp4",
      "height": 480,
      "width": 640
    }
  },
  "output": {
    "status": "ok",
    "video": {
      "audioStreams": 1,
      "bytes": 42,
      "codec": "h264",
      "durationSeconds": 1.5,
      "format": "mp4",
      "height": 480,
      "width": 640
    }
  }
}
```

```json
{
  "input": {
    "raw": {
      "audioStreams": 0,
      "height": 720,
      "width": 1280
    }
  },
  "output": {
    "status": "ok",
    "video": {
      "audioStreams": 0,
      "bytes": null,
      "codec": null,
      "durationSeconds": null,
      "format": null,
      "height": 720,
      "width": 1280
    }
  }
}
```

```json
{
  "input": {
    "raw": {
      "audioStreams": 1,
      "bytes": 42,
      "codec": "h264",
      "durationSeconds": 1.5,
      "format": "mp4",
      "width": 640
    }
  },
  "output": {
    "code": "INSPECTION_FAILED",
    "status": "error"
  }
}
```

Public regression tests: `test/community_video_inspection_normalizer.test.js`.


<!-- community-core:provider-queue-limits-preview -->
### Deterministic Provider Queue Limits Preview

Lets video pipeline users pre-validate provider rate and concurrency caps locally with a pure deterministic check that mirrors VideoJobs.register limits, catching malformed startsPerMinute or maxConcurrent before creating queues without timers, network, or provider calls.

Reusable deterministic JSON core: `src/community/provider_queue_limits_preview.mjs`, API `runFeature(payload)`. This module is independently tested; application/UI integration is outside this change.

Public API is runFeature(payload). payload must be a non-null non-Array object containing only keys startsPerMinute and maxConcurrent; Array payload, null payload, non-object payload or any other own enumerable string key throws TypeError('INVALID_QUEUE_LIMITS') before any normalization. startsPerMinute when omitted or undefined defaults to 10, else must satisfy Number.isSafeInteger and value >=1, else throws TypeError('INVALID_QUEUE_LIMITS') for 0, negatives, fractions, numeric strings, null, NaN, Infinity, booleans, objects or arrays without coercion. maxConcurrent when omitted or undefined defaults to null for unlimited, else must satisfy Number.isSafeInteger and value >=1, else throws TypeError('INVALID_QUEUE_LIMITS') for 0, fractions, numeric strings, null, NaN, Infinity, booleans, objects or arrays without coercion; explicit null never means unlimited. On valid input return a fresh plain object {startsPerMinute,maxConcurrent} in this order where maxConcurrent is null for unlimited; no extra keys, no shared references, no timestamps. No input mutation, no queue creation, no queue mutation, no timers, no Date, no randomness, no callbacks, no dependencies, no provider calls, no network, no shell, no file reading; deterministic pure JSON transform mirroring VideoJobs.register rate and concurrency validation without creating queues.

Examples (JSON input and expected output):

```json
{
  "input": {
    "maxConcurrent": 2,
    "startsPerMinute": 10
  },
  "output": {
    "maxConcurrent": 2,
    "startsPerMinute": 10
  }
}
```

```json
{
  "input": {},
  "output": {
    "maxConcurrent": null,
    "startsPerMinute": 10
  }
}
```

```json
{
  "input": {
    "startsPerMinute": 5
  },
  "output": {
    "maxConcurrent": null,
    "startsPerMinute": 5
  }
}
```

Public regression tests: `test/community_provider_queue_limits_preview.test.js`.


<!-- community-core:video-job-spec-preview -->
### Deterministic Video Job Spec Preview

Lets pipeline users pre-validate VideoJobs.submit specs locally with a pure deterministic check that mirrors prompt, seconds, size and provider-name limits, catching malformed specs before queueing without timers, network, ffprobe, files or provider calls.

Reusable deterministic JSON core: `src/community/video_job_spec_preview.mjs`, API `runFeature(payload)`. This module is independently tested; application/UI integration is outside this change.

Public API is runFeature(payload). payload must be a non-null non-Array object containing only keys provider, prompt, seconds and size using Object.entries own enumerable string-key checks with no coercion; Array payload, null payload, non-object payload or any other own enumerable string key throws TypeError('INVALID_JOB_SPEC') before any normalization. provider must be present and must be a primitive string matching /^[a-z][a-z0-9-]{0,39}$/, else throws TypeError('INVALID_JOB_SPEC') for missing, undefined, empty, overlong, uppercase, whitespace, numeric or coerced values without coercion. prompt must be present and must be a primitive string where prompt.length is 1 to 10000 inclusive and prompt.trim() is non-empty, else throws TypeError('INVALID_JOB_SPEC') for missing, undefined, non-string, empty, whitespace-only or overlong values without coercion. seconds when omitted or undefined defaults to 8, else must satisfy Number.isSafeInteger and 1 to 120 inclusive, else throws TypeError('INVALID_JOB_SPEC') for 0, out-of-range, fractions, numeric strings, null, NaN, Infinity or booleans without coercion. size when omitted or undefined defaults to '1280x720', else must be a primitive string exactly WIDTHxHEIGHT where split on 'x' yields 2 parts each matching /^[0-9]{2,4}$/ and reconstructed WIDTHxHEIGHT equals input and Number values each satisfy 64 to 4096 inclusive, else throws TypeError('INVALID_JOB_SPEC') for whitespace, line terminators, wrong parts, non-digits, out-of-range or coerced objects without coercion. On valid input return a fresh plain object {provider,prompt,seconds,size} in this order where prompt is trimmed and seconds and size are effective values; no extra keys, no shared references, no timestamps. No input mutation, no job creation, no queue creation, no queue mutation, no timers, no Date, no randomness, no callbacks, no dependencies, no provider calls, no network, no shell, no file reading, no ffprobe; deterministic pure JSON transform mirroring VideoJobs.submit spec validation without queueing jobs.

Examples (JSON input and expected output):

```json
{
  "input": {
    "prompt": "A quiet forest",
    "provider": "my-provider"
  },
  "output": {
    "prompt": "A quiet forest",
    "provider": "my-provider",
    "seconds": 8,
    "size": "1280x720"
  }
}
```

```json
{
  "input": {
    "prompt": "  hello world  ",
    "provider": "renderer-1",
    "seconds": 10,
    "size": "640x480"
  },
  "output": {
    "prompt": "hello world",
    "provider": "renderer-1",
    "seconds": 10,
    "size": "640x480"
  }
}
```

```json
{
  "input": {
    "prompt": "x",
    "provider": "a",
    "seconds": 1,
    "size": "64x64"
  },
  "output": {
    "prompt": "x",
    "provider": "a",
    "seconds": 1,
    "size": "64x64"
  }
}
```

Public regression tests: `test/community_video_job_spec_preview.test.js`.


<!-- community-core:video-job-forget-preview -->
### Deterministic Video Job Forget Eligibility Preview

Lets video pipeline users pre-check VideoJobs.forget eligibility locally with a pure deterministic status check that mirrors the queued/running guard, catching attempts to forget active jobs before touching the in-memory store without timers, network, ffprobe, files or provider calls.

Reusable deterministic JSON core: `src/community/video_job_forget_preview.mjs`, API `runFeature(payload)`. This module is independently tested; application/UI integration is outside this change.

Public API is runFeature(payload). payload must be a non-null non-Array object containing only key status using Object.entries own enumerable string-key checks with no coercion; Array payload, null payload, non-object payload or any other own enumerable string key throws TypeError('INVALID_FORGET_PREVIEW') before any normalization. status must be present and must be a primitive string exactly queued, running, completed, failed or cancelled, else throws TypeError('INVALID_FORGET_PREVIEW') for missing, undefined, empty, whitespace, uppercase, numeric, boolean, null, array or object values without coercion. To extract status iterate Object.entries with for-of and Map get/set instead of computed property access, with no prototype/constructor access and no input mutation. On valid input return a fresh plain object {status,canForget,isActive,isTerminal} in this order where canForget is true when status is completed, failed or cancelled else false, isActive is true when status is queued or running else false, isTerminal equals canForget, with no extra keys, no shared references, no timestamps. No input mutation, no job creation, no store mutation, no queue creation, no queue mutation, no timers, no Date, no randomness, no callbacks, no dependencies, no provider calls, no network, no shell, no file reading, no ffprobe; deterministic pure JSON transform mirroring VideoJobs.forget active-job guard and get/list lifecycle values without touching jobs.

Examples (JSON input and expected output):

```json
{
  "input": {
    "status": "queued"
  },
  "output": {
    "canForget": false,
    "isActive": true,
    "isTerminal": false,
    "status": "queued"
  }
}
```

```json
{
  "input": {
    "status": "completed"
  },
  "output": {
    "canForget": true,
    "isActive": false,
    "isTerminal": true,
    "status": "completed"
  }
}
```

```json
{
  "input": {
    "status": "cancelled"
  },
  "output": {
    "canForget": true,
    "isActive": false,
    "isTerminal": true,
    "status": "cancelled"
  }
}
```

Public regression tests: `test/community_video_job_forget_preview.test.js`.


<!-- community-core:video-batch-input-preview -->
### Deterministic Video Batch Inspection Request Preview

Lets toolkit users pre-validate inspectVideoBatch file lists and bounds locally with a pure deterministic check that mirrors concurrency and timeout limits, catching malformed batch requests before inspection without ffprobe, shell, files, network, timers or provider calls.

Reusable deterministic JSON core: `src/community/video_batch_input_preview.mjs`, API `runFeature(payload)`. This module is independently tested; application/UI integration is outside this change.

Public API is runFeature(payload). payload must be a non-null non-Array object containing only keys files, concurrency and timeout using Object.entries own enumerable string-key checks with no coercion, otherwise throws TypeError('INVALID_BATCH_INPUT') before reading inner values. files must be present and must be an Array with length 0 to 32 inclusive, otherwise throws TypeError('INVALID_BATCH_INPUT'). Each element observed in input order with for-of iteration must be a primitive string with length 1 to 4096, otherwise throws TypeError('INVALID_BATCH_INPUT') for missing, undefined, null, empty, overlong, numeric, boolean, array or object values without coercion; holes yield undefined and thus throw; duplicates are preserved in order with no deduplication or sorting. concurrency when omitted or undefined defaults to 2, otherwise must satisfy Number.isSafeInteger with 1 to 4 inclusive, otherwise throws TypeError('INVALID_BATCH_INPUT') without coercion for fractions, numeric strings, null, NaN, Infinity or booleans. timeout when omitted or undefined defaults to 15000, otherwise must satisfy Number.isSafeInteger with 1 to 30000 inclusive, otherwise throws TypeError('INVALID_BATCH_INPUT') with same no-coercion rule. To extract fields iterate Object.entries with for-of and Map get/set instead of variable computed access, with no prototype/constructor access and no input mutation. On valid input return a fresh plain object {files,concurrency,timeout} in this order with no extra keys and no shared references where files is a fresh Array built with push in input order, concurrency and timeout are effective values. Preserve input with no mutation, no inspector execution, no shell, no file reading, no ffprobe, no network, no env, no processes, no time, no Date, no randomness, no callbacks, no dependencies and no queue creation, deterministic pure JSON transform previewing inspectVideoBatch request validation without running inspection.

Examples (JSON input and expected output):

```json
{
  "input": {
    "files": [
      "clip-a.mp4",
      "clip-b.mp4"
    ]
  },
  "output": {
    "concurrency": 2,
    "files": [
      "clip-a.mp4",
      "clip-b.mp4"
    ],
    "timeout": 15000
  }
}
```

```json
{
  "input": {
    "concurrency": 1,
    "files": [],
    "timeout": 5000
  },
  "output": {
    "concurrency": 1,
    "files": [],
    "timeout": 5000
  }
}
```

```json
{
  "input": {
    "concurrency": 4,
    "files": [
      "a.mp4",
      "a.mp4"
    ],
    "timeout": 30000
  },
  "output": {
    "concurrency": 4,
    "files": [
      "a.mp4",
      "a.mp4"
    ],
    "timeout": 30000
  }
}
```

Public regression tests: `test/community_video_batch_input_preview.test.js`.


<!-- community-core:video-job-capacity-preview -->
### Deterministic Video Job Capacity Preview

Lets video pipeline users pre-check VideoJobs capacity locally with a pure deterministic count check that mirrors the maxJobs constructor guard and submit capacity guard, catching full stores before queueing without timers, network, ffprobe, files or provider calls.

Reusable deterministic JSON core: `src/community/video_job_capacity_preview.mjs`, API `runFeature(payload)`. This module is independently tested; application/UI integration is outside this change.

Public API is runFeature(payload). payload must be a non-null non-Array object containing only keys maxJobs and currentCount using Object.entries own enumerable string-key checks with no coercion; Array payload, null payload, non-object payload or any other own enumerable string key throws TypeError('INVALID_CAPACITY_PREVIEW') before any normalization. maxJobs when omitted or undefined defaults to 1000, else must satisfy Number.isSafeInteger and 1 to 9007199254740991 inclusive, else throws TypeError('INVALID_CAPACITY_PREVIEW') for null, 0, negative, fractions, numeric strings, NaN, Infinity or booleans without coercion. currentCount must be present and must satisfy Number.isSafeInteger with 0 to 9007199254740991 inclusive, else throws TypeError('INVALID_CAPACITY_PREVIEW') for missing, undefined, null, negative, fractions, numeric strings, NaN, Infinity, booleans, arrays or objects without coercion. To extract fields iterate Object.entries with for-of and Map get/set instead of variable computed access, with no prototype/constructor access and no input mutation. On valid input return a fresh plain object {maxJobs,currentCount,canSubmit,remaining} in this order where maxJobs is the effective value, canSubmit is true when currentCount is strictly less than maxJobs else false, remaining is maxJobs minus currentCount when canSubmit is true else 0, with no extra keys, no shared references, no timestamps. No input mutation, no job creation, no store mutation, no queue creation, no queue mutation, no timers, no Date, no randomness, no callbacks, no dependencies, no provider calls, no network, no shell, no file reading, no ffprobe; deterministic pure JSON transform mirroring VideoJobs constructor maxJobs guard and submit capacity guard without touching jobs.

Examples (JSON input and expected output):

```json
{
  "input": {
    "currentCount": 3,
    "maxJobs": 10
  },
  "output": {
    "canSubmit": true,
    "currentCount": 3,
    "maxJobs": 10,
    "remaining": 7
  }
}
```

```json
{
  "input": {
    "currentCount": 1000
  },
  "output": {
    "canSubmit": false,
    "currentCount": 1000,
    "maxJobs": 1000,
    "remaining": 0
  }
}
```

```json
{
  "input": {
    "currentCount": 0,
    "maxJobs": 1
  },
  "output": {
    "canSubmit": true,
    "currentCount": 0,
    "maxJobs": 1,
    "remaining": 1
  }
}
```

Public regression tests: `test/community_video_job_capacity_preview.test.js`.
