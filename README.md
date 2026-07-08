# Agent Board

[![CI](https://github.com/dmidnight/agent-board/actions/workflows/ci.yml/badge.svg)](https://github.com/dmidnight/agent-board/actions/workflows/ci.yml)

A lightweight Trello-style kanban app built with Next.js, MongoDB, and Mongoose. It starts with email/password auth and a board model shaped for agentic workflows: stable ticket IDs, objectives, acceptance criteria, agent notes, and automation metadata.

## Features

- Email/password registration, sign-in, and sign-out.
- Multi-team workspaces with required unique team names and an active team switcher.
- Owner-created invitation tokens for adding members to an existing team.
- Team-scoped seeded board and ticket data for every team.
- Add, rename, and delete empty columns.
- Add, edit, move, search, and delete tickets.
- Upload and download ticket attachments through private object storage.
- Drag/drop ticket movement plus an inspector column selector for deterministic moves.
- Agent-oriented ticket fields: API ID, objective, acceptance criteria, agent notes, priority, owner/agent, labels, and automation hooks.
- Authenticated JSON API routes for board reads and mutations.
- Portable agent skill/plugin packages for Codex and Claude in `integrations/`.

## Development

1. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

2. Start MongoDB:

   ```bash
   docker compose up -d
   ```

3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:3000 and create an account with a team name.

## Multi-Tenant Security Model

A team is the tenant boundary for board, ticket, approval, and attachment data.
Users can belong to multiple teams, but only one team is active in a session at a
time.

- Team names are normalized and stored with a unique lowercase key.
- Team membership is stored on the team document. Users store an active `teamId`
  for convenience, but protected APIs reload and verify membership from MongoDB
  before reading or changing board data.
- Board lookups are scoped by the active `teamId`; a valid board ID alone is not
  enough to access confidential ticket data.
- Users can create additional teams, join another team with an invitation token,
  and switch active teams from the app sidebar.
- Invitation tokens are random, expire after seven days, and are stored only as
  SHA-256 hashes in MongoDB. The raw invitation URL is shown once when an owner
  creates it.
- Invitations can be restricted to a specific email address. Blank invite email
  creates a bearer invite for the team, so share those links carefully.
- Only team owners can create invitations for the active team.
- Keep `MONGODB_URI` and `SESSION_SECRET` in Kubernetes Secrets. Do not log
  ticket bodies, approval prompts, attachment names, or invitation tokens.

## Agent Integrations

The `integrations/` directory contains reusable packages so agents can work from
Agent Board tickets without long setup prompts:

- `integrations/codex/plugins/agent-board`: Codex plugin with the Agent Board
  skill.
- `integrations/claude/skills/agent-board`: Claude skill bundle.

Both packages include a dependency-free Node client at
`scripts/agent-board-client.mjs`. Configure it with `AGENT_BOARD_URL` plus either
`AGENT_BOARD_EMAIL`/`AGENT_BOARD_PASSWORD` or `AGENT_BOARD_COOKIE`.

The app exposes `GET /api/boards/current` as the agent-friendly discovery
endpoint for the authenticated user's active team board. It also returns the
user's team memberships so clients can show which team is active.

Execution approvals should use portable scopes such as `Current repository
checkout` plus repo-relative file globs. Do not put developer-specific absolute
filesystem paths in tickets; new approval requests with absolute local paths are
rejected.

## Scripts

- `npm run dev` starts the Next.js dev server.
- `npm run build` creates a production build.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run lint` runs ESLint.
- `npm test` runs the Node test suite for validation and attachment helpers.

## Continuous Integration

GitHub Actions runs on pushes to `main` and on pull requests. The CI workflow
installs dependencies with `npm ci`, audits production dependencies, runs lint,
typecheck, tests, a production Next.js build, and a Docker image build. Dependabot
is configured for weekly npm and GitHub Actions updates.

## Docker And Kubernetes

The app is configured with Next.js standalone output, so the Docker image includes the server bundle and runtime npm modules needed to run outside Vercel.

Build the image:

```bash
docker build -t agent-board:latest .
```

Run it locally against any MongoDB URI:

```bash
docker run --rm -p 3000:3000 \
  -e MONGODB_URI="mongodb://user:password@mongo.example:27017/agentboard?authSource=admin" \
  -e SESSION_SECRET="replace-with-a-long-random-secret" \
  -e SESSION_COOKIE_SECURE="false" \
  agent-board:latest
```

Required runtime environment variables:

- `MONGODB_URI`: connection string for your MongoDB cluster.
- `SESSION_SECRET`: long random string used to sign session cookies.

Optional:

- `SESSION_COOKIE_SECURE`: set to `false` only when testing the production image over plain local HTTP. Defaults to secure cookies in production.
- `NEXT_PUBLIC_APP_NAME`: display/app metadata value. Defaults are safe if omitted.

Kubernetes deployment notes:

- Expose container port `3000`.
- Use `/api/health` for liveness/readiness probes.
- Store `MONGODB_URI` and `SESSION_SECRET` in Kubernetes Secrets, not in the image.
- Leave `SESSION_COOKIE_SECURE` unset when the app is served through HTTPS ingress.
- Update the image in `k8s/deployment.yaml` to your registry tag, then create the secret and apply the manifest:

  ```bash
  kubectl create secret generic agent-board-secrets \
    --from-literal=MONGODB_URI="mongodb://user:password@mongo.example:27017/agentboard?authSource=admin" \
    --from-literal=SESSION_SECRET="replace-with-a-long-random-secret"

  kubectl apply -f k8s/deployment.yaml
  ```

## Ticket Attachments Storage

Ticket images and files are stored in object storage. MongoDB stores attachment
metadata only: team, board, ticket, uploader, source, object key, original
filename, content type, byte size, checksum, and approval nonce for
agent-generated files.

Supported providers:

- `s3`: AWS S3 and S3-compatible stores such as MinIO.
- `gcs`: Google Cloud Storage through the native Google Cloud client.

Common runtime variables:

```bash
ATTACHMENT_STORAGE_PROVIDER=s3
ATTACHMENT_BUCKET=agent-board-attachments
ATTACHMENT_BASE_PREFIX=attachments
ATTACHMENT_MAX_BYTES=10485760
```

Provider-specific variables:

```bash
# AWS S3 or S3-compatible storage
ATTACHMENT_REGION=us-east-1
ATTACHMENT_ENDPOINT=              # omit for AWS S3; set for MinIO/R2/etc.
ATTACHMENT_FORCE_PATH_STYLE=false # true for MinIO
ATTACHMENT_ACCESS_KEY_ID=         # optional when using IAM roles
ATTACHMENT_SECRET_ACCESS_KEY=     # optional when using IAM roles

# Google Cloud Storage
ATTACHMENT_STORAGE_PROVIDER=gcs
ATTACHMENT_GCS_PROJECT_ID=your-project-id # optional with workload identity
```

### Local Docker Compose

`docker compose up -d` starts MongoDB and MinIO. The MinIO console is available
at http://localhost:9001 with:

- user: `agentboard`
- password: `agentboard-secret`

The compose file creates a private `agent-board-attachments` bucket. The default
`.env.example` is already configured for this local MinIO instance:

```bash
ATTACHMENT_STORAGE_PROVIDER=s3
ATTACHMENT_BUCKET=agent-board-attachments
ATTACHMENT_ENDPOINT=http://localhost:9000
ATTACHMENT_FORCE_PATH_STYLE=true
ATTACHMENT_ACCESS_KEY_ID=agentboard
ATTACHMENT_SECRET_ACCESS_KEY=agentboard-secret
```

### AWS S3

Create a private S3 bucket and give the app permission for object reads/writes
under the configured prefix. Minimum object actions for attachment use are
`s3:PutObject` and `s3:GetObject`; `s3:DeleteObject` will be needed if delete
support is added later. Use IAM roles for Kubernetes service accounts where
possible instead of static keys.

Example env:

```bash
ATTACHMENT_STORAGE_PROVIDER=s3
ATTACHMENT_BUCKET=agent-board-prod-attachments
ATTACHMENT_REGION=us-east-1
ATTACHMENT_BASE_PREFIX=attachments
```

### Google Cloud Storage

Create a private Cloud Storage bucket and run the app with:

```bash
ATTACHMENT_STORAGE_PROVIDER=gcs
ATTACHMENT_BUCKET=agent-board-prod-attachments
ATTACHMENT_BASE_PREFIX=attachments
ATTACHMENT_GCS_PROJECT_ID=your-project-id
```

On GKE, prefer Workload Identity Federation for the app service account. For
simple deployments, grant the workload identity the ability to create and read
objects in the bucket. Avoid public buckets and avoid static service account keys
unless there is no better option.

### Attachment Security Model

- Humans upload/download attachments through authenticated app routes.
- Agents upload files through authenticated app routes after a ticket run is
  approved; agent uploads must provide the matching approval nonce.
- The app writes objects under tenant-scoped prefixes, for example:
  `attachments/teams/{teamId}/tickets/{ticketId}/human/{uuid}-{filename}` and
  `attachments/teams/{teamId}/tickets/{ticketId}/agent/{approvalNonce}/{uuid}-{filename}`.
- Keep buckets private. The app checks team membership before upload/download and
  proxies downloads rather than exposing public object URLs.
- Validate ticket ownership, file size, MIME type, and filename before storing an
  object.
- Add lifecycle rules later for old closed-ticket attachments or temporary agent
  artifacts.

Useful provider docs:

- AWS S3 permissions:
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-policy-actions.html
- GKE Workload Identity Federation:
  https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity
- MinIO containers:
  https://min.io/docs/minio/container/index.html
