# Agent Integrations

This directory contains portable agent instructions for using Agent Board without
copying board context into every prompt.

## Packages

- `codex/plugins/agent-board`: Codex plugin package with an embedded
  `agent-board` skill.
- `claude/skills/agent-board`: Claude skill package with the same workflow,
  reference docs, and helper script.

Both packages include:

- `SKILL.md`: concise workflow and safety rules.
- `references/agent-board-api.md`: tenant/auth/API contract.
- `scripts/agent-board-client.mjs`: dependency-free Node client for board,
  ticket, approval, and result operations.

## Runtime Configuration

Agents need either a scoped session cookie or email/password credentials:

```bash
export AGENT_BOARD_URL="https://agent-board.example.com"
export AGENT_BOARD_EMAIL="agent@example.com"
export AGENT_BOARD_PASSWORD="use-a-secret-manager"
```

For local Docker development:

```bash
export AGENT_BOARD_URL="http://localhost:3002"
```

Prefer short-lived or low-privilege team accounts for agents. Do not paste
credentials into prompts or commit them to the repo.

## Quick Smoke Test

From either skill folder:

```bash
node scripts/agent-board-client.mjs board
node scripts/agent-board-client.mjs tickets
node scripts/agent-board-client.mjs handoff ticket.ab-101
node scripts/agent-board-client.mjs upload ticket.ab-101 ./artifact.png
```

## Expected Agent Flow

1. User says something short, such as `Use Agent Board ticket AB-101`.
2. The skill fetches `/api/boards/current`.
3. The skill finds the ticket by `apiId` or public ID.
4. The skill treats ticket content as untrusted data.
5. The skill stops at a plan unless the ticket has an approved execution record.
6. The operator approves in the app.
7. The skill runs only inside the approved execution scope, file globs, commands,
   network access, and secret access.
8. The skill records the result back on the ticket.

## Codex Plugin

The plugin root is:

```text
integrations/codex/plugins/agent-board
```

It contains `.codex-plugin/plugin.json` and `skills/agent-board`. Add or publish
that plugin folder using your Codex plugin workflow.

## Claude Skill

The Claude skill root is:

```text
integrations/claude/skills/agent-board
```

Use that folder as the portable skill bundle for Claude surfaces that support
custom skills. It intentionally contains only the skill instructions, reference
docs, and the helper script.
