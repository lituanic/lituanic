import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { App } from "@slack/bolt";
import type { IncomingEvent } from "./gateway.js";

export function createSlackMcpServer(slack: App, event: IncomingEvent) {
  const slackReply = tool(
    "slack_reply",
    "Reply in a Slack thread. Use instead of bash for Slack messages.",
    {
      channel: z.string().describe("Slack channel ID"),
      thread_ts: z.string().optional().describe("Thread timestamp"),
      text: z.string().describe("Message text (supports Slack markdown)"),
    },
    async ({ channel, thread_ts, text }) => {
      const ch = channel ?? event.channelId ?? "";
      const ts = thread_ts ?? event.threadTs;
      await slack.client.chat.postMessage({ channel: ch, thread_ts: ts, text });
      return { content: [{ type: "text" as const, text: `Sent to ${ch}` }] };
    },
  );

  const slackReact = tool(
    "slack_react",
    "Add an emoji reaction to a Slack message.",
    {
      channel: z.string().describe("Slack channel ID"),
      timestamp: z.string().describe("Message timestamp to react to"),
      emoji: z.string().describe("Emoji name without colons"),
    },
    async ({ channel, timestamp, emoji }) => {
      const ch = channel ?? event.channelId ?? "";
      const ts = timestamp ?? event.threadTs ?? "";
      await slack.client.reactions.add({ channel: ch, timestamp: ts, name: emoji });
      return { content: [{ type: "text" as const, text: `Reacted :${emoji}:` }] };
    },
  );

  return createSdkMcpServer({ name: "slack", tools: [slackReply, slackReact] });
}
