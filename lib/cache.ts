import { promises as fs } from "fs";
import path from "path";
import type { DailySnapshot } from "./types";
import { wibDateKey } from "./time";

const DATA_DIR = path.join(process.cwd(), "data", "cache");
const TMP_DIR = "/tmp/cuan-cache";

export function cacheKey(date = new Date()): string {
  return wibDateKey(date);
}

async function readFileSafe(file: string): Promise<DailySnapshot | null> {
  try {
    const raw = await fs.readFile(/*turbopackIgnore: true*/ file, "utf8");
    return JSON.parse(raw) as DailySnapshot;
  } catch {
    return null;
  }
}

export async function readCache(key: string): Promise<DailySnapshot | null> {
  return (
    (await readFileSafe(path.join(DATA_DIR, `${key}.json`))) ??
    (await readFileSafe(path.join(TMP_DIR, `${key}.json`)))
  );
}

export async function writeCache(key: string, snapshot: DailySnapshot): Promise<void> {
  const payload = JSON.stringify(snapshot);
  for (const dir of [DATA_DIR, TMP_DIR]) {
    try {
      await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
      await fs.writeFile(/*turbopackIgnore: true*/ path.join(dir, `${key}.json`), payload);
      return;
    } catch {
      /* try next */
    }
  }
}

export async function latestCache(): Promise<DailySnapshot | null> {
  for (const dir of [DATA_DIR, TMP_DIR]) {
    try {
      const files = await fs.readdir(/*turbopackIgnore: true*/ dir);
      const jsons = files.filter((f) => f.endsWith(".json")).sort();
      const last = jsons[jsons.length - 1];
      if (!last) continue;
      const hit = await readFileSafe(path.join(dir, last));
      if (hit) return hit;
    } catch {
      /* try next */
    }
  }
  return null;
}
