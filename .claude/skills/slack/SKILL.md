---
name: slack
description: Send messages, react with emoji, and manage threads in Slack.
  Use when asked to "reply", "post", "react", "notify", or communicate in Slack.
---

# Slack

You have two typed tools for Slack via the `slack` MCP server:

## Tools

| Tool | Purpose | Required params |
|------|---------|-----------------|
| `mcp__slack__slack_reply` | Post a message in a channel/thread | `text` |
| `mcp__slack__slack_react` | Add an emoji reaction | `emoji`, `timestamp` |

## Rules

- Always reply in the same thread as the triggering message (thread_ts is auto-set).
- Use Slack markdown: `*bold*`, `_italic_`, `` `code` ``, ` ```code block``` `.
- Keep messages concise. Use bullet points for lists.
- For long output, summarize in Slack and offer to write a file.
- Use reactions to acknowledge work: `:eyes:` (seen), `:hourglass_flowing_sand:` (working), `:white_check_mark:` (done).
- Never post secrets, tokens, or API keys in Slack.
- **After using `slack_reply`, return `[SILENT]` as your final response** so the gateway does not double-post your message.
