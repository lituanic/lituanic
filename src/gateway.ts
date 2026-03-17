import { App } from "@slack/bolt";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Cron } from "croner";
import type { LituanicConfig } from "./config.js";

export type MessageHandler = (message: IncomingEvent) => Promise<void>;

export interface IncomingEvent {
  source: "slack" | "webhook" | "cron";
  channelId?: string;
  threadTs?: string;
  userId?: string;
  text: string;
  raw?: unknown;
}

interface ChannelQueue {
  queue: IncomingEvent[];
  processing: boolean;
}

const MAX_QUEUE = 5;
const channels = new Map<string, ChannelQueue>();

/**
 * Initialize the Slack Bolt app.
 */
export function createSlackApp(config: LituanicConfig): App | undefined {
  if (!config.slack) return undefined;

  const app = new App({
    token: config.slack.botToken,
    appToken: config.slack.appToken,
    socketMode: true,
  });

  return app;
}

/**
 * Wire Slack events to the message handler.
 */
export function wireSlack(app: App, handler: MessageHandler) {
  // @mentions
  app.event("app_mention", async ({ event }) => {
    await enqueue(
      {
        source: "slack",
        channelId: event.channel,
        threadTs: event.ts,
        userId: event.user,
        text: event.text,
        raw: event,
      },
      handler,
    );
  });

  // DMs
  app.event("message", async ({ event }) => {
    if (event.channel_type !== "im") return;
    if ("subtype" in event && event.subtype) return;

    await enqueue(
      {
        source: "slack",
        channelId: event.channel,
        threadTs: event.ts,
        userId: "user" in event ? (event.user as string) : undefined,
        text: "text" in event ? (event.text as string) : "",
        raw: event,
      },
      handler,
    );
  });
}

/**
 * Start the webhook HTTP server.
 */
export function startWebhookServer(
  config: LituanicConfig,
  handler: MessageHandler,
): ReturnType<typeof createServer> | undefined {
  if (!config.webhook) return undefined;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const routeConfig = config.webhook?.routes[url];

    if (!routeConfig) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    // Collect body
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);

    // HMAC verification
    if (routeConfig.verify === "hmac-sha256" && routeConfig.secret) {
      const sig = req.headers["x-linear-signature"] ?? req.headers["x-signature-256"];
      if (!sig || !verifyHmac(body, String(sig), routeConfig.secret)) {
        res.writeHead(401);
        res.end("Invalid signature");
        return;
      }
    }

    // Respond immediately
    res.writeHead(200);
    res.end("ok");

    // Parse and dispatch
    try {
      const payload = JSON.parse(body.toString("utf-8"));
      const channelId = config.slack?.channel;
      const event = parseWebhookPayload(url, payload, channelId);

      if (event) {
        await enqueue(event, handler);
      } else {
        console.log(`[lituanic] Webhook skipped: ${url}`);
      }
    } catch {
      console.error("[lituanic] Failed to parse webhook payload");
    }
  });

  server.listen(config.webhook.port, () => {
    console.log(`[lituanic] Webhook server listening on port ${config.webhook!.port}`);
  });

  return server;
}

/**
 * Start cron-scheduled heartbeats.
 */
export function startHeartbeats(config: LituanicConfig, handler: MessageHandler): Cron[] {
  return config.schedule.map((entry) => {
    return new Cron(entry.cron, { timezone: entry.timezone }, async () => {
      const channelId = entry.channel ?? config.slack?.channel;

      await enqueue(
        {
          source: "cron",
          channelId,
          text: entry.prompt,
        },
        handler,
      );
    });
  });
}

// --- Per-channel FIFO queue ---

async function enqueue(event: IncomingEvent, handler: MessageHandler) {
  const key = event.channelId ?? "_default";
  let ch = channels.get(key);
  if (!ch) {
    ch = { queue: [], processing: false };
    channels.set(key, ch);
  }

  if (ch.queue.length >= MAX_QUEUE) {
    console.warn(`[lituanic] Queue full for ${key}, dropping event`);
    return;
  }

  ch.queue.push(event);

  if (!ch.processing) {
    ch.processing = true;
    while (ch.queue.length > 0) {
      const next = ch.queue.shift()!;
      try {
        await handler(next);
      } catch (err) {
        console.error(`[lituanic] Handler error:`, err);
      }
    }
    ch.processing = false;
  }
}

// --- HMAC ---

function verifyHmac(body: Buffer, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// --- Webhook payload parsing ---

function parseWebhookPayload(
  url: string,
  payload: any,
  defaultChannel?: string,
): IncomingEvent | null {
  // Linear webhook
  if (url.includes("linear")) {
    return parseLinearWebhook(payload, defaultChannel);
  }

  // Generic webhook — pass raw JSON
  return {
    source: "webhook",
    channelId: defaultChannel,
    text: JSON.stringify(payload),
    raw: payload,
  };
}

/**
 * Linear webhook state machine:
 * - Backlog → skip (log only)
 * - Todo / In Progress → active work (dispatch)
 * - Done / Cancelled → stop notification
 * - Comment on assigned issue → dispatch
 * - Unassigned → skip
 */
function parseLinearWebhook(payload: any, channelId?: string): IncomingEvent | null {
  const { type, action, data } = payload;

  // Issues
  if (type === "Issue") {
    const id = data?.identifier ?? data?.id ?? "unknown";
    const title = data?.title ?? "";
    const state = data?.state?.name ?? "";
    const assignee = data?.assignee?.name ?? "";

    // Backlog — skip
    if (state === "Backlog") {
      console.log(`[lituanic] Linear: ${id} in Backlog, skipping`);
      return null;
    }

    // Unassigned — skip
    if (action === "update" && !data?.assignee) {
      console.log(`[lituanic] Linear: ${id} unassigned, skipping`);
      return null;
    }

    // Done / Cancelled — notify
    if (state === "Done" || state === "Canceled" || state === "Cancelled") {
      return {
        source: "webhook",
        channelId,
        text: `Linear issue ${id} "${title}" moved to ${state}. No action needed.`,
        raw: payload,
      };
    }

    // Todo / In Progress — work on it
    if (action === "create" || state === "Todo" || state === "In Progress") {
      return {
        source: "webhook",
        channelId,
        text: `Linear issue ${id} "${title}" is ${state}. Assigned to ${assignee}. Use the Linear skill to read the full issue details and work on it.`,
        raw: payload,
      };
    }

    // Other updates — inform
    return {
      source: "webhook",
      channelId,
      text: `Linear issue ${id} "${title}" updated (${action}). State: ${state}. Check if action is needed.`,
      raw: payload,
    };
  }

  // Comments
  if (type === "Comment") {
    const issueId = data?.issue?.identifier ?? "unknown";
    const body = data?.body ?? "";
    const user = data?.user?.name ?? "someone";

    return {
      source: "webhook",
      channelId,
      text: `New comment on Linear issue ${issueId} by ${user}: "${body.slice(0, 200)}". Read the issue and respond if needed.`,
      raw: payload,
    };
  }

  // Other types — log and skip
  console.log(`[lituanic] Linear webhook: unhandled type ${type}`);
  return null;
}
