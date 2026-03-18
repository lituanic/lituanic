# TODOs

## Caddy reverse proxy example for webhook TLS

**What:** Add an example Caddy config to `deploy/` for TLS termination on the webhook endpoint (port 9100).

**Why:** Linear sends webhooks over HTTPS. The webhook server serves plain HTTP, so production deployments need a reverse proxy with TLS. Most VPS setups already have one, but a ready-made example lowers the setup friction.

**Context:** The webhook server binds to `0.0.0.0:9100` and serves `/webhook/linear`. A Caddy config would reverse-proxy `https://hooks.yourdomain.com → localhost:9100` with automatic Let's Encrypt certs. This is VPS-specific (requires a domain name), so it's a template, not a hard requirement.

**Depends on:** `deploy/` directory existing (being added in the hardening PR).
