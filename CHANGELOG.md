# Changelog

All notable changes to this project will be documented in this file.

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
