# News to Actions — Product Features

**Purpose:** Single reference for product capabilities. Use for marketing copy, landing-page design, and onboarding. For implementation details see ROADMAP.md and SYSTEM_STATE.md.

---

## Product overview

News to Actions turns news and RSS into a prioritized feed of **action items**. You define topics (e.g. “AI regulation”, “competitor X”); the app fetches articles, summarizes them with AI, and generates role-based next steps (e.g. for Marketing, Sales). You get one dashboard of articles + summaries + actions, filterable by persona, with optional Slack/email alerts. Built for teams: org-scoped data, admin controls, and background processing so the feed stays current without manual refresh.

---

## Roles

| Role | Who | Access |
|------|-----|--------|
| **Member** | Any signed-in user in an organization | Dashboard, Settings. Sees org topics, articles, and action items; can run ingest and AI from the dashboard. |
| **Admin** | Org admin (Clerk or DB) | Everything members see, plus Admin: invite users, data governance, Jobs (run history, queue, “Run jobs now”), and a dedicated Action items list with filters and assignment. |

---

## All users (after sign-in)

### Authentication & org

- **Sign-in / sign-up** via Clerk.
- **Organization** — You always work in the context of an organization. In the header, open the Organization menu and choose **Create organization** to create one (e.g. for yourself; you can use it alone). The app hides the “Personal account” option in that menu so only organizations and “Create organization” are shown. Use the org switcher to switch. All data is scoped to the active org.
- **Theme:** Light / dark / system in Settings.

---

## Dashboard (Articles)

**Route:** `/app/articles` — main dashboard.

### Topics & ingest

- **Topics:** List of saved topics (name, query, optional display name). Each topic has an RSS-based query and ingestion cadence (hourly, daily, weekly).
- **Add topic:** Create a topic with a query; optional search phrase and focus filter.
- **Ingestion cadence:** Per-org setting in Settings (e.g. how often topics are refreshed).
- **Execute:** One-click “Execute” enqueues ingest for all enabled topics (fetch articles → summarize → generate actions). Jobs run in the background; cron or “Run jobs now” (Admin) processes them. Button shows “Processing…” while work is queued.
- **Topic health:** Per-topic last success/failure and queue state (e.g. “Running”, “Queued”) where relevant.

### Articles

- **Article list:** Per topic, recent articles with title, source, link, publish date.
- **Summarize:** Per-article “Summarize” triggers AI summary (bullets). Button shows “Summarizing…” while running.
- **Generate actions:** Per-article “Generate actions” produces persona-based action items. Optional confirmation step. Button shows “Generating…” while running.
- **Summaries and action items** are shown inline under each article; action items can be toggled (To do / In progress / Done / Dismissed) and edited on the Dashboard or (for admins) on the Admin Action items page.

### Personas

- **Personas:** Roles used to tailor generated actions (e.g. Marketing, Sales). Stored per org.
- **Add persona:** Create by name (e.g. “Marketing”, “Sales”).
- **Select for feed:** Choose which personas’ action items appear in the feed (multi-select). Only selected personas are used when generating new actions.

### Feed experience

- **Persona filter:** Switch the feed view by persona to see only that role’s actions.
- **Action item status:** Update status (To do → In progress → Done / Dismissed) and edit inline where the UI supports it.
- **Links:** Open article URL, jump to topic or article from job-run details (Admin).

---

## Settings

**Route:** `/app/settings`.

- **Theme:** Light / dark / system.
- **Refresh cadence:** How often the org’s topics are ingested (e.g. daily).
- **Action items per persona per article:** Cap on how many actions are generated per persona per article (e.g. 2).
- **Notifications:** Slack webhook URL and/or email recipients; digest cadence (off / daily / weekly). Delivery is implemented but “not enabled yet” in the current UI copy; admins can configure for future use.

---

## Admin only

**Route:** `/app/admin/*`. Nav shows “Admin” only for org admins.

### Admin → Data

- **Invite user:** Invite by email; they get a sign-in/sign-up flow and join the org.
- **Data governance:**
  - **Org export:** Request a full org export (job-based); artifact to local path or S3.
  - **Org delete:** Get a delete plan (row counts, integrity check), then confirm with token for irreversible org deletion.

### Admin → Jobs

- **Scheduled runs:** Status of cron (e.g. “OK – last run 2m ago”).
- **AI usage & cost:** Token usage and estimated cost (e.g. last 24h, 7d) for summarize and generate-actions.
- **Last scheduled run:** Timestamp and status (e.g. SUCCEEDED).
- **Recent job runs:** Table of runs (time, type, status, duration, links to topic/article).
- **Run jobs now:** Button to process the queue immediately. Disabled when queue is empty; shows “Processing…” while running.
- **Job metrics:** Last 24h and 7d (avg duration, P95, success rate, queue wait).
- **Queue backlog:** Count of due jobs; severity (e.g. warn at 20+, critical at 50+); breakdown by type and oldest due.
- **Dead-letter jobs:** Counts and list of jobs that failed after all retries; optional “Retry now” or “Cancel”.
- **Topic health:** Per-topic last success/failure.
- **Links:** Back to Data and to Articles.

### Admin → Actions (Action items list)

- **Full action list:** All org action items in one table (admin-only view).
- **Filters:** By status (All / To do / In progress / Done / Dismissed) and assignee (All / Unassigned / Me).
- **Columns:** Text, status, due date, priority, persona, assignee.
- **Inline edit:** Update status, priority, persona, assignee.
- **Audit/events:** Event list per action item (e.g. status changes, assignments).
- **Assignees:** Members of the org can be set as assignees; supports “Assigned to me” filter.

---

## Summary for marketing & landing page

**Headline angles:**

- Turn news into actions: topics → articles → AI summaries → role-based next steps.
- One dashboard: topics, articles, summaries, and action items in one place.
- Built for teams: orgs, personas (Marketing, Sales, etc.), assignees, and optional Slack/email.
- Set it and run it: scheduled ingest + “Execute” when you want; background jobs keep the feed current.
- Control and visibility: admins get Jobs (runs, queue, cost) and a full action list with filters and assignment.

**Feature bullets (regular users):**

- Define topics; auto or on-demand ingest from RSS.
- AI summaries and persona-based action items per article.
- Filter the feed by persona; update status (To do / Done / Dismissed).
- Settings: refresh cadence, action items per persona, theme, notifications (Slack/email).

**Feature bullets (admins):**

- Everything above, plus:
- Invite users; org export and org delete (governance).
- Jobs: run history, queue, “Run jobs now,” AI cost, dead-letter handling.
- Full action list: filters by status and assignee; edit status, priority, persona, assignee.

**Technical note (for copy):** AI is Anthropic Claude (summarize + generate actions). Cron or external scheduler runs jobs every 5 minutes in production; “Execute” also kicks off processing immediately.
