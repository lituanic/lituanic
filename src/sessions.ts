import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SessionEntry {
  sessionId: string;
  ts: number; // timestamp when stored
}

export interface SessionStore {
  get(channelId: string, threadTs: string): string | undefined;
  set(channelId: string, threadTs: string, sessionId: string): void;
}

export function createSessionStore(dataDir: string): SessionStore {
  const dir = join(dataDir, "sessions");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const file = join(dir, "active.json");
  let sessions: Record<string, SessionEntry> = {};
  if (existsSync(file)) {
    try {
      const raw = JSON.parse(readFileSync(file, "utf-8"));
      // Migrate from old format (plain string values) to new format (with timestamp)
      for (const [key, val] of Object.entries(raw)) {
        if (typeof val === "string") {
          sessions[key] = { sessionId: val, ts: Date.now() };
        } else if (val && typeof val === "object" && "sessionId" in (val as any)) {
          sessions[key] = val as SessionEntry;
        }
      }
    } catch {
      console.warn("[lituanic] Corrupt sessions file, starting fresh");
    }
  }

  function evict() {
    const cutoff = Date.now() - SESSION_TTL_MS;
    let evicted = 0;
    for (const key of Object.keys(sessions)) {
      if (sessions[key].ts < cutoff) {
        delete sessions[key];
        evicted++;
      }
    }
    if (evicted > 0) console.log(`[lituanic] Evicted ${evicted} expired session(s)`);
  }

  function flush() {
    writeFileSync(file, JSON.stringify(sessions, null, 2), "utf-8");
  }

  // Evict stale entries on startup
  evict();
  flush();

  return {
    get(channelId, threadTs) {
      const entry = sessions[`${channelId}:${threadTs}`];
      if (!entry) return undefined;
      // Check TTL on read
      if (Date.now() - entry.ts > SESSION_TTL_MS) {
        delete sessions[`${channelId}:${threadTs}`];
        return undefined;
      }
      return entry.sessionId;
    },
    set(channelId, threadTs, sessionId) {
      sessions[`${channelId}:${threadTs}`] = { sessionId, ts: Date.now() };
      evict();
      flush();
    },
  };
}
