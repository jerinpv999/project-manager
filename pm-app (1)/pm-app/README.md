# Orbit PM — project management app

Node.js (Express 5 + Mongoose) · MongoDB 7 · React 18 (Vite) · realtime over Server-Sent Events · Docker Compose.

## Two ways to run it

| | Demo mode | Live mode |
|---|---|---|
| For | Trying it out, showing it to people | Real use |
| Start | `docker compose -f docker-compose.demo.yml up -d --build` | `cp .env.example .env` → fill in → `docker compose up -d --build` |
| URL | http://localhost:8091 | http://localhost:8090 |
| Data | Sample company preloaded, one-click role logins, **Reset demo data** button | Empty; only your admin |

Both can run at the same time: they have separate ports, Docker projects and databases. Port 8080 is left free.

**Demo logins:** click an account on the login screen, or use `priya@demo.local` (PM), `arjun@demo.local` (developer), `rahul@demo.local` (UI developer), `meera@demo.local` (QA) with password `demo123`. The admin is `admin@example.com` / `admin123`.

A guided tour starts on each user's first sign-in; restart it from the sidebar with **✦ Take the tour**.

## Documentation

| Doc | What's in it |
|---|---|
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Concepts, roles, every tab, step-by-step for PMs, developers, QA and admins |
| [docs/DEMO_SCENARIOS.md](docs/DEMO_SCENARIOS.md) | The sample company and 40+ scenarios to click through (demo), plus a live-mode rollout checklist |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Demo vs live setup, environment variables, backups, HTTPS, updates |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Containers, data model, access rules, realtime, scheduler, source map |
| [docs/API.md](docs/API.md) | REST endpoints and SSE events |
| [skills/orbit-pm/SKILL.md](skills/orbit-pm/SKILL.md) | Skill file for AI assistants working on this codebase: recipes, rules, checklist |

## Services

| Service | What it does |
|---|---|
| `mongo` | MongoDB 7, data in a named volume (separate per mode) |
| `backend` | REST API + SSE stream + sprint scheduler on port 4000 (internal) |
| `frontend` | nginx serving the React build, proxying `/api` (SSE unbuffered) to the backend |

## Feature map

