# Changelog

All notable changes to this project will be documented in this file.

## [0.1.3] - 2026-03-17

### Added
- Rich terminal debug logging. Each request now shows:
  - On start: `session: <id> model: <name> tools: <count>`
  - Per tool call: `↳ ToolName: preview [in:N out:N]` with per-turn token counts
  - On completion: `→ success | 7t | 1240ms (api:980ms) | in:2341 out:456 cache↩:1200 | claude-sonnet-4-6 $0.1659`
- The result object now exposes duration, API latency, token breakdown, and per-model cost — useful if you're building on top of Lituanic and want to surface these metrics

## [0.1.2] - 2026-03-17

### Added
- Markdown → Slack mrkdwn conversion: `**bold**` → `*bold*`, `[text](url)` → `<url|text>`, `# Heading` → `*Heading*`. Responses now render correctly in Slack instead of showing raw markdown.
- `mrkdwn: true` flag on all `chat.postMessage` calls.
- Tool call logging to terminal: each tool the agent uses prints `↳ ToolName: preview` so you can follow along locally.

## [0.1.1] - 2026-03-17

### Fixed
- Thread continuity broken — follow-up messages in a Slack thread now resume the same agent session instead of starting fresh. Root cause: gateway used `event.ts` (the message's own timestamp) instead of `event.thread_ts` (the parent thread) as the session key.
- Bot self-reply loop in DMs — added `bot_id` check to skip messages sent by the bot itself, preventing infinite reply loops.
- Invalid Slack Block Kit format — removed `blocks: [{ type: "markdown" }]` which is not a valid Slack block type. Responses now use the `text` field only.
- Long responses failing silently — Slack rejects messages over ~40K chars. Responses are now truncated at 3,900 chars with a note showing the original length.

### Added
- Terminal logging — daemon now prints `← source #channelId: preview` on incoming events and `→ Nt stopReason $cost: preview` on completion, so you can see what's happening locally.
- Slack app setup guide in README — step-by-step instructions for creating a Slack app with the required OAuth scopes (`app_mentions:read`, `chat:write`, `im:history`, `im:read`, `reactions:write`) and event subscriptions (`app_mention`, `message.im`).
- `[SILENT]` convention in Slack skill — after using `slack_reply`, the agent now returns `[SILENT]` to prevent the gateway from double-posting the response.

## [0.1.0] - 2026-03-15

Initial release. AI coworker for solo founders. Thin wiring layer on the Claude Agent SDK with 6 built-in integrations: Slack, Linear, 1Password, Google Workspace, Browser, GitHub.
