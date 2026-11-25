import "dotenv/config";
import { execFileSync } from "node:child_process";
import { videoTool } from "../src/modules/media/video-tools.ts";

try {
  for (const tool of ["ffmpeg", "ffprobe"]) {
    const version = execFileSync(videoTool(tool), ["-version"], { encoding: "utf8", timeout: 20000 });
    console.log(version.split("\n")[0]);
  }
  const encoders = execFileSync(videoTool("ffmpeg"), ["-hide_banner", "-encoders"], { encoding: "utf8", timeout: 20000 });
  if (!/\blibx264\b/u.test(encoders)) throw new Error("Se requiere el codificador libx264.");
  console.log("Procesamiento H.264 disponible.");
} catch (error) {
  console.error("Revisa FFmpeg y FFprobe en .local-tools/bin, PATH o las rutas FFMPEG_PATH y FFPROBE_PATH.", error.code ?? error.message);
  process.exitCode = 1;
}
