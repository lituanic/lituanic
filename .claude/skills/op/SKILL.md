---
name: op
description: Read secrets from 1Password using the op CLI. Use when asked to
  "get a secret", "look up credentials", "check 1Password", or when you need
  an API key or token that isn't in the environment.
---

# 1Password (op CLI)

Use the `op` CLI via Bash. Auth is via `OP_SERVICE_ACCOUNT_TOKEN` env var (auto-injected).

## Quick reference

```bash
# Read a secret field
op read "op://VaultName/ItemName/fieldName"

# Read without trailing newline (for piping)
op read --no-newline "op://VaultName/ItemName/fieldName"

# List items in a vault
op item list --vault "VaultName"

# Get all fields of an item as JSON
op item get "ItemName" --vault "VaultName" --format json --reveal

# Get a specific field
op item get "ItemName" --vault "VaultName" --fields "fieldName" --reveal
```

## Rules

- ALWAYS use `--reveal` with `op item get`. Without it, secret values are concealed. (`op read` always reveals — no flag needed.)
- NEVER log, print, or post secrets to Slack. Use them inline in commands.
- NEVER write secrets to files. Pass them as env vars or pipe them.
- Prefer `op read "op://Vault/Item/field"` for single values.
- Use `op item get ... --format json --reveal` for multi-field items.
- Secret reference URIs (`op://...`) are case-insensitive.
- With service accounts, always specify `--vault` for item commands.

## Patterns

### Inject a secret into a command
```bash
GITHUB_TOKEN=$(op read --no-newline "op://MyVault/GitHub/token") gh pr create ...
```

### Check if op is available
```bash
op --version
```

### List vaults
```bash
op vault list
```

## When NOT to use op

- If the secret is already in the environment (check `echo $VAR_NAME` first).
- Most secrets should be injected at startup via `op run --env-file=.env.op -- bun start`.
- Only use `op read` at runtime for secrets not in the environment.
