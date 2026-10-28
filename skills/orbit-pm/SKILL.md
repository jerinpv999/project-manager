---
name: orbit-pm
description: Run, extend or debug Orbit PM, the Node/Express + MongoDB + React project-management app with workspaces, sub-projects, sprints with story points and CSV sprint analysis, custom roles/permissions, features, tasks, roadmap, docs, diagrams, SSE chat, demo/live modes and a guided tour.
---

# Orbit PM

Use this skill when working in the Orbit PM repository: adding a feature, a tab, a field, demo data or a tour step; fixing a bug; or running the app in demo or live mode.

Read `docs/ARCHITECTURE.md` first if you have not seen the codebase. It has the source map, data model and access rules.

## Running

| Goal | Command | URL |
|---|---|---|
| Demo (sample data) | `docker compose -f docker-compose.demo.yml up -d --build` | http://localhost:8091 |
| Live (clean) | `cp .env.example .env` (set `JWT_SECRET`, `ADMIN_PASSWORD`), then `docker compose up -d --build` | http://localhost:8090 |
| Reload demo data | `docker compose -f docker-compose.demo.yml exec backend node src/seed-demo.js --reset` | |
| Dev without Docker | `cd backend && APP_MODE=demo npm run dev` + `cd frontend && npm run dev` | http://localhost:5173 |

Port 8080 is reserved for another app on the user's machine. Never default anything to 8080.

Demo accounts: `<name>@demo.local` / `demo123` (priya PM, arjun dev, sara dev, rahul UI dev, meera QA, anil Tech Lead [custom], divya Stakeholder [custom], vikram deactivated); admin `admin@example.com` / `admin123`.

## Core rules of the codebase

1. **Scope.** Every planning record has `workspace` and `project` (`null` = workspace level). Sub-projects and modules are both `Project` documents (`kind`, `parent`).
2. **Access.** Always go through `assertScope(user, workspace, project)` in `backend/src/access.js` before reading or writing scoped data. Never query a scoped collection by id without it.
3. **Permissions, not role names.** Never compare `user.role` to a string (except the locked `admin` key). Check permissions with `requirePerm('x')` / `can(user, 'x')` on the backend and `can(user, 'x')` / `scope.can('x')` on the frontend. The catalog is in `backend/src/permissions.js`. Adding a permission means adding it there, giving it to the right built-in roles, and documenting it in `docs/USER_GUIDE.md`. Existing databases keep their role edits, so tell the user to tick the new permission on the Roles page.
4. **Realtime.** After a write that others should see, call `publishToScope(workspace, project, event, data)` or `publishToUsers([ids], event, data)` from `events.js`. The frontend listens with `useLiveEvent(event, handler)` from `src/auth.jsx`.
5. **User deletion.** Goes through `services/users.js#delegateAndDelete`. If you add a new collection with a user reference, add it there too, or deleted users will leave dangling references.
6. **Modes.** Demo-only behaviour checks `IS_DEMO` in `backend/src/index.js`; the frontend uses `useConfig().mode`. Live mode must never expose demo accounts or the reset endpoint.
7. **Express 5.** Async handlers may throw; errors become `{ error }` JSON. Use `httpError(status, message)` from `auth.js`.

## Recipes

### Add a new scoped collection (e.g. "Risks")

1. `backend/src/models.js`: add a schema spreading `...scope`, export the model.
2. `backend/src/index.js`: mount it, e.g. `app.use('/api/risks', scoped(M.Risk, { perm: 'planning.manage', authorField: 'createdBy', populate: [...], ...live('risk') }))`. `perm` is the permission needed to write; pass `write: 'member'` to use `docs.write` instead.
3. Add the model to the cascade lists `SCOPED` in `routes/workspaces.js` and `routes/projects.js`.
4. Add user fields to `services/users.js` and to `resetDatabase` in `demo.js`.
5. Frontend: create `src/tabs/Risks.jsx`, following `Roadmap.jsx`. Use `scopeQs(scope)` to list and `scopeBody(scope, body)` to create.
6. Register it in the `TABS` array in `src/pages/ScopeView.jsx`.
7. Add demo rows in `backend/src/demo.js`, a tour step in `components/Tour.jsx` (`target: 'tab-risks'`), and a scenario in `docs/DEMO_SCENARIOS.md`.
8. Document the endpoints in `docs/API.md`.

