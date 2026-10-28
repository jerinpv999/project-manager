# REST API

Base path `/api`. JSON in and out. All routes except `/auth/login`, `/config` and `/health` need `Authorization: Bearer <token>`. Errors are `{ "error": "message" }` with a 4xx/5xx status.

## Auth & config

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` (token valid 7 days) |
| GET | `/auth/me` | current user |
| GET | `/config` | `{ mode: "demo"\|"live", accounts: [] }` (accounts only in demo) |
| POST | `/demo/reset` | admin, demo mode only — wipe and reload demo data |
| GET | `/events?token=<jwt>` | Server-Sent Events stream |
| GET | `/health` | `{ ok: true }` |

## Users

| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/users` | any | all users |
| POST | `/users` | admin | `{ name, email, password, role }` |
| PUT | `/users/:id` | admin | `{ name?, email?, role?, password? }` |
| PATCH | `/users/:id/active` | admin | `{ active: boolean }` |
| DELETE | `/users/:id` | admin | delegates everything to the caller → `{ deleted, delegatedTo, summary }` |

Roles: built-in `admin`, `project_manager`, `developer`, `qa`, `ui_developer`, plus any custom role key created on the Roles page.

## Roles

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/roles` | any | roles with `permissions` and `users` count |
| GET | `/roles/permissions` | any | permission catalog `[{key, group, label}]` |
| POST | `/roles` | roles.manage | `{ name, key?, description?, color?, permissions[] }` |
| PUT | `/roles/:key` | roles.manage | Admin role is locked |
| DELETE | `/roles/:key?reassignTo=<key>` | roles.manage | custom roles only; `reassignTo` required when users have the role |

`/auth/login` and `/auth/me` return the user with a resolved `permissions` array. Each route needs a permission (e.g. `403 Missing permission: tasks.manage`).

## Workspaces & projects

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/workspaces` | any | visible workspaces with `stats {total, done}` |
| POST | `/workspaces` | manager | `{ name, key?, description?, members[] }`; creates `#general` |
| GET | `/workspaces/:id` | member | populated members |
| PUT | `/workspaces/:id` | manager | `{ name?, key?, description? }` |
| PUT | `/workspaces/:id/members` | manager | `{ members: [userId] }`; removed users leave all sub-projects |
| DELETE | `/workspaces/:id` | admin | cascades everything |
| GET | `/workspaces/:id/projects` | member | flat list of visible sub-projects/modules |
| POST | `/projects` | manager | `{ workspace, parent?, name, kind: "subproject"\|"module", members[] }` |
| GET / PUT / DELETE | `/projects/:id` | member / manager / manager | delete refuses while it has children |
| PUT | `/projects/:id/members` | manager | members must belong to the workspace |

## Scoped collections

`sprints`, `features`, `tasks`, `roadmap`, `docs`, `diagrams` share one shape:

| Method | Path | Notes |
|---|---|---|
| GET | `/<collection>?workspace=<id>&project=<id\|root>` | `project=root` or omitted → workspace level only |
| | `&all=1` | include every sub-project/module below (visible ones only) |
| | `&status=&assignee=&feature=&sprint=&priority=&type=` | tasks filters (`sprint=none` → backlog) |
| POST | `/<collection>` | body includes `workspace` and `project` (null for workspace level) |
| GET / PUT / DELETE | `/<collection>/:id` | |

Write permissions:

- sprints, features, tasks, roadmap: managers.
- docs, diagrams: any member; delete by the author or a manager.

