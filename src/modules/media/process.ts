import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { z } from "zod";
import { videoTool } from "./video-tools";

const run = promisify(execFile);
const cropValue = z.coerce.number().min(0).max(100);
const imageType = {
  jpeg: { mime: "image/jpeg", ext: ["jpg", "jpeg"] },
  png: { mime: "image/png", ext: ["png"] },
  webp: { mime: "image/webp", ext: ["webp"] },
  heif: { mime: "image/avif", ext: ["avif"] },
} as const;

function bound(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(max, parsed) : fallback;
}
export const maxBytes = () => Math.floor(bound(process.env.MEDIA_MAX_MB, 15, 30) * 1024 * 1024);
export const maxDuration = () => bound(process.env.MEDIA_VIDEO_MAX_SECONDS, 30, 120);
const commandOptions = { timeout: 35000, maxBuffer: 512_000 };

async function runVideo(tool: "ffmpeg" | "ffprobe", args: string[]) {
  try {
    return await run(videoTool(tool), args, commandOptions);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Revisa la instalación de FFmpeg y FFprobe o sus rutas en el proyecto.");
    }
    throw error;
  }
}

function extension(file: File) {
  return (file.name.split(".").at(-1) ?? "").toLowerCase();
}

export async function processImage(file: File, form?: FormData) {
  if (!file.size || file.size > maxBytes()) throw new Error("Revisa el tamaño de la imagen.");
  const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 30_000_000 });
  const { format } = await image.metadata();
  const detected = format ? imageType[format as keyof typeof imageType] : undefined;
  if (!detected || file.type !== detected.mime || !(detected.ext as readonly string[]).includes(extension(file))) {
    throw new Error("Revisa que la imagen, su extensión y su formato coincidan.");
  }
  const normalized = await image.rotate().raw().toBuffer({ resolveWithObject: true });
  let picture = sharp(normalized.data, { raw: normalized.info });
  if (form?.get("crop") === "on") {
    const crop = z.tuple([cropValue, cropValue, cropValue, cropValue]).parse(
      ["left", "top", "width", "height"].map(key => form.get("crop-" + key)),
    );
    const [left, top, width, height] = crop;
    if (!width || !height || left + width > 100 || top + height > 100) throw new Error("Revisa las dimensiones del recorte.");
    const bounds = normalized.info;
    picture = picture.extract({ left: Math.floor(bounds.width * left / 100), top: Math.floor(bounds.height * top / 100),
      width: Math.max(1, Math.floor(bounds.width * width / 100)), height: Math.max(1, Math.floor(bounds.height * height / 100)) });
  }
  const data = await picture.resize(2000, 2000, { fit: "inside", withoutEnlargement: true }).webp({ quality: 83 }).toBuffer();
  const thumbnail = await sharp(data).resize(480, 360, { fit: "inside", withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
  return { data, thumbnail, mime: "image/webp", ext: "webp", duration: null };
}

export async function processVideo(file: File, poster?: File) {
  if (!file.size || file.size > maxBytes()) throw new Error("Revisa el tamaño del video.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = extension(file);
  const atom = bytes.subarray(4, 8).toString("ascii");
  const genericMime = file.type === "" || file.type === "application/octet-stream";
  const mp4 = (file.type === "video/mp4" || genericMime) && ext === "mp4" && atom === "ftyp";
  const mov = (["video/quicktime", "video/mp4"].includes(file.type) || genericMime) && ext === "mov" && ["ftyp", "moov", "mdat", "wide", "free"].includes(atom);
  const webm = (file.type === "video/webm" || genericMime) && ext === "webm" && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!mp4 && !mov && !webm) throw new Error("Revisa que el video sea MP4, MOV o WebM y coincida con su extensión.");
  const work = await mkdtemp(join(tmpdir(), "gusti-video-"));
  const input = join(work, "input." + ext);
  const output = join(work, "output.mp4");
  const preview = join(work, "preview.png");
  try {
    await writeFile(input, bytes, { mode: 0o600 });
    const codecInput = ["-protocol_whitelist", "file,pipe", "-f", webm ? "matroska" : "mov"];
    const { stdout } = await runVideo("ffprobe", [
      "-v", "error", ...codecInput, "-select_streams", "v:0", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", input,
    ]);
    const metadata = z.object({
      streams: z.array(z.object({
        codec_type: z.literal("video"), width: z.number().int().positive().max(4096), height: z.number().int().positive().max(4096),
      })).min(1),
      format: z.object({ duration: z.coerce.number().positive().optional().catch(undefined) }),
    }).parse(JSON.parse(stdout));
    const { duration } = metadata.format;
    if (duration !== undefined && duration > maxDuration()) throw new Error("Revisa la duración máxima configurada para el video.");
    await runVideo("ffmpeg", [
      "-nostdin", "-v", "error", "-threads", "1", "-filter_threads", "1", ...codecInput, "-i", input, "-map", "0:v:0",
      "-an", "-map_metadata", "-1", "-vf", "scale=720:720:force_original_aspect_ratio=decrease:force_divisible_by=2",
      "-t", String(maxDuration() + (duration === undefined ? 1 : 0)), "-c:v", "libx264", "-threads", "1", "-preset", "fast", "-crf", "25",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", output,
    ]);
    let storedDuration = duration;
    if (storedDuration === undefined) {
      const outputProbe = await runVideo("ffprobe", [
        "-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries", "format=duration", "-of", "csv=p=0", output,
      ]);
      storedDuration = z.coerce.number().positive().parse(outputProbe.stdout.trim());
      if (storedDuration > maxDuration()) throw new Error("Revisa la duración máxima configurada para el video.");
    }
    if ((await stat(output)).size > maxBytes()) throw new Error("Revisa el tamaño del video transcodificado.");
    const thumbnail = poster?.size ? (await processImage(poster)).thumbnail : await (async () => {
      await runVideo("ffmpeg", [
        "-nostdin", "-v", "error", "-threads", "1", "-protocol_whitelist", "file,pipe", "-i", output,
        "-frames:v", "1", "-vf", "scale=480:-2", preview,
      ]);
      return sharp(await readFile(preview)).webp({ quality: 76 }).toBuffer();
    })();
    return { data: await readFile(output), thumbnail, mime: "video/mp4", ext: "mp4", duration: storedDuration };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
