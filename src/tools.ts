import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { App } from "@slack/bolt";
import type { IncomingEvent } from "./gateway.js";

function toMrkdwn(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, "*$1*")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>")
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*");
}

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
      await slack.client.chat.postMessage({ channel: ch, thread_ts: ts, text: toMrkdwn(text), mrkdwn: true });
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

  const slackUploadFile = tool(
    "slack_upload_file",
    "Upload a local file (image, PDF, etc.) to a Slack thread.",
    {
      file_path: z.string().describe("Absolute path to the local file to upload"),
      channel: z.string().describe("Slack channel ID"),
      thread_ts: z.string().optional().describe("Thread timestamp to upload into"),
      initial_comment: z.string().optional().describe("Optional message to accompany the file"),
    },
    async ({ file_path, channel, thread_ts, initial_comment }) => {
      const ch = channel ?? event.channelId ?? "";
      const ts = thread_ts ?? event.threadTs;
      const file = readFileSync(file_path);
      const filename = basename(file_path);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (slack.client.files.uploadV2 as any)({ channel_id: ch, thread_ts: ts, filename, file, initial_comment });
      return { content: [{ type: "text" as const, text: `Uploaded ${filename} to ${ch}` }] };
    },
  );

  return createSdkMcpServer({ name: "slack", tools: [slackReply, slackReact, slackUploadFile] });
}
