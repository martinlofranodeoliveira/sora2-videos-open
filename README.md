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
}, { startsPerMinute: 10 });
const operation = jobs.submit({ provider: 'my-provider', prompt: 'A quiet forest', seconds: 8 });
const completed = await operation.done;
```

The example adapter is a placeholder: replace it with your real implementation.
Job records are in memory; they do not survive restart. Completed records can be
removed with `forget(id)`. Pending jobs can be cancelled with an `AbortSignal`;
running adapters must honor the supplied signal themselves. A rate limit bounds
job starts per minute, not simultaneous executions. Caller-provided adapters
are trusted code and must return sanitized results. A maximum record count bounds
retention; large video data belongs in files, not job metadata.

## Public release boundaries

See [NOTICE.md](NOTICE.md). Provider secrets, business endpoints, billing,
customer data, marketing images, generated videos and old Git history were
excluded. Original applications are unchanged. This public repository contains
the reusable core, not every feature of the former SaaS.

## Roadmap

- Add a persistent job store with an explicit retention policy.
- Add bounded concurrency independently of the per-minute rate limit.
- Add adapters for currently supported providers, using mocked HTTP tests.
- Add batch media reports and cancellation-aware local rendering.

Contributions must include regression tests and use synthetic fixtures. See
[AGENTS.md](AGENTS.md). Code is MIT; external media and provider rights are separate.
