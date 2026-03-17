---
name: gws
description: Manage email, calendar, and drive via Google Workspace. Use when asked to
  "send an email", "check email", "schedule a meeting", "create a document",
  "upload to drive", or manage Google Workspace resources.
---

# Google Workspace (gws CLI)

Use the `gws` CLI from `@googleworkspace/cli` via Bash. Auth is via GWS credential env vars.

The `gws` CLI dynamically generates commands from Google's API. Use `gws schema` to discover available methods.

## Email (Gmail)

```bash
# Send an email
gws gmail +send --to "user@example.com" --subject "Subject" --body "Body text"

# Send with HTML
gws gmail +send --to "user@example.com" --subject "Subject" --html "<h1>Hello</h1>"

# List recent messages
gws gmail messages list --params '{"maxResults": 10}'

# Read a specific message
gws gmail messages get --params '{"id": "MESSAGE_ID", "format": "full"}'

# Search emails
gws gmail messages list --params '{"q": "from:user@example.com after:2026/03/01", "maxResults": 10}'

# Triage inbox (helper)
gws gmail +triage
```

## Calendar

```bash
# Show today's agenda
gws calendar +agenda --today

# Show this week
gws calendar +agenda --week

# Create an event
gws calendar +insert --summary "Meeting" --start "2026-03-18T10:00:00" --end "2026-03-18T11:00:00"

# Create with attendees
gws calendar +insert --summary "Meeting" --start "2026-03-18T10:00:00" --end "2026-03-18T11:00:00" --attendees "user@example.com"

# List events (raw API)
gws calendar events list --params '{"timeMin": "2026-03-17T00:00:00Z", "maxResults": 10}'

# Delete an event
gws calendar events delete --params '{"eventId": "EVENT_ID"}'
```

## Drive

```bash
# List files
gws drive files list --params '{"pageSize": 10}'

# Upload a file
gws drive +upload --file ./report.pdf --name "Q1 Report"

# Download a file
gws drive +download --file-id "FILE_ID" --output ./downloaded.pdf

# Create a folder
gws drive files create --json '{"name": "Project Files", "mimeType": "application/vnd.google-apps.folder"}'

# Search files
gws drive files list --params '{"q": "name contains '\''report'\''", "pageSize": 10}'
```

## Discovery

```bash
# List available Gmail methods
gws schema gmail

# Show method details
gws schema gmail.users.messages.send

# List all available services
gws schema
```

## Rules

- Helper commands use `+` prefix (e.g., `+send`, `+agenda`, `+upload`). These are simplified wrappers.
- Raw API access uses `gws <service> <resource> <method> --params '{...}'` or `--json '{...}'`.
- Use `gws schema <service>` to discover available methods and parameters.
- Always check before sending emails — confirm recipient and content.
- For calendar events, use ISO 8601 timestamps with timezone.
- Use `--format json` for programmatic processing of results.
- Install: `npm i -g @googleworkspace/cli`
