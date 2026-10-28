# Orbit PM user guide

## Concepts

| Term | Meaning |
|---|---|
| **Workspace** | The root project, e.g. "Acme Commerce Platform". Has members, a chat channel, sprints, features, tasks, roadmap, docs and diagrams. |
| **Sub-project** | A part of a workspace with its own team (e.g. "Payments Gateway"). Can contain modules and further sub-projects. |
| **Module** | A smaller unit inside a sub-project (e.g. "Checkout"). Works exactly like a sub-project. |
| **Level** | Any of the above. Every level has the same tabs. |
| **Business feature** | A piece of customer value. Tasks are always created against a feature. |
| **Sprint** | A time box at any level. Can be one-off or recurring. |
| **Milestone** | A bar on the roadmap. |

## Roles

Roles are fully configurable: an admin (or anyone with *Manage roles*) can change what the built-in roles may do and create new ones on the **Roles** page. The built-in defaults are:

| Role | What they do |
|---|---|
| **Admin** | Everything, plus user management. Deleting a user hands their work to the admin. |
| **Project Manager** | Creates workspaces, sub-projects, sprints, features, tasks and milestones; manages members; sees every sub-project of their workspaces. |
| **Developer** | Works on assigned tasks and moves them between statuses. Writes docs, diagrams, comments and chat. |
| **UI Developer** | Same permissions as Developer; usually gets `ui` tasks. |
| **QA** | Same as Developer, and can change the status of **any** task they can see, e.g. QA → Done. |

### Creating your own roles

1. Sidebar → **Roles** → **+ New role**.
2. Enter a name (e.g. *Tech Lead*, *Scrum Master*, *Business Analyst*, *Stakeholder*) and pick a colour.
3. Optionally *Start from* a template, then tick permissions:

| Group | Permission | Lets the role… |
|---|---|---|
| Administration | users.manage | create, edit, deactivate and delete users |
| | roles.manage | manage roles and permissions |
| Workspaces | workspace.create / workspace.delete | create or delete workspaces |
| | structure.manage | manage members, sub-projects and modules |
| | projects.view_all | see every sub-project in their workspaces without being assigned |
| Planning | planning.manage | create and edit sprints, business features and the roadmap |
| Tasks | tasks.manage | create, edit, assign and delete tasks |
| | tasks.status.any / tasks.status.own | change the status of any task, or only their own |
| Content | docs.write / docs.delete.any | write docs and diagrams, delete anyone's |
| | chat.write | post in chat |
| Reports | reports.view / reports.export | open sprint analysis, export CSV |

4. Assign the role to people on the **Users** page.

Deleting a custom role asks where its users should move. Built-in roles can be edited but not deleted. The Admin role always has every permission.

### Who sees what

- Admins see everything.
- Workspace members see workspace-level content.
- A sub-project or module is visible to:
  - project managers in that workspace,
  - people assigned to it,
  - people assigned to any of its parents.
- Chat messages and live updates follow the same rules.

## Navigating

- **Sidebar**: Overview, My tasks, Users (admin), your workspaces, *Take the tour*, and *Reset demo data* in demo mode.
- **Workspace page**: the tree on the left switches level; tabs across the top switch view.

## Everyday tasks

### Project managers

1. **Create a workspace**: Overview → **+ New workspace** → name, short key (e.g. `CRM`), members.
2. **Add structure**: Team & structure → **+ Add** → name, *Sub-project* or *Module*, assigned members. Only workspace members can be assigned.
3. **Plan a sprint**: Sprints → **+ New sprint**. Under *Story-point capacity*, either enter a total or the points each person can take on; the total is then their sum. For a regular cadence, tick *Recurring sprint* and set the length in days. When the sprint ends, the next one is created automatically. With *Carry unfinished tasks over*, open tasks move into it.
4. **Define features**: Features → **+ New feature** → title, acceptance criteria, priority, status, owner.
5. **Create tasks**:
   - Tasks → **+ New task**, or expand a feature → **+ Task**.
   - Choose the feature, assignee, sprint, type, priority, **story points**, estimate (hours) and due date.
   - The assignee gets a live notification.
6. **Roadmap**: Roadmap → **+ Milestone** → dates, status (*Planned*, *In progress*, *Done*, *At risk*), optional linked feature. Click a bar to edit it.
7. **Follow progress**: Dashboard at any level.
8. **Analyse a sprint**: Sprints → **Analyse** on a sprint card:
   - capacity, committed and completed points, with an over-allocation warning,
   - points per employee (capacity vs allocated vs completed),
   - story-point burndown and points by status,
   - employee and task tables,
   - **Employees CSV** and **Tasks CSV** downloads.

   **Export all sprints CSV** on the Sprints tab gives every sprint × employee in one file.

### Developers and UI developers

