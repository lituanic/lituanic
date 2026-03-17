import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

export interface MemoryManager {
  /** Read global MEMORY.md */
  read(): string;
  /** Write global MEMORY.md */
  write(content: string): void;
  /** Append to today's daily log */
  appendDailyLog(entry: string): void;
  /** Read today's daily log */
  readDailyLog(): string;
  /** Read per-channel memory */
  readChannel(channelId: string): string;
  /** Write per-channel memory */
  writeChannel(channelId: string, content: string): void;
}

export function createMemoryManager(dataDir: string): MemoryManager {
  const memoryDir = join(dataDir, "memory");
  ensureDir(memoryDir);

  function todayFile(): string {
    const d = new Date();
    const date = d.toISOString().split("T")[0];
    return join(memoryDir, `${date}.md`);
  }

  return {
    read() {
      const p = join(memoryDir, "MEMORY.md");
      return existsSync(p) ? readFileSync(p, "utf-8") : "";
    },

    write(content: string) {
      writeFileSync(join(memoryDir, "MEMORY.md"), content, "utf-8");
    },

    appendDailyLog(entry: string) {
      const p = todayFile();
      const timestamp = new Date().toISOString().split("T")[1].slice(0, 5);
      appendFileSync(p, `- ${timestamp} ${entry}\n`, "utf-8");
    },

    readDailyLog() {
      const p = todayFile();
      return existsSync(p) ? readFileSync(p, "utf-8") : "";
    },

    readChannel(channelId: string) {
      const p = join(dataDir, channelId, "MEMORY.md");
      return existsSync(p) ? readFileSync(p, "utf-8") : "";
    },

    writeChannel(channelId: string, content: string) {
      const dir = join(dataDir, channelId);
      ensureDir(dir);
      writeFileSync(join(dir, "MEMORY.md"), content, "utf-8");
    },
  };
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
