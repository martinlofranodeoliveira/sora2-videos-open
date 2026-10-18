import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectVideo } from "../src/index.js";

test("inspection validates local input and refuses remote URLs", async () => {
  await assert.rejects(inspectVideo("https://example.com/video.mp4"));
  await assert.rejects(inspectVideo(""));
  await assert.rejects(inspectVideo(tmpdir()));
});

test("local probe is invoked without shell, with restricted protocols", async () => {
  const folder = await mkdtemp(join(tmpdir(), "video-test-"));
  try {
    const media = join(folder, "video; do-not-execute.mp4");
    const probe = join(folder, "probe");
    await writeFile(media, "synthetic probe input");
    await writeFile(probe, `#!/usr/bin/env node\nconst args=process.argv.slice(2); if(args[args.indexOf('-protocol_whitelist')+1]!=='file'||!args.at(-1).endsWith('video; do-not-execute.mp4'))process.exit(2); console.log(JSON.stringify({format:{format_name:'mov,mp4',duration:'1.2',size:'40'},streams:[{codec_type:'video',width:1280,height:720,codec_name:'h264'},{codec_type:'audio'}]}));`, { mode: 0o700 });
    const result = await inspectVideo(media, { ffprobe: probe });
    assert.deepEqual(result, { format: "mov,mp4", durationSeconds: 1.2, bytes: 40, width: 1280, height: 720, codec: "h264", audioStreams: 1 });
  } finally { await rm(folder, { recursive: true, force: true }); }
});