1. Open **My tasks** for everything assigned to you, across workspaces.
2. Change status with the dropdown, or drag your cards on the board. Statuses are To do → In progress → In review → QA → Done, plus Blocked.
3. Click a card for the description and comments.
4. Ask questions in the **Chat** tab of the level you are working on.

### QA

1. Watch the **QA** column on boards; filter by sprint.
2. Drag verified tasks to **Done**, or back to **In progress** with a comment explaining why.
3. Log bugs by asking the project manager, or use a `bug`-type task if you are a manager.

### Admins

- **Users**: create, edit (name, email, role, password reset), deactivate/activate, delete.
- **Deactivate** blocks sign-in immediately but keeps everything assigned to the person.
- **Delete** removes the account and moves the following to you:
  - their tasks (as assignee and reporter),
  - features they own,
  - workspace and sub-project memberships,
  - docs and diagrams,
  - sprints and milestones they created,
  - comments and chat messages, which keep the label *"Name (deleted)"*.

## Story points

Every task can be estimated in one of two ways, chosen with the **Matrix / Manual** switch in the task form.

**Matrix (default).** Pick **Complexity** (1–5) and **Size** (1–5), or click a cell in the matrix. Points are looked up from the story points calculation matrix. The default matrix is:

| Complexity \ Size | 1 (XS) | 2 (S) | 3 (M) | 4 (L) | 5 (XL) |
|---|---|---|---|---|---|
| **5** Very high | 5 | 8 | 13 | 21 | 21 |
| **4** High | 3 | 5 | 8 | 13 | 21 |
| **3** Medium | 3 | 3 | 5 | 8 | 13 |
| **2** Low | 2 | 2 | 3 | 5 | 8 |
| **1** Very low | 1 | 2 | 3 | 5 | 8 |

The server does the lookup, so everyone gets the same number. When the matrix changes, matrix-mode tasks can be recalculated.

**Manual.** Type any value (0–100, halves allowed) or click a quick-pick chip (0, 1, 2, 3, 5, 8, 13, 21). Leave it empty for *not estimated*. Complexity and size stay on the task for reference, but the manual value is the one used, and recalculation never touches it.

### Editing the matrix

| Matrix | Where | Who | Applies to |
|---|---|---|---|
| Organisation default | Sidebar → **Settings** | `settings.manage` (Admin) | Every workspace without its own matrix |
| Workspace matrix | Workspace → **Team & structure** → *Story point matrix* | `structure.manage` (Project Manager) | That workspace and all its sub-projects/modules |

In a workspace, choose **Use organisation default** or **Custom for this workspace**, then edit the cells. When saving, choose what happens to existing matrix-mode tasks:

- recalculate **open tasks only**, so completed sprints keep their history,
- recalculate **all tasks**,
- or **don't change** existing tasks.

## The tabs

| Tab | What it's for |
|---|---|
| **Dashboard** | KPIs plus charts: tasks by status, sprint burndown, workload by person, priority, feature progress, 14-day throughput, progress by sub-project or module. Includes everything below the current level that you can see. |
| **Tasks** | Kanban board. Filters for feature, sprint (or *Backlog*) and person. *Include sub-projects / modules* shows the whole subtree. |
| **Features** | Business features with progress bars; expand to see and add tasks. |
| **Sprints** | Velocity chart (points per sprint) and sprint cards with dates, recurrence, capacity, committed/completed points and **Analyse**. |
| **Roadmap** | Timeline by month with a *today* line. |
| **Docs** | Markdown documents with *Edit*, *Split* and *Preview*. New docs start from a project template. |
| **Diagrams** | Mermaid editor with live preview and SVG export. Sequence diagrams have a point-and-click builder. |
| **Chat** | The level's *#general* channel for common questions; live. |
| **Team & structure** | Members, sub-projects/modules, edit/delete settings. |

## Writing diagrams

The builder covers most needs. To write by hand:

```
sequenceDiagram
    actor U as User
    participant A as API
    U->>A: request          (sync call)
    A-->>U: response        (reply)
    A-)Q: event             (async)
    Note over A: comment
    alt success
        A-->>U: 200
    else failure
        A-->>U: 500
    end
```

Flowcharts use `flowchart LR` with `A --> B`; class diagrams use `classDiagram`.

## Tour guide

- Starts automatically the first time each person signs in.
- Restart it from the sidebar with **✦ Take the tour**.
- Steps adapt to your role.
- Keys: → / Enter next, ← back, Esc close.

## FAQ

**I can't see a sub-project my colleague can.** You are not assigned to it or its parent. Ask a project manager.

**I can't drag a card.** Developers can only move their own tasks; QA and managers can move any.

**The chat says "reconnecting".** The live connection dropped; it reconnects automatically. Messages you send still go through.

**A recurring sprint didn't roll over.** The scheduler checks every minute while the backend is running. After downtime it catches up on the next check.
