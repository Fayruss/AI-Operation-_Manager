AI-Operations-Manager-Portfolio-Case-Study.md


# AI Operations Manager — Portfolio Case Study
 
*Template for the write-up once the build exists. Structure and talking points are ready now; fill in bracketed sections with real screenshots/metrics/decisions as you build. This is what turns the project from "I built an app" into a demonstrated systems-design capability.*
 
---
 
## The Business Problem
Mid-sized companies (20–500 people) lose significant operational capacity to coordination overhead: status chasing, manually re-typing action items from email/meetings into project tools, and executives learning about risk after it's already impacted a deadline or client relationship. Existing tools (Slack, email, Linear/Jira) each solve one piece but none of them connect signal to action — a person still has to read, decide, and manually update three systems.
 
**[Fill in]**: the specific trigger for this project — a client pain point you observed, a gap in an existing agency workflow, etc.
 
## Research
- Point-solution automation tools (Zapier-style) can move data between systems but don't *reason* about it — they can't distinguish an urgent client escalation from routine FYI email.
- Existing AI note-takers summarize meetings but don't close the loop into a task system with ownership and tracking.
- The gap: an operations layer that combines LLM reasoning (classification, extraction, risk scoring) with governed, auditable action — not just another dashboard, and not an ungoverned autonomous agent either.
## Product Vision
Full detail in the companion PRD — summary for this case study: an AI operations layer that reads company signal (email, meetings, task activity) and takes structured, human-approved action, while building organizational memory over time. See **PRD.md**.
 
## System Architecture
Full detail in the SAD — key architectural decisions worth highlighting in a technical interview/pitch context:
- **Postgres as sole source of truth, AI as a reasoning layer over it** — every agent proposes, deterministic backend logic and human approval gates decide. This was a deliberate rejection of a more "autonomous agent" architecture, prioritizing trust and auditability for an enterprise buyer over autonomy for its own sake.
- **Event-driven backbone (SAD §14)** added after the initial workflow-chaining design — recognizing that direct workflow-to-workflow calls don't scale as new automations get added; subscribing to named events does.
- **n8n as orchestration substrate rather than hand-rolled job queue** — traded some flexibility for visual debuggability and built-in retry semantics, which matters more than raw flexibility for a system whose credibility depends on never silently dropping an email or task.
- Full diagram: **SAD.md, Section 3**.
## Database Design
Multi-tenant via Postgres Row-Level Security (not just app-layer checks) — chosen specifically because the AI agents have write access, and DB-enforced isolation is a stronger guarantee than trusting every code path to remember an `org_id` filter. Full schema: **SAD.md, Section 4**.
 
**[Fill in]**: an ERD screenshot once implemented.
 
## AI Workflow Diagrams
Six core automations (email processing, task creation, meeting processing, risk detection, reporting, memory consolidation), each documented trigger-to-failure-path in the **n8n Workflow Specification**. The retry/rollback/failure-handling discipline applied uniformly across all six is the detail most engineers skip and most differentiates this from a demo-quality automation.
 
**[Fill in]**: n8n canvas screenshots once built.
 
## Dashboard Designs
Seven purpose-built dashboards (Executive, Project, Email, Operations, Meeting, Reports, Analytics), each visualization chosen for a specific decision it enables — not visualization for its own sake (full rationale per chart: **SAD.md, Section 7**). Design system (palette, typography, component states, accessibility rules): **Design-System.md**.
 
**[Fill in]**: dashboard screenshots/demo GIF once built.
 
## Technical Decisions & Trade-offs (worth narrating explicitly in interviews)
| Decision | Trade-off accepted | Why |
|---|---|---|
| Approval-gated AI actions, not full autonomy | Slower time-to-action on some tasks | Enterprise trust requires no AI action that's irreversible or externally visible happens without a human confirming |
| Retrieval-augmented memory, not fine-tuning | Less "deep" per-org adaptation than fine-tuning could offer | Auditability (can trace which past correction shaped a suggestion) and avoiding per-org model management overhead |
| Postgres-native pub/sub over Kafka/SQS | Less throughput ceiling than a dedicated message bus | Sufficient at target scale (mid-sized orgs), keeps the event log SQL-queryable, avoids an entire extra infrastructure component for v1 |
| Workflow Builder scoped to parameter-editing only (v1) | Less flexible than full drag-and-drop workflow authoring | Letting non-engineers rewire trigger logic without validation would undermine the retry/audit guarantees the rest of the system depends on |
| pgvector co-located with operational data | Less specialized than a dedicated vector DB at very large scale | Enables single-query joins between memory and live records under RLS; second source of truth avoided |
 
## Challenges
**[Fill in as encountered]** — likely candidates worth documenting as you build: tuning classification confidence thresholds against false-positive cost, chunking strategy for long meeting transcripts, keeping the Chat Workspace grounded (no hallucinated entity references) under retrieval budget constraints.
 
## Final Screenshots & Demo
**[Fill in]** — Executive Dashboard, Kanban board with an AI-sourced task badge visible, Chat Workspace mid-conversation with an action-approval button, AI Control Center showing live agent activity. A 60–90 second demo video showing the Journey A loop (email arrives → task appears → notification fires) is the single most persuasive artifact for a freelance pitch — it's the moment that makes "AI operations platform" concrete rather than abstract.
 
## Technologies Used
Next.js 15 · React 19 · TypeScript · TailwindCSS · shadcn/ui · Framer Motion · Recharts · React Flow · Supabase (Postgres, Auth, Realtime, pgvector) · Prisma · n8n · Claude API · Docker · GitHub Actions · Vercel.
 
## Lessons Learned
**[Fill in post-build]** — this section is most credible written after real implementation friction, not predicted in advance. Worth capturing: where the architecture held up as designed vs. where reality forced a deviation, and why.
 
---
 
## How to Use This Document
For a freelance/agency pitch: lead with the **Business Problem** and **Final Screenshots & Demo** (the concrete, visual proof), then let a technical reviewer go as deep as they want into **Technical Decisions & Trade-offs** — that section, more than any single screenshot, is what signals "this person can own architecture," since it shows you can articulate *why not* the alternatives, not just what you chose.
 
---
 
*End of Portfolio Case Study Template.*
 
