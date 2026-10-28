# Running Orbit PM: demo mode and live mode

Orbit PM ships with two ready-made setups. They use separate Docker projects, ports and databases, so you can run both on the same machine at once.

| | Demo mode | Live mode |
|---|---|---|
| Compose file | `docker-compose.demo.yml` | `docker-compose.yml` |
| URL | http://localhost:8091 | http://localhost:8090 |
| Docker project | `orbit-demo` | `orbit-live` |
| Database | `pmapp_demo` in volume `orbit-demo_demo-mongo-data` | `pmapp` in volume `orbit-live_mongo-data` |
| Data on first start | Full sample company (see [DEMO_SCENARIOS.md](DEMO_SCENARIOS.md)) | Empty — only your admin account |
| Login screen | One-click demo accounts | Plain email + password |
| Secrets | Fixed demo values | **Required** in `.env`; the app refuses to start without them |
| Reset | Admin → sidebar → **Reset demo data** | Not available |
| Guided tour | Auto-starts on first login | Auto-starts on first login |
| Badge in sidebar | `DEMO` (amber) | `LIVE` (green) |

Port 8080 is intentionally left free.

---

## Demo mode

```bash
docker compose -f docker-compose.demo.yml up -d --build
```

Open http://localhost:8091 and click any account on the right of the login screen. All demo passwords are `demo123`; the admin is `admin@example.com` / `admin123`.

Reset the sample data at any time:

- In the app: sign in as admin → sidebar → **Reset demo data**, or
- From a terminal: `docker compose -f docker-compose.demo.yml exec backend node src/seed-demo.js --reset`

Stop and throw everything away:

```bash
docker compose -f docker-compose.demo.yml down -v
```

> Demo mode uses a fixed JWT secret and published passwords. Never expose it to the internet with real data.

---

## Live mode

1. Create your settings file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env`:

   ```
   JWT_SECRET=<output of: openssl rand -hex 32>
   ADMIN_EMAIL=you@yourcompany.com
   ADMIN_PASSWORD=<a strong password>
   APP_PORT=8090
   ```

3. Start it:

   ```bash
   docker compose up -d --build
   ```

4. Open http://localhost:8090, sign in as the admin and follow the tour. Then:
   1. **Users** → create your team and set each person's role.
   2. **Overview** → **+ New workspace**, add members.
   3. In the workspace → **Team & structure** → add sub-projects and modules and assign people.
   4. **Features** → add business features, then **Tasks** → create tasks against them.

`ADMIN_PASSWORD` is only used to create the first admin when none exists. Change it later on the Users page; editing `.env` will not change an existing admin.

### Safety checks in live mode

- Startup fails if `JWT_SECRET` is missing or shorter than 16 characters.
- Startup fails if there is no admin yet and `ADMIN_PASSWORD` is not set.
- `/api/config` returns no accounts and `/api/demo/reset` returns 404.

### Backups

```bash
# backup
docker compose exec mongo mongodump --db pmapp --archive > orbit-$(date +%F).archive
# restore
docker compose exec -T mongo mongorestore --archive --drop < orbit-2026-10-25.archive
```

### Updating

```bash
git pull            # or unzip the new version over the old folder, keeping .env
docker compose up -d --build
```

Data lives in the named volume and survives rebuilds. `docker compose down -v` deletes it.

### Putting it behind HTTPS

Point your reverse proxy (Caddy, Traefik, nginx) at `localhost:8090`. If the proxy is nginx, disable buffering for `/api/events` so live chat works:

```nginx
location /api/events {
  proxy_pass http://127.0.0.1:8090;
  proxy_http_version 1.1;
  proxy_set_header Connection '';
  proxy_buffering off;
  proxy_read_timeout 24h;
}
```

---

## Environment variables (backend)

| Variable | Demo | Live | Meaning |
|---|---|---|---|
| `APP_MODE` | `demo` | `live` | Switches demo behaviour on/off |
| `MONGO_URL` | set by compose | set by compose | MongoDB connection string |
| `JWT_SECRET` | fixed | **required** | Signs login tokens (7-day expiry) |
| `ADMIN_EMAIL` | `admin@example.com` | your email | First admin account |
| `ADMIN_PASSWORD` | `admin123` | **required on first start** | First admin password |
| `PORT` | 4000 | 4000 | API port inside the container |

Compose-level: `APP_PORT` (live, default 8090), `DEMO_PORT` (demo, default 8091).

## Running without Docker (development)

```bash
# needs MongoDB on localhost:27017
cd backend && npm install
APP_MODE=demo npm run dev            # or: APP_MODE=live JWT_SECRET=... ADMIN_PASSWORD=... npm run dev
cd ../frontend && npm install && npm run dev   # http://localhost:5173, proxies /api to :4000
```

`npm run seed:demo` and `npm run seed:demo:reset` load the sample data into whatever database `MONGO_URL` points at.
