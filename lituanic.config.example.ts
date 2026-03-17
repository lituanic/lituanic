import { defineConfig } from "lituanic";

export default defineConfig({
  name: "my-agent",
  model: "claude-sonnet-4-6",
  fallbackModel: "claude-haiku-4-5",
  data: "./data",

  // Slack connection (Socket Mode)
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN!,
    appToken: process.env.SLACK_APP_TOKEN!,
    channel: "C0123456789", // ops channel for errors + notifications
  },

  // Webhook server for Linear events
  webhook: {
    port: 9100,
    routes: {
      "/webhook/linear": {
        secret: process.env.LINEAR_WEBHOOK_SECRET,
        verify: "hmac-sha256",
      },
    },
  },

  // Scheduled events
  schedule: [
    {
      cron: "*/15 * * * *",
      prompt: "Check Linear for assigned issues in Todo or In Progress. Work on the highest priority one.",
      timezone: "Europe/Madrid",
    },
    {
      cron: "0 9,15 * * *",
      prompt: "Draft and schedule a social media post.",
      timezone: "Europe/Madrid",
    },
    {
      cron: "0 8 * * 1",
      prompt: "Weekly review: summarize last week's completed Linear issues, post to Slack.",
      timezone: "Europe/Madrid",
    },
  ],

  // Safety
  maxBudgetUsd: 5.0,
  maxTurns: 50,
  sandbox: false,

  // Health endpoint
  health: {
    port: 9200,
    endpoint: "/health",
  },
});
