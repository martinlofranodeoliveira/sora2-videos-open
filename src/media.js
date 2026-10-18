import { execFile } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

export async function inspectVideo(file, { ffprobe = "ffprobe", timeout = 15000 } = {}) {
  if (typeof file !== "string" || !file || file.includes("\0")) throw new TypeError("A local video path is required");
  const input = await realpath(file);
  if (!(await stat(input)).isFile()) throw new TypeError("Input must be a regular local file");
  // No shell and no remote protocols. A filename is always an argument, never code.
  const { stdout } = await execFileAsync(ffprobe, ["-v", "error", "-protocol_whitelist", "file", "-show_format", "-show_streams", "-of", "json", input], { timeout, maxBuffer: 1024 * 1024 });
  const data = JSON.parse(stdout);
  const video = data.streams?.find((stream) => stream.codec_type === "video");
  if (!video) throw new Error("No video stream found");
  return { format: data.format?.format_name, durationSeconds: Number(data.format?.duration) || null, bytes: Number(data.format?.size) || null, width: video.width, height: video.height, codec: video.codec_name, audioStreams: data.streams.filter((stream) => stream.codec_type === "audio").length };
}
