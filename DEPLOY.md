# Deploy Runbook — Receipt Scanner

This app is a **standalone container** served at `https://japnam.tech/receipt`
through the existing Traefik (path-strip + letsencrypt). It is **not** part of
the portfolio/hibid stacks. Deploying the portfolio does nothing for `/receipt`.

Two ways to deploy:

1. **Automated (recommended)** — GitHub Actions SSHes into the VPS and runs the
   deploy after every green CI run on `main`. See [Automated deploy](#automated-deploy-github-actions).
2. **Manual** — SSH in yourself and run a couple of commands. See
   [Manual deploy](#manual-deploy).

---

## Prerequisites on the VPS

- Docker + Docker Compose v2 (`docker compose` subcommand).
- Git.
- Inbound SSH (port 22) reachable from the public internet (GitHub's runners
  need it) **or** from whatever host runs the workflow.
- The app directory `/opt/data/receipt-scanner` containing a `.env` file
  (gitignored — never committed).

> The `.env` carries `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Because it is
> gitignored, **you create it once on the VPS**; neither CI nor the repo ships it.
> A missing `.env` makes the deploy fail fast with a clear error.

---

## Automated deploy (GitHub Actions)

### 1. Add GitHub repository secrets

In **Settings → Secrets and variables → Actions → Repository secrets**, add:

| Secret           | Value                                                          |
| ---------------- | ------------------------------------------------------------- |
| `VPS_HOST`       | VPS public IP or hostname (e.g. `srv1865422.hstgr.cloud`)     |
| `VPS_USER`       | SSH user that can `docker compose` (e.g. `root`)              |
| `VPS_SSH_KEY`    | **private** key (OpenSSH format) for that user                |
| `GH_PULL_TOKEN`  | *optional* — a GitHub PAT with `repo` read if the repo is **private** (omit for a public repo) |

Generate a dedicated deploy key on the VPS:

```bash
# on the VPS, as the deploy user
ssh-keygen -t ed25519 -N "" -f ~/.ssh/github_deploy
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
# paste the PRIVATE key (~/.ssh/github_deploy) contents into the VPS_SSH_KEY secret
```

Restrict the key in `~/.ssh/authorized_keys` (optional, recommended) so it can
only run the deploy script — see the `command=` option in `sshd(8)`.

### 2. First-time setup on the VPS

The workflow clones the repo on its first run, but you must seed `.env` once:

```bash
cd /opt/data
git clone https://github.com/japnam89/receipt-scanner.git receipt-scanner
cd receipt-scanner
cp .env.example .env
# edit .env: fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and set
#   OAUTH_REDIRECT_URI=https://japnam.tech/receipt/oauth2callback
#   BASE_PATH=/receipt
```

### 3. That's it

Push to `main`. CI runs the smoke test; on success the **Deploy to VPS** workflow
SSHes in, pulls, rebuilds, and verifies `/healthz`. Watch it under the repo's
**Actions** tab.

---

## Manual deploy

```bash
ssh root@<VPS_HOST>
cd /opt/data/receipt-scanner
git pull --ff-only origin main      # or: git fetch && git reset --hard origin/main
docker compose up -d --build
# wait for cold build / Tesseract download, then:
curl -fsS http://127.0.0.1:4000/healthz   # expect {"ok":true,...}
docker compose ps                        # receipt-scanner  Up (healthy)
```

---

## Verify

From anywhere:

```bash
curl -fsS https://japnam.tech/receipt/healthz
```

Expect `{"ok":true,...}`. If you instead get Next.js's 404 (header
`x-nextjs-prerender`), Traefik isn't routing to this container — i.e. it is not
running. See troubleshooting below.

---

## Troubleshooting

**`/receipt` returns the portfolio's 404**
The container isn't up. On the VPS: `docker compose ps` (expect `Up (healthy)`),
then `docker compose up -d --build`. Confirm `.env` exists — `env_file:` in
`docker-compose.yml` means a missing `.env` fails the start.

**Health probe never goes green**
`docker compose logs -f` — common causes: missing `.env`, OAuth scope error, or a
slow first-time Tesseract model download (just wait / retry).

**Stale `.next` confusion on the portfolio**
Unrelated to this container, but worth noting: a new route 404ing on the live
portfolio + navbar present in source = stale build → rebuild portfolio with
`--no-cache`.

---

## Rollback

The workflow does `git reset --hard origin/main`. To roll back to a previous
commit:

```bash
cd /opt/data/receipt-scanner
git log --oneline -5                 # pick a known-good SHA
git reset --hard <SHA>
docker compose up -d --build
curl -fsS http://127.0.0.1:4000/healthz
```
