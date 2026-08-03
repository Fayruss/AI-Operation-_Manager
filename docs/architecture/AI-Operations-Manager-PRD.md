AI-Operations-Manager-PRD.md


# AI Operations Manager — Product Requirements Document (PRD)
 
**Companion to the Software Architecture Document (SAD) v1.0**
This document defines *what to build and why*; the SAD defines *how*. Every screen/flow here maps to a module in SAD Section 2 and a dashboard in SAD Section 7.
 
---
 
## 1. User Personas
 
| Persona | Role | Core Goal | Pain Today |
|---|---|---|---|
| **Priya — Founder/CEO** (startup, 15 people) | Exec | Know company health in <30 sec/day | Status comes from asking people in Slack, always stale |
| **Marcus — Ops/PM Lead** (agency, 60 people) | Power user | Zero manual re-entry of tasks from email/meetings | Copy-pastes action items into Linear by hand daily |
| **Sarah — IC / Designer** | Team member | Tasks show up where she works, minimal admin | Gets tagged in email *and* Slack *and* Jira for the same request |
| **David — Agency Account Manager** | Power user | Never miss an urgent client email | Triage is manual, urgent emails buried in volume |
| **Elena — IT/Admin** | Governance | Know exactly what the AI can touch and did touch | No audit trail when "the AI did something weird" |
 
---
 
## 2. User Stories (MVP-tagged)
 
**Priya (Exec)**
- [MVP] As Priya, I want a single dashboard showing overall company health so I don't have to ask each PM for status.
- [MVP] As Priya, I want to see active risks ranked by severity so I know what needs my attention today.
- [Future] As Priya, I want to ask "why is Project Alpha delayed?" in chat and get a grounded answer.
**Marcus (Ops Lead)**
- [MVP] As Marcus, I want emails that describe a task to automatically become a task on the right board.
- [MVP] As Marcus, I want meeting transcripts to automatically generate action items assigned to the right owner.
- [MVP] As Marcus, I want to see all AI-created tasks flagged as such so I can spot-check them.
- [Future] As Marcus, I want a visual workflow editor to change routing rules without asking engineering.
**Sarah (IC)**
- [MVP] As Sarah, I want to see my assigned tasks in one Kanban board regardless of where they originated.
- [MVP] As Sarah, I want a notification when I'm assigned a task, not to have to check manually.
**David (Account Manager)**
- [MVP] As David, I want urgent client emails visually distinguished from routine ones.
- [Future] As David, I want AI-drafted replies to urgent emails that I can approve and send in one click.
**Elena (Admin)**
- [MVP] As Elena, I want an audit log of every action the AI took, when, and why.
- [MVP] As Elena, I want to require human approval before any AI action that sends something externally.
- [Future] As Elena, I want per-agent enable/disable controls and confidence thresholds.
---
 
## 3. User Journeys
 
