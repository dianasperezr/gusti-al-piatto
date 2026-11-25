import "server-only";
import { mkdir, unlink, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, resolve, sep } from "node:path";

interface MediaStorage {
  put(key: string, value: Uint8Array): Promise<void>;
  size(key: string): Promise<number | null>;
  read(key: string, start: number, end: number): ReturnType<typeof createReadStream>;
  remove(key: string): Promise<void>;
}

function diskPath(key: string) {
  const root = resolve(process.env.MEDIA_DIRECTORY ?? "storage");
  const file = resolve(root, key);
  if (!file.startsWith(root + sep)) throw new Error("Ruta de multimedia inválida.");
  return file;
}

export const storage: MediaStorage = {
  async put(key, value) {
    const path = diskPath(key);
    await mkdir(dirname(path), { recursive: true, mode: 0o750 });
    await writeFile(path, value, { flag: "wx", mode: 0o600 });
  },
  async size(key) {
    const info = await stat(diskPath(key)).catch(() => null);
    return info?.isFile() ? info.size : null;
  },
  read(key, start, end) { return createReadStream(diskPath(key), { start, end }); },
  async remove(key) { await unlink(diskPath(key)).catch(() => undefined); },
};
