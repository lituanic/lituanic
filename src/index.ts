import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, defineConfig, type LituanicConfig } from "./config.js";
import {
  createSlackApp,
  wireSlack,
  startWebhookServer,
  startHeartbeats,
  type IncomingEvent,
} from "./gateway.js";
import { think, type ThinkResult } from "./think.js";
import { createMemoryManager } from "./memory.js";
import { createSessionStore } from "./sessions.js";
import type { Cron } from "croner";

export { defineConfig, loadConfig, type LituanicConfig };
export { type IncomingEvent } from "./gateway.js";
export { type MemoryManager, createMemoryManager } from "./memory.js";
export { type SessionStore, createSessionStore } from "./sessions.js";

const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf-8"));

/**
 * Convert standard Markdown to Slack mrkdwn format.
 * Claude outputs GitHub-flavored markdown; Slack needs its own dialect.
 */
function toMrkdwn(text: string): string {
  return text
    // Bold: **text** → *text*
    .replace(/\*\*(.+?)\*\*/gs, "*$1*")
    // Links: [text](url) → <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>")
    // Headings: ## Title → *Title*
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*");
}

interface LituanicDaemon {
  config: LituanicConfig;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createDaemon(config: LituanicConfig): LituanicDaemon {
  let running = false;
  let startTime = 0;
  const memory = createMemoryManager(config.data);
  const sessions = createSessionStore(config.data);
  const slackApp = createSlackApp(config);

  // Track resources for graceful shutdown
  let healthServer: Server | undefined;
  let webhookServer: Server | undefined;
  let crons: Cron[] = [];
  let lastEvent: string | null = null;
  let activeSessions = 0;

  async function handleMessage(event: IncomingEvent): Promise<void> {
    if (!running) return; // reject events during shutdown

    lastEvent = new Date().toISOString();
    activeSessions++;

    const preview = event.text.slice(0, 80).replace(/\n/g, " ");
    console.log(`[lituanic] ← ${event.source} #${event.channelId ?? "?"}: ${preview}`);

    // Typing indicator
    let typingTs: string | undefined;
    if (slackApp && event.channelId) {
      try {
        const msg = await slackApp.client.chat.postMessage({
          channel: event.channelId,
          thread_ts: event.threadTs,
          text: ":hourglass_flowing_sand: Working...",
        });
        typingTs = msg.ts as string;
      } catch {}
    }

    try {
      const result: ThinkResult = await think({
        config,
        event,
        memory,
        sessions,
        slack: slackApp,
        onNotification: slackApp && config.slack?.channel
          ? (message) => {
              slackApp.client.chat.postMessage({
                channel: config.slack!.channel!,
                text: `[notification] ${message}`,
              }).catch(() => {});
            }
          : undefined,
        onProgress: slackApp && event.channelId && typingTs
          ? (text) => {
              slackApp.client.chat.update({
                channel: event.channelId!,
                ts: typingTs!,
                text: `:hourglass_flowing_sand: ${text}...`,
              }).catch(() => {});
            }
          : undefined,
      });

      // Delete typing indicator
      if (slackApp && event.channelId && typingTs) {
        try { await slackApp.client.chat.delete({ channel: event.channelId, ts: typingTs }); } catch {}
      }

      if (slackApp && event.channelId && result.response) {
        if (result.response.startsWith("[SILENT]")) return;
        const MAX_SLACK_LENGTH = 3900;
        let text = toMrkdwn(result.response);
        if (text.length > MAX_SLACK_LENGTH) {
          text = text.slice(0, MAX_SLACK_LENGTH) + `\n\n_(truncated — full response was ${result.response.length} chars)_`;
        }
        await slackApp.client.chat.postMessage({
          channel: event.channelId,
          thread_ts: event.threadTs,
          text,
          mrkdwn: true,
        });
      }
    } catch (err) {
      console.error("[lituanic] Error:", err);
      if (slackApp && event.channelId && typingTs) {
        try { await slackApp.client.chat.delete({ channel: event.channelId, ts: typingTs }); } catch {}
      }
      if (slackApp && config.slack?.channel) {
        try {
          await slackApp.client.chat.postMessage({
            channel: config.slack.channel,
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          });
        } catch {}
      }
    } finally {
      activeSessions--;
    }
  }

  return {
    config,

    async start() {
      if (running) return;
      running = true;
      startTime = Date.now();

      console.log(`[lituanic] Starting ${config.name} v${pkg.version}...`);

      if (slackApp) {
        wireSlack(slackApp, handleMessage);
        await slackApp.start();
        console.log("[lituanic] Slack connected (Socket Mode)");
      }

      webhookServer = startWebhookServer(config, handleMessage) ?? undefined;

      crons = startHeartbeats(config, handleMessage);
      if (crons.length > 0) console.log(`[lituanic] ${crons.length} heartbeats active`);

      healthServer = createServer((req, res) => {
        if (req.url === config.health.endpoint) {
          res.writeHead(200, { "Content-Type": "application/json", "Server": `Lituanic/${pkg.version}` });
          res.end(JSON.stringify({
            status: "ok",
            name: config.name,
            since: 1009,
            uptime: Math.floor((Date.now() - startTime) / 1000),
            lastEvent,
            activeSessions,
            version: pkg.version,
          }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      healthServer.listen(config.health.port, () => {
        console.log(`[lituanic] Health: http://localhost:${config.health.port}${config.health.endpoint}`);
      });

      console.log(`[lituanic] ${config.name} is live.`);
    },

    async stop() {
      if (!running) return;
      running = false;
      console.log(`[lituanic] Shutting down ${config.name}...`);

      // Stop accepting new events
      for (const cron of crons) cron.stop();
      healthServer?.close();
      webhookServer?.close();

      // Wait for active sessions to drain (max 30s)
      if (activeSessions > 0) {
        console.log(`[lituanic] Waiting for ${activeSessions} active session(s)...`);
        const deadline = Date.now() + 30_000;
        while (activeSessions > 0 && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 500));
        }
        if (activeSessions > 0) {
          console.warn(`[lituanic] Force shutdown with ${activeSessions} active session(s)`);
        }
      }

      // Stop Slack
      if (slackApp) {
        try { await slackApp.stop(); } catch {}
      }

      console.log(`[lituanic] ${config.name} stopped.`);
      process.exit(0);
    },
  };
}

process.on("unhandledRejection", (err) => console.error("[lituanic] Unhandled rejection:", err));
process.on("uncaughtException", (err) => { console.error("[lituanic] Uncaught exception:", err); process.exit(1); });