### Add a field to tasks

1. Add it to `TaskSchema` in `models.js`.
2. Add any validation in `validateRefs` in `routes/tasks.js`.
3. Add it to the `body` built in `TaskForm`, in `src/tabs/Tasks.jsx`, plus an input.
4. Show it on the card or in the detail view if useful, and add values in the demo `T` table.

### Add a dashboard chart

1. Add an aggregation to the `Promise.all` in `routes/dashboard.js`, reusing `match` so visibility rules apply.
2. Add a `ChartCard` in `src/tabs/Dashboard.jsx` using the fixed categorical palette `C`. Color follows the entity, never its rank; no dual axes.

### Add a custom role or permission

- Custom roles need no code: Roles page, or `POST /api/roles`.
- A new permission needs code:
  1. Add `{ key, group, label }` to `PERMISSIONS` in `permissions.js` and to the right `SYSTEM_ROLES`.
  2. Guard routes with `requirePerm`.
  3. Hide UI with `can()`.
  4. Add a demo role in `DEMO_ROLES` if useful.

### Story point matrix

- `backend/src/storyPoints.js`:
  - `DEFAULT_MATRIX`, rows indexed `complexity-1`;
  - `matrixForWorkspace(id)`, which returns the workspace's `pointMatrix` or the organisation default from the `settings` collection;
  - `pointsFor(c, s, workspaceId)`;
  - `recalculate({ filter, matrixFor, openOnly })`.
- Task `pointsMode`:
  - `'matrix'`: the server computes `points` in `validateRefs`. Never trust client points in this mode.
  - `'manual'`: points are kept as entered, and recalculation skips them.
- The frontend gets the effective matrix as `scope.matrix`. Use `matrixPoints(c, s, scope.matrix)` for previews and `components/PointsMatrix.jsx` / `MatrixEditor.jsx` for display and editing.

### Extend sprint analysis

`routes/sprintReports.js#buildReport` produces everything (totals, members, byStatus, burndown, tasks). Add a field there, then:
- show it in `components/SprintReport.jsx`,
- add a column to `MEMBER_HEADER` / `memberRows` so the CSV matches.

Keep CSV output through `toCsv` (escaping + BOM).

### Add a tour step

Put `data-tour="<id>"` on the element, then add `{ path, target: '<id>', title, body }` to `buildSteps` in `components/Tour.jsx`. Gate it by role with `mgr && {...}` or `user.role === 'qa' && {...}`. Steps without `target` render as a centred card.

### Add demo data

Edit `backend/src/demo.js`:

- Keep dates relative (`at(days)`).
- Back-date with `rawSet` (it bypasses hooks and timestamps).
- Only assign users who can access that scope, or the scenario docs will be wrong.
- Update the counts and visibility table in `docs/DEMO_SCENARIOS.md`.

## Verification checklist

Before handing work back:

- [ ] `cd backend && node -e "require('./src/index.js')"` loads without errors.
- [ ] `cd frontend && npx vite build` succeeds.
- [ ] Demo stack starts and `/api/config` returns `mode: "demo"`; live stack refuses to start without `.env`.
- [ ] The scenario you touched in `docs/DEMO_SCENARIOS.md` still works for every relevant role: sign in as PM, a developer and QA.
- [ ] A user without the permission gets 403 from the new endpoints, and the UI hides the action (`can()`).
- [ ] Docs updated: `API.md` for endpoints, `USER_GUIDE.md` for UI, `DEMO_SCENARIOS.md` for new scenarios.

## Gotchas

- `EventSource` cannot send headers, so the SSE token is passed in the query string. nginx must not buffer `/api/events`.
- The Task `pre('save')` hook sets `completedAt` whenever `status` changes. Back-dated demo data must set it with `rawSet` after creation.
- `GET /<collection>` without `all=1` returns only the exact level. Dashboards always include descendants.
- Mermaid renders asynchronously; failed renders leave `#dmmd-*` nodes, which `Diagrams.jsx` cleans up.
- Assignees are validated server-side against the task's scope. The client list in `ScopeView.members` mirrors that rule; keep the two in sync.
