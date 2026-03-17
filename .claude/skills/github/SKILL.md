---
name: github
description: Manage repositories, pull requests, issues, and releases on GitHub.
  Use when asked to "create a PR", "check CI", "merge", "create a release",
  "open an issue", or do any GitHub operations.
---

# GitHub (gh CLI)

Use the `gh` CLI via Bash. Auth is via `GH_TOKEN` env var (auto-injected).

## Pull requests

```bash
# Create a PR
gh pr create --title "Fix auth bug" --body "Fixes the token validation issue."

# Create PR from current branch to main
gh pr create --base main --fill

# List open PRs
gh pr list

# View a PR
gh pr view 42

# Check CI status
gh pr checks 42

# Merge a PR
gh pr merge 42 --squash --delete-branch

# Review a PR
gh pr diff 42
gh pr review 42 --approve
```

## Issues

```bash
# Create an issue
gh issue create --title "Bug: login fails" --body "Steps to reproduce..."

# List issues
gh issue list --state open

# View an issue
gh issue view 123

# Close an issue
gh issue close 123 --comment "Fixed in #42"
```

## Repositories

```bash
# Clone a repo
gh repo clone owner/repo

# Create a new repo
gh repo create my-project --public --description "My project"

# View repo info
gh repo view owner/repo

# Fork a repo
gh repo fork owner/repo --clone
```

## Releases

```bash
# Create a release
gh release create v1.0.0 --title "v1.0.0" --notes "First release"

# Create release with auto-generated notes
gh release create v1.0.0 --generate-notes

# List releases
gh release list

# Upload assets to a release
gh release upload v1.0.0 ./dist/app.zip
```

## Actions / CI

```bash
# List workflow runs
gh run list

# View a specific run
gh run view 12345

# Watch a run in progress
gh run watch 12345

# Re-run a failed workflow
gh run rerun 12345 --failed

# View workflow logs
gh run view 12345 --log-failed
```

## API (raw)

```bash
# GET request
gh api repos/owner/repo/pulls

# POST request
gh api repos/owner/repo/issues -f title="Bug" -f body="Description"

# GraphQL
gh api graphql -f query='{ viewer { login } }'

# Paginated listing
gh api repos/owner/repo/issues --paginate
```

## Git workflow

```bash
# Standard PR workflow
git checkout -b fix/auth-bug
# ... make changes ...
git add -A
git commit -m "fix: resolve token validation issue"
git push -u origin fix/auth-bug
gh pr create --fill

# After PR is approved
gh pr merge --squash --delete-branch
```

## Rules

- Always create PRs for code changes — never push directly to main.
- Use conventional commit prefixes: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`.
- Include issue references in PR descriptions (e.g., "Fixes #123").
- Check CI status before merging: `gh pr checks`.
- Use `--squash` for clean history when merging.
- Use branch names that reference issues: `fix/PROJ-123-auth-bug`.