### Journey A — Email → Task (core loop)
1. Client sends an urgent email about a delayed deliverable.
2. System ingests, classifies (urgency=high, intent=task).
3. Task auto-created on the relevant project board, tagged "from email," assignee suggested.
4. Assignee (Sarah) gets a real-time notification.
5. Marcus sees it appear on the Ops Dashboard's Email Dashboard with the source email linked.
6. Sarah completes the task; status change flows back to close the loop (no explicit reply-to-client step in MVP — that's Journey C, Future).
### Journey B — Meeting → Action Items
1. Zoom transcript webhook fires post-meeting.
2. Summarizer Agent extracts summary + 3 action items with suggested owners.
3. Each action item becomes a task, linked back to the meeting.
4. Meeting owner reviews the summary on the Meeting Dashboard, can edit/reassign before it's "confirmed."
### Journey C — Risk Detection → Escalation
1. A task sits untouched 5 days past its due date.
2. Scheduled Risk workflow flags it (severity computed from project criticality + days overdue).
3. High-severity signal triggers immediate notification to project owner + surfaces on Executive Dashboard.
4. Owner resolves or snoozes; resolution is logged.
### Journey D — Exec Weekly Report
1. Friday 4pm scheduled trigger.
2. Report Agent aggregates the week's tasks, risks, meetings.
3. PDF generated, emailed to subscribed execs, also available in Reports Dashboard.
---
 
## 4. Screen-by-Screen Functionality
 
| Screen (SAD ref) | Core functionality | Primary persona |
|---|---|---|
| Executive Dashboard (7.1) | Health score, active risk KPIs, project portfolio bar, activity timeline, weekly trend | Priya |
| Project Dashboard (7.2) | Kanban (drag-drop), Gantt/dependency view, burndown, team workload | Marcus, Sarah |
| Email Dashboard (7.3) | Urgency-grouped inbox view, intent donut, response-time trend, convert-to-task action | David, Marcus |
| Operations Dashboard (7.4) | Heat map, risk signal feed, dependency graph | Marcus, Elena |
| Meeting Dashboard (7.5) | Calendar view, action-item conversion rate, summary previews | Marcus |
| Reports Dashboard (7.6) | Report history, scheduling config, on-demand generate, PDF export | Priya, Marcus |
| Analytics Dashboard (7.7) | Velocity trend, AI action volume, ROI/time-saved metrics, org map | Priya, Elena |
| Settings (7.8) | Org/user/roles, integrations, per-agent controls, audit log | Elena |
| AI Control Center (SAD §15) | Live agent status, queue, latency, cost, approvals | Elena |
 
Each screen's loading/empty/error states are specified in the companion Design System document (Section 7 there).
 
---
 
## 5. Success Criteria
 
| Metric | MVP Target |
|---|---|
| Email → task classification accuracy | ≥90% on labeled eval set |
| Time from meeting end to action items created | <2 minutes |
| Risk detection lead time (vs. task actually going overdue) | flagged before due date in ≥80% of cases |
| Zero silently-dropped emails/meetings | 100% (failures visibly surfaced, never lost) |
| Weekly report generation reliability | 100% (falls back to template report on agent failure — SAD §9.4) |
| Cross-tenant data leakage | 0 (verified via RLS test suite — SAD Phase 0 acceptance) |
 
---
 
## 6. Feature Priorities — MVP vs. Future
 
### MVP (SAD Phases 0.5–6)
Auth/multi-tenancy, Task/Project core + Kanban, Email ingestion + classification + auto-task, Meeting ingestion + summarization + action items, Risk detection (staleness/SLA/velocity), Executive/Project/Email/Operations/Meeting/Reports dashboards, Notifications, Audit log, Agent approval gates.
 
### Fast-Follow (SAD Phase 7)
AI Chat Workspace, Command Center (⌘K), AI Copilot panel, Time-Saved/ROI metrics, AI Confidence display, AI Action Timeline, Memory Explorer, Organization Map, Dark enterprise theme.
 
### Future (post-v1, requires SAD §17 provider layer)
Visual Workflow Builder (full edit, not just params), Reply-Draft auto-send with guardrails, CRM/accounting/support/code/storage/HR integrations, per-org fine-tuning consideration, mobile app.
 
---
 
## 7. Acceptance Criteria (sample — MVP)
 
**Email → Task**
- Given an email with clear task intent, when ingested, then a task is created within 60 seconds with `source=email` and a link back to the originating email.
- Given a classification confidence below the org's threshold, when processed, then a suggested task is created as a *notification requiring confirmation*, not auto-applied.
**Risk Detection**
- Given a task with no update for the project's configured staleness threshold, when the scheduled risk workflow runs, then a `risk_signals` row is created and, if severity=high, the project owner is notified within the same run.
**Audit**
- Given any AI agent mutates a record, when viewed in the Audit Log, then the entry includes agent name, timestamp, before/after diff, and the triggering event.
**Approval Gate**
- Given an agent proposes an irreversible/external action (e.g., send email reply), when proposed, then no action occurs until an admin+ user explicitly approves via UI or Chat Workspace button.
---
 
*End of PRD. See companion documents: Software Architecture Document (SAD), UI/UX Design System.*
 
