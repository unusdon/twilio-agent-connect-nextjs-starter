# Deployment

The agent and the dashboard have different deployment shapes because they have different runtime characteristics.

## Agent — long-running Node process required

TAC's `TACServer` is a Fastify app that:

- Registers WebSocket routes for Voice (Conversation Relay)
- Holds per-conversation state in-memory between turns
- Needs to survive across many minutes of a single conversation

That rules out serverless (Vercel Functions, Netlify Functions, AWS Lambda) as the primary path. You want a persistent Node process on:

- **Fly.io** — recommended for simplicity. Run `fly launch` at the repo root; when Fly prompts for a Dockerfile, generate a minimal one (`FROM node:22-alpine`, copy the monorepo, `npm ci && npm --workspace @tac-starter/shared run build && npm --workspace @tac-starter/agent run build`, expose `AGENT_PORT`, run `node apps/agent/dist/index.js`). One instance per region, autoscale disabled. A first-class Dockerfile is on the v1.1 roadmap.
- **Railway** — one service, `npm --workspace @tac-starter/agent run start` as the start command.
- **Render** — Web Service, same command, disable auto-idle so the process stays warm.
- **A VM** (EC2, DigitalOcean droplet, Hetzner) — `pm2 start dist/index.js --name tac-agent`.

**Multi-instance:** if you scale beyond one instance, you must either hash-route requests by `conversationId` at the load balancer, or implement a Redis-backed `HistoryStore` and pass it into `handleMessage`'s `deps`. See [`AGENT.md`](AGENT.md#multi-instance-deployment).

## Dashboard — anywhere

The dashboard is a standard Next.js 15 app with no long-running runtime requirements. Options:

- **Vercel** — deploy from the monorepo root, set the project root to `apps/dashboard`. Note that in this setup the dashboard cannot tail the agent's local event log file — you'd need to switch the sink to a shared store (Redis, DynamoDB, S3) and adapt `loadEvents()` accordingly.
- **Same host as agent** — deploy dashboard alongside agent so both read/write the same event log file. Simpler, and the recommended path for v1.0.

## Environment variables in production

Every value in `.env.example` is required in production, except:

- `AGENT_EVENT_LOG` — omit to use the default `./data/events.jsonl`.
- `TWILIO_STUDIO_HANDOFF_FLOW_SID` — omit to disable the handoff tool cleanly.
- `DASHBOARD_MODE` — set to `live` in production (default is `demo` for evaluation).

`TAC_PUBLIC_URL` in production is the public URL of your agent host — not an ngrok URL. Twilio hits this for webhooks and WebSocket streaming; must be HTTPS with a valid certificate.

## Health-check endpoint

`TACServer` exposes `/health` out of the box (returns 200 if the framework is initialized). Configure your platform's health check to hit that path.

## Cost notes

- **Twilio** — TAC is included with a paid Conversations account; Memory Store operations are billed per Recall call. Budget for one Recall per user turn.
- **Anthropic** — Claude Sonnet 4.6 at typical starter usage (~600-token system prompt, ~50-token responses, prompt cache hits after turn 1) is ~$0.002 per turn. Budget accordingly.
- **Hosting** — a single Fly.io shared-cpu-1x instance ($1.94/mo) handles ~50 concurrent conversations comfortably.

## Rollback

Every event in the observability log is timestamped, so if you roll back to an older agent version you can still read historical traces from the same log file — the event schema is versioned in `packages/shared/src/events.ts` and additions are backwards-compatible.
