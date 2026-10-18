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

Calling `configureGenerationQueue` again updates an existing queue atomically.
Increasing its cap can immediately start pending work if rate budget remains.
Lowering its cap leaves running work intact and blocks further starts until the
active count falls below the new cap. Omitting `maxConcurrent` on an existing
queue keeps its cap; a new queue starts unlimited. Raw `limitPerMinute` retains
its existing default and normalization rules: omitted or invalid values become
`1`, and positive fractions are rounded down to at least `1`.

The snapshot adds `active` (occupied slots) and `maxConcurrent` (`null` for
unlimited), alongside the existing rate and pending counts. Snapshots remain
JSON serializable. Invalid concurrency caps, including `0`, fractions, numeric
strings, `null`, or `Infinity`, throw `TypeError` without changing the queue.
When only concurrency blocks progress, completion wakes the queue without a
polling timer. Rate-blocked pending work retains a referenced timer so a
standalone Node process stays alive until it can start.

The regression suite uses simulated adapters and controlled promises to cover
slot bounds, cancellation, rejection, reconfiguration and priority. A mock clock
tests the full rate window without waiting a real minute. These tests do not
generate videos or contact a provider.

## Public release boundaries

See [NOTICE.md](NOTICE.md). Provider secrets, business endpoints, billing,
customer data, marketing images, generated videos and old Git history were
excluded. Original applications are unchanged. This public repository contains
the reusable core, not every feature of the former SaaS.

## Roadmap

- Add a persistent job store with an explicit retention policy.
- Add per-provider queue shutdown and explicit cancellation of pending work.
- Add adapters for currently supported providers, using mocked HTTP tests.
- Add batch media reports and cancellation-aware local rendering.

Contributions must include regression tests and use synthetic fixtures. See
[AGENTS.md](AGENTS.md). Code is MIT; external media and provider rights are separate.
