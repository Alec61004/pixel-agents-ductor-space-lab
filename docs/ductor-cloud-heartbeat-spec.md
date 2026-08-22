# Ductor Cloud Heartbeat Contract

## Objective

Publish only the three Ductor role states from the strict repo-local status file to a
Vercel-authenticated preview deployment. State changes propagate without a deploy or
server restart; an absent, stopped, stale, or invalid source is represented honestly as
offline. Generic Pixel Agents modes remain unchanged.

## Capabilities and order

1. `cloud-contract`: strict public snapshot, HMAC request authentication, replay/freshness
   checks, stale projection, and a storage interface.
2. `cloud-runtime`: Vercel read/write functions backed by a private Vercel Blob store.
3. `publisher`: opt-in repo-local loop that reads the existing hardened status boundary,
   sends changes immediately, and sends a bounded keepalive at most every 30 minutes.
4. `cloud-ui`: the existing DuctorLab same-origin poller accepts provenance and stale state.

Dependencies flow in that order. No capability modifies Ductor core/config or upstream
office modes.

## Tech stack and commands

- Node.js/TypeScript, React/Vite, Vitest, Vercel Functions, private Vercel Blob.
- Focused test: `npm run test:cloud`
- Full verification: `npm test && npm run package && npm audit --omit=dev`
- Publisher: `npm run ductor:publish -- --config .ductor-space-lab/cloud.env`

## Project structure and style

- `api/_lib/`: small framework-neutral boundary and store modules.
- `api/ductor/`: Vercel handlers.
- `scripts/`: publisher CLI using existing synchronous file-boundary conventions.
- `server/__tests__/` and `webview-ui/test/`: behavior-first tests.

Use explicit allowlists, dependency injection at external boundaries, descriptive names,
and built-in platform primitives unless the official Blob SDK is required.

## Security and privacy boundaries

- Always: HTTPS; exact roles/states/properties; 16 KiB cap; sanitized 120-character labels;
  timing-safe HMAC; 60-second signed-request freshness; persisted monotonic timestamp/nonce;
  same-origin CORS; generic failures; security headers; private Blob; no-store API responses.
- Ask first: a public production domain, paid plan/add-on, or third-party persistence.
- Never: transmit or log chat bodies, prompts, results, paths, tokens, environment contents,
  arbitrary metadata, or secrets; use serverless filesystem as storage; bind beyond localhost.

The deployment URL is a Vercel-authenticated non-production deployment. The local
publisher uses both the project automation-bypass header and a separate HMAC write secret.
Reads expose neither secret.

## Freshness and cost bounds

- The publisher checks locally every 5 seconds, writes immediately when the allowlisted
  snapshot changes, and otherwise writes at most once per 30 minutes.
- The read endpoint marks every role offline when the last accepted publish is older than
  45 minutes. A local report older than 45 minutes is published as derived offline.
- These defaults bound an unchanged Hobby deployment to at most 1,440 Blob writes per
  30-day month, below the included 2,000 advanced operations; frequent real state changes
  consume the remaining allowance and fail closed when service limits are reached.

## Success criteria

- RED/GREEN tests cover schema allowlists/redaction, signature/timing, replay, rate bound,
  stale/offline, publisher change detection, backoff/timeouts, and exact three roles.
- A private GitHub repository receives only reviewed commits through a separate remote.
- A protected Vercel deployment uses private native durable storage and returns HTTP 200
  only with Vercel authentication/bypass.
- One local publisher changes all three live states without redeploy/restart; browser checks
  exact accessible cards, clean console/network, no `/ws`, and responsive layout.
- Rollback is a previous immutable Vercel deployment or `git revert`; publisher stops with
  Ctrl-C/SIGTERM and no persistent daemon is installed.
