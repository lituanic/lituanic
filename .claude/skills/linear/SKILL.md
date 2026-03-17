---
name: linear
description: Manage issues, projects, and milestones in Linear. Use when asked to
  "create an issue", "check Linear", "triage", "update status", "start work",
  or work on assigned tasks.
---

# Linear

Use the Linear GraphQL API via curl. Auth is via `LINEAR_API_KEY` env var (auto-injected).

## API endpoint

```
POST https://api.linear.app/graphql
Authorization: $LINEAR_API_KEY
Content-Type: application/json
```

## Quick reference

### List issues assigned to me
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ viewer { assignedIssues(filter: { state: { type: { in: [\"started\", \"unstarted\"] } } }) { nodes { identifier title state { name } priority priorityLabel } } } }"}' | jq '.data.viewer.assignedIssues.nodes'
```

### View an issue
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ issue(id: \"ISSUE_ID\") { identifier title description state { name } assignee { name } labels { nodes { name } } comments { nodes { body user { name } createdAt } } } }"}' | jq '.data.issue'
```

### Create an issue
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { issueCreate(input: { title: \"Fix auth bug\", teamId: \"TEAM_ID\", priority: 1 }) { success issue { identifier url } } }"}' | jq '.data.issueCreate'
```

### Update issue state
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { issueUpdate(id: \"ISSUE_ID\", input: { stateId: \"STATE_ID\" }) { success } }"}' | jq '.data.issueUpdate'
```

### Add a comment
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { commentCreate(input: { issueId: \"ISSUE_ID\", body: \"Started working on this.\" }) { success } }"}' | jq '.data.commentCreate'
```

### List teams
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ teams { nodes { id name key } } }"}' | jq '.data.teams.nodes'
```

### List workflow states for a team
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ workflowStates(filter: { team: { key: { eq: \"CRAFT\" } } }) { nodes { id name type } } }"}' | jq '.data.workflowStates.nodes'
```

### List labels
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ issueLabels { nodes { id name } } }"}' | jq '.data.issueLabels.nodes'
```

## Autonomous work pattern

When triggered to "check Linear for assigned issues":

1. List issues assigned to you in started/unstarted state.
2. Pick the highest priority issue (priority 1 = urgent, 4 = low).
3. View the full issue (description + comments).
4. Add a workpad comment: "Starting work on this. Plan: ..."
5. Do the work (read code, make changes, run tests).
6. Update the workpad comment with progress.
7. When done, comment with a summary and update state to Done.

## Workpad pattern

Use a single persistent comment per issue for progress tracking:

```
## Workpad — PROJ-123

**Status:** In Progress
**Started:** 2026-03-17

### Plan
1. Fix the auth middleware
2. Add tests
3. Update docs

### Progress
- [x] Read the auth module
- [x] Identified the bug in token validation
- [ ] Writing fix
```

## Rules

- Always check if an issue is already assigned before claiming it.
- Priority scale: 0 = no priority, 1 = urgent, 2 = high, 3 = medium, 4 = low.
- Use `jq` to parse all API responses.
- Mention issue IDs (PROJ-123) in git branch names for auto-linking.
- To find issue IDs, use the `identifier` field (e.g., "PROJ-123"), not the UUID `id`.
- To update state, first list workflow states to get the state ID, then use `issueUpdate`.
