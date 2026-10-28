# Demo scenarios

Run demo mode (`docker compose -f docker-compose.demo.yml up -d --build`, then http://localhost:8091). Every scenario below works against the preloaded data. Click an account on the login screen to sign in as that person; passwords are `demo123` (admin: `admin123`).

To start over at any point: sign in as admin → sidebar → **Reset demo data**.

## The sample company

**Acme Commerce Platform** (`ACP`), owned by Priya:

```
Acme Commerce Platform            workspace · Platform Sprint 1 (done, recurring) → Platform Sprint 2 (active)
├─ Storefront                     sub-project · Arjun, Rahul, Meera · Storefront Sprint 3 (active)
│  ├─ Checkout                    module · Arjun, Meera · Checkout Sprint 1 (active)
│  └─ Product Search              module · Sara
└─ Payments Gateway               sub-project · Sara, Meera · Payments Sprint 1 (active), Sprint 2 (planned)
```

**Internal Tools** (`INT`): members Priya and Sara only, with one sub-project, *Admin Console*.

| Person | Login | Role | Can see |
|---|---|---|---|
| Administrator | admin@example.com | Admin | Everything |
| Priya Nair | priya@demo.local | Project Manager | Both workspaces, all sub-projects |
| Arjun Menon | arjun@demo.local | Developer | Acme: workspace level, Storefront and its modules (Checkout, Search) |
| Sara Thomas | sara@demo.local | Developer | Acme: workspace, Product Search, Payments · Internal Tools |
| Rahul Das | rahul@demo.local | UI Developer | Acme: workspace level, Storefront and its modules — **not Payments**, not Internal Tools |
| Meera Iyer | meera@demo.local | QA | Acme: workspace, Storefront and its modules, Payments |
| Anil Kumar | anil@demo.local | **Tech Lead** (custom role) | All Acme sub-projects; manages tasks, exports reports; cannot plan sprints |
| Divya Shah | divya@demo.local | **Stakeholder** (custom role) | Read-only: dashboards, sprint analysis, chat |
| Vikram Rao | vikram@demo.local | Developer | **Deactivated** — cannot sign in |
| Kiran Joseph | — | Developer | **Deleted** — his work now belongs to the admin |

Being assigned to a sub-project also gives access to its modules. Sara is assigned to Search directly, so she can open Search without seeing the rest of Storefront (Search then appears at the top of her tree).

Data includes 10 business features, 35 tasks in every status (story points on all but three) (some overdue, one blocked, critical bugs), task comments, 11 roadmap milestones (one *at risk*), 4 documents, 3 diagrams and chat history in four channels.

---

## A. Users & roles (requirement 1, 11)

**A1. Create a user** — admin → Users → **+ New user** → name, email, password, role *QA* → Save. The user appears in the table and can sign in.

**A2. Edit a user** — Users → Edit on *Rahul Das* → change role to *Developer* → Save.

**A3. Deactivated user cannot sign in** — sign out, type `vikram@demo.local` / `demo123`. Expected: *Account is deactivated*. As admin → Users → **Activate** Vikram → he can now sign in.

**A4. Delete with delegation (already happened)** — Kiran Joseph was deleted during the seed. Check:
- Acme → Tasks: *Global logout across services* is assigned to **Administrator**.
- Acme → Docs: *Release process* is authored by Administrator.
- Acme → Chat: Kiran's old messages show **Kiran Joseph (deleted)**.
- Acme → Team & structure: Administrator is now a member of Acme and Storefront.

**A5. Delete with delegation (do it yourself)** — admin → Users → Delete *Meera Iyer* → confirm. The toast reports how many records moved. Check that her QA tasks now belong to the admin, and her chat messages are labelled *(deleted)*.

**A6. Admin cannot delete or deactivate themselves** — the buttons are hidden on your own row; the API also refuses.

## B. Workspaces & structure (requirements 2, 3)

**B1. Workspace tree** — Priya → Acme. The left tree shows Storefront → Checkout / Product Search and Payments Gateway. Squares are sub-projects, circles are modules.

**B2. Create a sub-project** — Priya → Acme → Team & structure → **+ Add** → *Mobile App*, type *Sub-project*, assign Arjun and Rahul. It appears in the tree.

**B3. Nested module** — open *Mobile App* → Team & structure → **+ Add** → *Push notifications*, type *Module*.

**B4. Only workspace members can be assigned** — the member picker for a sub-project lists only Acme members. Through the API, assigning a non-member returns *400 Only workspace members can be assigned*.

**B5. Visibility** — sign in as **Rahul**: the tree shows Storefront (with Checkout and Search) but not Payments Gateway. Opening a Payments URL directly gives *Not assigned to this project*. He does not see the Internal Tools workspace at all.

**B6. Remove from workspace cascades** — Priya → Acme → Team & structure → Manage → untick Rahul → Save. Rahul is also removed from Storefront.

## C. Sprints (requirement 4)

**C1. Recurring sprint already rolled over** — Acme → Sprints: *Platform Sprint 1* is completed and shows ↻ *Every 14 days*. *Platform Sprint 2* is active and was created from it.

**C2. Create a recurring sprint** — Priya → Payments Gateway → Sprints → **+ New sprint** → tick *Recurring sprint*, length 7, *Carry unfinished tasks over*. When it ends, the next sprint starts automatically (the scheduler runs every minute) and unfinished tasks move into it.

**C3. Manual sprint at module level** — Checkout → Sprints already has *Checkout Sprint 1*. Create *Checkout Sprint 2* with fixed dates.

## D. Business features & tasks (requirements 5, 6)

**D1. Features at every level** — Acme has *Single sign-on* and *Platform observability*; Storefront has *Product listing redesign* and *Wishlist*; Checkout has *One-page checkout* and *Coupon codes*; Payments has *UPI payments* and *Refund workflow*.

**D2. Add a task to a feature** — Priya → Checkout → Features → expand *Coupon codes* → **+ Task** → "Coupon admin screen", assign Arjun, sprint *Checkout Sprint 1*.

**D3. Task must belong to a feature** — on the Tasks board, **+ New task** requires choosing a business feature.

**D4. Assignee must be on the level** — on Payments, the assignee list does not include Rahul.

**D5. Include sub-projects** — Acme → Tasks → tick *Include sub-projects / modules* to see all 34 Acme tasks on one board.

## E. Developer & QA workflow (requirement 12)

**E1. Developer sees assigned tasks** — sign in as **Arjun** → **My tasks**. You see his tasks from Acme, Storefront and Checkout, with overdue dates in red.

**E2. Developer updates status** — change *Payment step integration* to *In review*. It moves on the Checkout board immediately for everyone watching.

**E3. Developer cannot move other people's tasks** — Arjun → Storefront → Tasks: Rahul's cards cannot be dragged. Through the API this returns 403.

**E4. QA moves any task** — sign in as **Meera** → Checkout → Tasks → drag *Double charge on refresh* from *In review* to *QA*, then to *Done*.

**E5. Live assignment notification** — open two browsers: Arjun in one, Priya in the other. Priya assigns Arjun a task. Arjun gets a pop-up *"Priya Nair assigned you: …"* and My tasks refreshes.

**E6. Comments** — open *Double charge on refresh* to read the QA ↔ developer thread. Add a comment.

## F. Roadmap (requirement 7)

**F1.** Acme → Roadmap: four milestones with a red dashed *today* line.
**F2.** Payments → Roadmap: *UPI go-live* is red (*at risk*); *PSP sandbox* is done.
**F3.** Priya: click a bar to edit dates or status, or **+ Milestone** to add one linked to a feature.

## G. Documentation (requirement 8)

**G1.** Acme → Docs → *Platform overview* (tables, lists). Switch between *Edit*, *Split* and *Preview*.
**G2.** Any member can create a doc: sign in as Rahul → Storefront → Docs → **+ New** starts from the project template.
**G3.** Only the author or a project manager can delete a doc.

## H. Chat (requirement 9)

**H1.** Each level has its own *#general*: Acme, Storefront, Checkout, Payments and Internal Tools all have history.
**H2.** Realtime: Arjun and Meera both open Checkout → Chat in two browsers; messages appear instantly on the other side.
**H3.** Privacy: Rahul never receives Payments messages, because realtime delivery follows the same visibility rules.

## I. Design diagrams (requirement 10)

**I1.** Acme → Diagrams → *High-level architecture* (flowchart).
**I2.** Checkout → *Checkout sequence*; Payments → *UPI collect flow* (with an alt/else block).
**I3.** Build one without syntax: **+ Sequence** → in the *Sequence builder* add participants, then messages (sync call, response, async), notes and alt/loop blocks. Save, then **Export SVG**.

## J. Dashboards (requirement 13)

**J1. Workspace** — Acme → Dashboard: completion %, open, overdue, blocked; tasks by status; *Platform Sprint 2* burndown; workload per person; priority; feature progress; daily throughput (last 14 days); progress per sub-project.
**J2. Sub-project** — Storefront → Dashboard includes its modules (Checkout, Search); the last chart shows progress by module.
**J3. Module** — Checkout → Dashboard with the *Checkout Sprint 1* burndown.
**J4. Developer view** — sign in as Rahul: the Acme dashboard counts only what Rahul can see.

## P. Story points & sprint analysis

Sprint capacities and story points are preloaded:

| Sprint | Level | Capacity | Committed | Completed | What it shows |
|---|---|---|---|---|---|
| Platform Sprint 1 | Acme | 13 (Arjun 6, Rahul 3, Sara 4) | 11 | 11 | A finished sprint at 100% |
| Platform Sprint 2 | Acme | 25 (Arjun 10, Sara 12, Meera 3) | 18 | 2 | Includes Kiran's 3 pts, now under Administrator with no capacity |
| Storefront Sprint 3 | Storefront | 27 (Arjun 8, Rahul 13, Meera 3, Anil 3) | 19 | 7 | Four people, including the custom-role Tech Lead |
| Checkout Sprint 1 | Checkout | 15 (total only) | **23** | 8 | **Over-allocated sprint** warning |
| Payments Sprint 1 | Payments | 20 (Sara 15, Meera 5) | 21 | 10 | **Sara over her capacity** (18 / 15) |
| Payments Sprint 2 | Payments | 20 | 5 | 0 | Planned; includes an unestimated task |

**P1. Points on tasks** — any board shows a blue points chip on each card and a points total per column. Open a task → *Story points* (0, 1, 2, 3, 5, 8, 13, 21 or *Not estimated*).

**P2. Velocity chart** — Acme → Sprints: *Story points per sprint* compares capacity, committed and completed, with the average velocity of completed sprints.

**P3. Sprint analysis** — Checkout → Sprints → **Analyse** on *Checkout Sprint 1*:
- KPIs: % of points completed, capacity, committed (amber because it's over), remaining, tasks done, not estimated.
- *Over-allocated* banner.
- Points per employee, story-point burndown, points by status.
- Employee table with a total row, and a task table.

**P4. Per-employee capacity** — Payments → *Payments Sprint 1* → Analyse: Sara's load is 120% and shown in red.

**P5. Plan capacity** — Priya → Payments → Sprints → Edit *Payments Sprint 2* → enter points per person under *Story-point capacity*. The total becomes their sum.

**P6. CSV per sprint** — in any sprint analysis:
- **Employees CSV**: one row per employee plus a TOTAL row, with capacity, allocated, completed, remaining, completion % and load %.
- **Tasks CSV**: every task with its points, assignee, status and completion date.

**P7. CSV for all sprints** — Acme → Sprints → **Export all sprints CSV**: every sprint × employee in one file, ready for Excel.

**P8. Permissions for reports** — sign in as **Arjun**: he can *Analyse* (reports.view) but has no CSV buttons (no reports.export). Sign in as **Anil** (Tech Lead): CSV buttons appear.

## S. Story points matrix

All Acme tasks are estimated with complexity × size, using the default matrix. Exceptions:

- *Code review: grid performance* (2 pts) and *Trace sampling config* (1 pt) use **manual** points.
- *Evaluate log retention costs*, *Partial refund calculation* and *Share-wishlist link design* are **not estimated**.
- **Internal Tools** has its **own matrix** (finer steps, up to 40).

**S1. Estimate with the matrix** — Priya → Checkout → Tasks → **+ New task** → *Story points: Matrix* → click the cell *Complexity 4 × Size 3* → points show **8** → save. The card shows an 8 chip.

**S2. Manual points** — open the same task → switch to **Manual** → type 6 → save. The detail view says *(manual)*. The matrix suggestion (8) is still shown for reference.

**S3. Different workspace, different matrix** — sign in as Sara → Internal Tools → Admin Console → Tasks → open *Audit log schema*:
- It is complexity 2 × size 1 → **1 pt**, because Internal Tools uses its own matrix.
- The same estimate in Acme gives 2 pts.

**S4. Edit a workspace matrix** — Priya → Acme → Team & structure → *Story point matrix* → **Custom for this workspace** → change *Complexity 5 × Size 5* from 21 to 34 → *Recalculate open tasks only* → Save. The toast reports how many tasks changed. Switch back to **Use organisation default** to undo.

**S5. Edit the organisation default** — admin → **Settings** → edit cells → Save. Only workspaces without their own matrix (Acme here, not Internal Tools) are affected.

**S6. Manual points are never overwritten** — after S4 or S5, the two manual tasks keep their values.

**S7. Reports show the method** — Sprint analysis → *Tasks* tab shows *C × S* (e.g. `4 × 3`) or *manual*. The Tasks CSV has *Points mode*, *Complexity* and *Size* columns.

## R. Custom roles (manage roles)

**R1. Roles page** — admin → sidebar → **Roles**. Cards show each role, its user count and permissions; switch to **Matrix** for a permission × role grid. The demo has created three custom roles: *Tech Lead*, *Scrum Master* and *Stakeholder*.

**R2. Create a role** — **+ New role** → name "Business Analyst", pick a colour, *Start from: Like Developer*, then add *Create & edit sprints, business features and roadmap* → Create. Assign it to a user on the Users page.

**R3. Permissions take effect** — sign in as **Divya** (Stakeholder):
- She sees dashboards, sprint analysis and chat.
- She has no *+ New* buttons and cannot drag cards.
- The API returns *403 Missing permission: …* for anything else.

**R4. Edit a built-in role** — Roles → Edit *Developer* → tick *Write docs and diagrams* off → Save. Developers can no longer create docs. The Admin role cannot be edited.

**R5. Custom role sees everything** — sign in as **Anil**: as a Tech Lead with *projects.view_all*, he sees Payments Gateway even though he isn't assigned to it, and can create and assign tasks there. He cannot create sprints (no *planning.manage*).

**R6. Delete a role with users** — Roles → Delete *Tech Lead* → choose where Anil should move (e.g. Developer) → Delete. Built-in roles cannot be deleted.

**R7. Safety rules**
- Only admins can grant or remove the Admin role.
- You cannot remove *Manage roles* from your own role.

## K. Tour guide

**K1.** First sign-in for each user starts the tour automatically.
**K2.** Sidebar → **✦ Take the tour** restarts it. Steps change by role: managers see *Create a workspace* / *Create tasks*, admins see *User management*, QA and developers get role-specific board tips.
**K3.** Keys: → / Enter next, ← back, Esc close.

---

# Live mode scenarios

Live mode (`docker compose up -d --build`, http://localhost:8090) starts empty. Use this checklist for a first real rollout.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| L1 | Refuses unsafe start | Start without `.env` | Compose stops: *Set JWT_SECRET in .env* |
| L2 | First admin | Start with `.env`, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Tour starts; sidebar shows **LIVE** |
| L3 | No demo leakage | Look at the login page | No demo accounts; no Reset button |
| L4 | Team setup | Users → create PM, developers, QA, UI developer | Users can sign in |
| L5 | First workspace | Sign in as the PM → + New workspace → add members | Workspace with *#general* chat |
| L6 | Structure | Team & structure → add sub-projects/modules → assign people | Tree updates; visibility follows assignments |
| L7 | Planning | Sprints (recurring), Features, Roadmap | Dashboard and burndown fill in |
| L8 | Daily work | Developers use My tasks; QA closes tasks | Live updates, notifications |
| L9 | Offboarding | Admin deletes a leaver | Their work and chat move to the admin |
| L10 | Backup | `mongodump` command from [DEPLOYMENT.md](DEPLOYMENT.md) | Archive file created |
| L11 | Custom roles | Roles → create the roles your company uses (e.g. Tech Lead, Scrum Master), then assign them on Users | Menus and buttons follow each role's permissions |
| L13 | Story point matrix | Settings → set your organisation's matrix; give special workspaces their own on Team & structure | Task forms use the right matrix per workspace |
| L12 | Sprint reporting | Estimate tasks in points, set sprint capacity, then Sprints → Analyse → CSV | Per-employee point completion exported |