### Story point matrix

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/settings/story-points` | any | organisation default `{ matrix, defaultMatrix, complexityLabels, sizeLabels }` |
| PUT | `/settings/story-points` | settings.manage | `{ matrix: number[5][5], recalculate: 'open'\|'all'\|'none' }`; recalculates matrix-mode tasks in workspaces without their own matrix |
| GET | `/workspaces/:id/story-points` | member | `{ matrix, source: 'workspace'\|'default', defaultMatrix, … }` |
| PUT | `/workspaces/:id/story-points` | structure.manage | `{ matrix \| null, recalculate }`; `null` = follow the organisation default |

`matrix[complexity-1][size-1]` = points. Task fields:

- `pointsMode`: `'matrix'` or `'manual'`.
- `complexity`, `size`: 1–5.
- `points`.

In matrix mode the server sets `points` from the task's workspace matrix and rejects a missing complexity or size. In manual mode `points` is taken as sent.

### Sprint analysis & CSV

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/sprints/velocity?workspace=&project=` | reports.view | `[{ name, status, capacity, committed, completed }]` |
| GET | `/sprints/:id/report` | reports.view | `totals`, `members[]`, `byStatus[]`, `burndown[]`, `tasks[]` |
| GET | `/sprints/:id/report/csv?type=members` | reports.export | one row per employee + TOTAL |
| GET | `/sprints/:id/report/csv?type=tasks` | reports.export | one row per task |
| GET | `/sprints/export/csv?workspace=&project=[&all=1]` | reports.export | every sprint × employee |

Sprints accept `capacity` and `memberCapacity: [{ user, points }]`; when per-member points are given, `capacity` is their sum. Tasks accept `points` (0–100, `null` = not estimated).

Tasks CSV columns: Sprint, Task, Sub-project/module, Business feature, Type, Priority, Assignee, Status, Points mode, Complexity, Size, Story points, Completed on.

Employee CSV columns: Sprint, Sprint status, Start, End, Employee, Email, Role, Capacity (pts), Allocated (pts), Completed (pts), Remaining (pts), Completion %, Load % of capacity, Tasks, Tasks done. Files are UTF-8 with BOM so Excel opens them correctly.

### Task extras

| Method | Path | Notes |
|---|---|---|
| GET | `/tasks/mine?status=` | my tasks with workspace/project/feature/sprint populated |
| PATCH | `/tasks/:id/status` | `{ status }` — assignee, QA or manager |
| POST | `/tasks/:id/comments` | `{ text }` |

Statuses: `todo`, `in_progress`, `in_review`, `qa`, `done`, `blocked`. Priorities: `low`, `medium`, `high`, `critical`. Types: `task`, `story`, `bug`, `ui`, `test`.

Sprint body example:

```json
{
  "workspace": "…", "project": null, "name": "Sprint 1",
  "startDate": "2026-11-01", "endDate": "2026-11-15",
  "recurrence": { "enabled": true, "lengthDays": 14, "carryOver": true }
}
```

## Chat

| Method | Path | Notes |
|---|---|---|
| GET | `/chat/channel?workspace=&project=` | default channel for the level (created on demand) |
| GET | `/chat/:channelId/messages?limit=50&before=<iso>` | oldest first |
| POST | `/chat/:channelId/messages` | `{ text }` → broadcast as `chat.message` |

## Dashboard

`GET /dashboard?workspace=<id>&project=<id>` returns:

`totals`, `byStatus`, `byPriority`, `byType`, `byAssignee`, `byFeature`, `byProject`, `featureStatus`, `throughput` (14 days), `burndown` (`{ sprint, total, points[{day, ideal, remaining}] }` or `null`).

## SSE events

| Event | Payload | Sent to |
|---|---|---|
| `ready` | `{ user }` | the connecting user |
| `chat.message` | `{ channelId, message }` | users who can see the channel's level |
| `task.assigned` | `{ task: {_id, title}, by }` | new assignee |
| `task.updated` | `{ taskId, workspace, project }` | users who can see the level |
| `scope.changed` | `{ kind }` | users who can see the level (sprint, feature, roadmap) |

## curl example

```bash
TOKEN=$(curl -s localhost:8091/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"priya@demo.local","password":"demo123"}' | jq -r .token)
curl -s localhost:8091/api/tasks/mine -H "authorization: Bearer $TOKEN" | jq '.[].title'
```
