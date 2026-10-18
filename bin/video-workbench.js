#!/usr/bin/env node
import { VideoJobs, inspectVideo } from "../src/index.js";

async function main() {
  const [command, file] = process.argv.slice(2);
  if (command === "inspect" && file) {
    console.log(JSON.stringify(await inspectVideo(file), null, 2));
  } else if (command === "demo") {
    const jobs = new VideoJobs().register("demo", async (spec) => ({ kind: "simulation", message: "No video was generated and no external API was called", prompt: spec.prompt }));
    const job = jobs.submit({ provider: "demo", prompt: "A paper boat crossing a quiet pond" });
    console.log(JSON.stringify(await job.done, null, 2));
  } else {
    console.log("Usage: node bin/video-workbench.js demo | inspect LOCAL_VIDEO_FILE");
    if (command) process.exitCode = 2;
  }
}
main().catch((error) => { console.error(error.code === "ENOENT" ? "Input file or ffprobe executable was not found" : "Operation failed; check the local file and ffprobe installation"); process.exitCode = 1; });