| # | Requirement | Where |
|---|---|---|
| 1 | Users: create, edit, deactivate, delete. On delete, tasks, features, memberships, docs, diagrams and chat messages are delegated to the admin performing the delete (messages keep the original author's name) | **Users** page · `routes/users.js` |
| 2 | Workspace = root project containing nested sub-projects and modules (any depth) | Sidebar → workspace, left tree · `Workspace` / `Project` models |
| 3 | Assign users to a workspace; assign only workspace members to sub-projects/modules | **Team & structure** tab |
| 4 | Manual or recurring sprints at workspace, sub-project or module level. Recurring sprints roll over automatically when they end and can carry unfinished tasks over | **Sprints** tab · `scheduler.js` |
| 5 | Business features at any level | **Features** tab |
| 6 | Tasks created against a business feature, at any level | **Tasks** board, or "+ Task" on a feature |
| 7 | Roadmap per workspace / sub-project / module (timeline with today marker) | **Roadmap** tab |
| 8 | Detailed project documents (Markdown with edit / split / preview, starter template) | **Docs** tab |
| 9 | Default "general" chat per workspace and per sub-project, live via SSE | **Chat** tab |
| 10 | High-level design & sequence diagrams (Mermaid) with a point-and-click sequence builder, live preview, SVG export | **Diagrams** tab |
| 11 | Roles: Admin, Project Manager, Developer, QA, UI Developer — plus any custom role with chosen permissions | **Roles** page, Users page |
| 12 | Developers see their assigned tasks and update status; realtime toast when something is assigned | **My tasks** page, Kanban drag-and-drop |
| 13 | Dashboard with charts: status, burndown, workload by person, priority, feature progress, throughput, sub-project progress | **Dashboard** tab at every level |

## Roles & permissions

Roles are managed on the **Roles** page. Built-in roles (Admin, Project Manager, Developer, UI Developer, QA) can be adjusted, and you can create your own, such as Tech Lead, Scrum Master or Stakeholder. Each role is a set of 15 permissions, from `users.manage` to `reports.export`. Admin always has everything. See [docs/USER_GUIDE.md](docs/USER_GUIDE.md#creating-your-own-roles).

| Default | Admin | Project Manager | Developer / UI Dev | QA |
|---|---|---|---|---|
| Manage users & roles | ✓ | | | |
| Create workspaces, manage structure | ✓ | ✓ | | |
| Sprints, features, roadmap | ✓ | ✓ | | |
| Create / assign tasks | ✓ | ✓ | | |
| Change task status | ✓ | any | own | any |
| Docs, diagrams, chat | ✓ | ✓ | ✓ | ✓ |
| Sprint analysis / CSV export | ✓ / ✓ | ✓ / ✓ | ✓ / | ✓ / |

Visibility: admins see everything. Workspace members see workspace-level content. Sub-project/module content is visible to roles with `projects.view_all` and to users assigned to that sub-project or one of its parents.

## Story points & sprint analysis

- Story points come from a **complexity × size matrix**, or are entered **manually** per task. The organisation default is editable in Settings; each workspace can have its own matrix (Team & structure).
- Sprints have a point capacity, as a total or split per person.
- **Sprints** tab: a velocity chart (capacity vs committed vs completed per sprint).
- **Analyse** on a sprint shows:
  - points per employee,
  - story-point burndown and points by status,
  - over-allocation warnings,
  - employee and task tables.
- CSV exports:
  - **Employees CSV** and **Tasks CSV** per sprint,
  - **Export all sprints CSV** (every sprint × employee) for a workspace or sub-project.

## Realtime

`backend/src/events.js` is a small internal pub/sub bus with topic-style addressing (`user/<id>`). Each browser holds one `EventSource` on `/api/events`. Chat messages and board updates are fanned out only to users who can see that scope, resolved at publish time so membership changes apply immediately.

Events: `chat.message`, `task.assigned`, `task.updated`, `scope.changed`.

To run several backend replicas, swap the `EventEmitter` in `events.js` for Redis pub/sub or an MQTT broker (Mosquitto/Aedes); the `publish*` functions are the only things that change.

## API overview

All routes are under `/api` and need `Authorization: Bearer <token>` except login.

```
POST   /auth/login                 GET /auth/me
GET    /events?token=…             (SSE stream)
GET|POST /users                    PUT|DELETE /users/:id     PATCH /users/:id/active
GET|POST /workspaces               GET|PUT|DELETE /workspaces/:id
PUT    /workspaces/:id/members     GET /workspaces/:id/projects
POST   /projects                   GET|PUT|DELETE /projects/:id    PUT /projects/:id/members
GET|POST /{sprints|features|tasks|roadmap|docs|diagrams}?workspace=&project=<id|root>[&all=1]
GET|PUT|DELETE /{…}/:id
GET    /tasks/mine                 PATCH /tasks/:id/status    POST /tasks/:id/comments
GET    /chat/channel?workspace=&project=
GET|POST /chat/:channelId/messages
GET    /dashboard?workspace=&project=
```

## Project layout

```
backend/src
  index.js        app wiring, admin seed
  models.js       Mongoose schemas
  auth.js         JWT + role guards
  access.js       workspace / project visibility rules
  events.js       pub/sub bus → SSE
  scheduler.js    sprint activation & recurring rollover
  routes/         auth, users, workspaces, projects, tasks, chat, dashboard, scoped (generic CRUD)
frontend/src
  pages/          Login, Home, Users, MyTasks, ScopeView
  tabs/           Dashboard, Tasks, Features, Sprints, Roadmap, Docs, Diagrams, Chat, Structure
```
