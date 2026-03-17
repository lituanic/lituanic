---
name: browser
description: Browse websites, take screenshots, fill forms, scrape content, and
  automate web interactions. Use when asked to "open a website", "take a screenshot",
  "check a page", "fill a form", "scrape data", or do any web browsing.
---

# Browser (agent-browser CLI)

Use the `agent-browser` CLI via Bash. A Rust-based headless browser for AI agents.

## Quick reference

```bash
# Open a URL
agent-browser open "https://example.com"

# Take a screenshot
agent-browser screenshot /tmp/page.jpg

# Full-page screenshot with element annotations
agent-browser screenshot /tmp/page.jpg --full --annotate

# Get page snapshot (accessibility tree with interactive element refs)
agent-browser snapshot -i

# Click an element (refs from snapshot: @e1, @e2, etc.)
agent-browser click @e3

# Fill a form field
agent-browser fill @e5 "hello@example.com"

# Type text (without clearing first)
agent-browser type @e5 "additional text"

# Press a key
agent-browser press Enter

# Scroll down
agent-browser scroll down 500

# Get text content
agent-browser get text "h1"

# Get current URL
agent-browser get url

# Wait for element or time
agent-browser wait ".loaded" --state visible
agent-browser wait 2000

# Evaluate JavaScript
agent-browser eval "document.title"

# Close the browser
agent-browser close
```

## Workflow pattern

1. `open <url>` — navigate to the page
2. `snapshot -i` — get the accessibility tree with interactive element refs (@e1, @e2...)
3. Interact: `click @e3`, `fill @e5 "text"`, `press Enter`
4. `snapshot -i` again — refs are invalidated after any DOM change
5. `screenshot /tmp/result.jpg` — capture the result

## Screenshots

```bash
# Set retina viewport (1400x735 at 2x)
agent-browser set viewport 1400 735 2

# JPEG screenshot (default)
agent-browser screenshot /tmp/page.jpg

# Full-page screenshot
agent-browser screenshot /tmp/full.jpg --full

# Annotated screenshot (numbered labels on interactive elements)
agent-browser screenshot /tmp/annotated.jpg --annotate
```

## Sessions

```bash
# Persistent session (saves cookies + localStorage across runs)
agent-browser --session-name mysite open "https://example.com"
agent-browser --session-name mysite screenshot /tmp/page.jpg
agent-browser --session-name mysite close

# List saved sessions
agent-browser state list
```

## Tabs

```bash
# Open new tab
agent-browser tab new "https://other.com"

# List tabs
agent-browser tab

# Switch to tab 2
agent-browser tab 2

# Close current tab
agent-browser tab close
```

## Cloud browser (Kernel)

For sites with bot detection, CAPTCHAs, or when you need stealth:

```bash
# Use Kernel cloud browser (requires KERNEL_API_KEY env var)
agent-browser -p kernel open "https://example.com"
agent-browser -p kernel screenshot /tmp/page.jpg
agent-browser -p kernel close
```

## Cookie and page cleanup

```bash
# Remove cookie banners, chat widgets, popups before screenshots
agent-browser eval "document.querySelectorAll('[class*=cookie],[class*=consent],[class*=popup],[class*=chat-widget]').forEach(e => e.remove())"

# Set Mac-like font rendering
agent-browser eval "document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'"
```

## Rules

- Element refs (`@e1`, `@e2`) are invalidated after ANY page change. Always re-snapshot after navigation, form submission, or clicks that cause DOM updates.
- Use `snapshot -i` to discover interactive elements, NOT CSS selectors. The refs are more reliable.
- Default viewport is 1280x720. Set `1400 735 2` for retina screenshots.
- Screenshots save as JPEG by default. Specify `.png` extension for PNG.
- Use `--session-name` (not `--session`) for persistent cookies across runs.
- For complex JavaScript, use `eval --stdin <<'EOF'` to avoid shell escaping issues.
- Install: `npm i -g agent-browser && agent-browser install`
