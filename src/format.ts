/**
 * Convert standard Markdown to Slack mrkdwn format.
 * Claude outputs GitHub-flavored markdown; Slack needs its own dialect.
 */
export function toMrkdwn(text: string): string {
  return text
    // Bold: **text** → *text*
    .replace(/\*\*(.+?)\*\*/gs, "*$1*")
    // Links: [text](url) → <url|text>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>")
    // Headings: ## Title → *Title*
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*");
}
