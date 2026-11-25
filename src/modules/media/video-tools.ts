import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function videoTool(tool: "ffmpeg" | "ffprobe") {
  const configured = process.env[tool === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH"];
  if (configured) return configured;
  const local = resolve(".local-tools", "bin", tool + (process.platform === "win32" ? ".exe" : ""));
  return existsSync(local) ? local : tool;
}
