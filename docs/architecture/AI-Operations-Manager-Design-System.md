AI-Operations-Manager-Design-System.md


# AI Operations Manager — UI/UX Design System
 
**Companion to SAD & PRD. This is the Phase 0.5 deliverable referenced in SAD Section 11.**
Built on shadcn/ui conventions (Radix primitives + Tailwind), targeting Linear/Vercel/Stripe/Notion-tier enterprise SaaS polish.
 
---
 
## 1. Design Principles
1. **Dark-first, not dark-only** — this is a focused-work tool; dark is the default, light is a fully supported secondary theme, not an afterthought.
2. **Density with breathing room** — enterprise ops data is dense (tables, boards); use the 8px spacing system to avoid clutter without wasting screen real estate.
3. **AI presence is visible but never noisy** — confidence chips, AI-sourced badges, and the Copilot button are always subtle until engaged (see Section 8).
4. **Every state is designed** — loading, empty, and error states are first-class deliverables per screen, not generic spinners.
---
 
## 2. Color Palette
 
### 2.1 Dark theme (default) — CSS variables in `globals.css`
```css
--background: 240 10% 6%;        /* near-black, slight blue undertone */
--surface: 240 8% 10%;           /* card backgrounds */
--surface-raised: 240 8% 14%;    /* modals, popovers */
--border: 240 6% 20%;
--foreground: 0 0% 98%;
--muted-foreground: 240 5% 65%;
 
--primary: 250 84% 64%;          /* indigo-violet, brand accent */
--primary-foreground: 0 0% 100%;
 
--success: 142 71% 45%;          /* on-track, completed */
--warning: 38 92% 55%;           /* at-risk, medium urgency */
--danger: 0 72% 58%;             /* critical, overdue, high urgency */
--info: 199 89% 60%;             /* AI-sourced, informational */
 
--glass-surface: rgba(255,255,255,0.04);   /* glass-panel treatment */
--glass-border: rgba(255,255,255,0.08);
```
 
### 2.2 Light theme (secondary)
```css
--background: 0 0% 100%;
--surface: 240 20% 98%;
--surface-raised: 0 0% 100%;
--border: 240 6% 90%;
--foreground: 240 10% 8%;
--muted-foreground: 240 5% 40%;
/* primary/success/warning/danger/info hues unchanged, adjusted lightness for contrast */
```
 
### 2.3 Semantic usage rules
- Status color is **never the sole indicator** — always paired with an icon or text label (accessibility rule, Section 10).
- `--info` (blue) is reserved exclusively for AI-generated/AI-sourced content markers (badges, confidence chips) so users learn to recognize "this came from AI" at a glance across the whole product.
- Gradient accents (`primary` → `info`, subtle 8–12% opacity) used sparingly on the Executive Dashboard health ring and Chat Workspace header only — not on every card, or it stops reading as intentional.
---
 
## 3. Typography
 
| Role | Font | Size / Line-height | Weight |
|---|---|---|---|
| Display (dashboard titles) | Inter | 28px / 36px | 600 |
| H1 (page title) | Inter | 22px / 30px | 600 |
| H2 (section header) | Inter | 17px / 24px | 600 |
| Body | Inter | 14px / 20px | 400 |
| Small / metadata | Inter | 12px / 16px | 400 |
| Mono (IDs, code, token counts) | JetBrains Mono | 13px / 18px | 400 |
 
Inter for UI (matches shadcn defaults, excellent at small sizes for dense tables); JetBrains Mono reserved for anything numeric/technical (agent run IDs, token counts in the AI Control Center) to visually separate "data" from "narrative."
 
---
 
## 4. Spacing System (8px base)
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` (px) — Tailwind scale `1,2,3,4,6,8,12,16`.
- Card padding: 16px (mobile) / 24px (desktop).
- Section gaps: 32px between major dashboard sections, 16px between cards in a grid.
- Table row height: 40px (dense data), 48px (Kanban card).
---
 
## 5. Iconography
**Lucide** (matches shadcn ecosystem, already a dependency). Sizes: 16px (inline/table), 20px (buttons/nav), 24px (empty states/headers). Never mix icon sets. Status icons standardized: `CheckCircle2` (done/on-track), `AlertTriangle` (at-risk), `AlertCircle` (critical), `Clock` (pending/stale), `Sparkles` (AI-generated content marker, paired with `--info` color).
 
---
 
## 6. Component Library (inventory + states)
 
Built on shadcn primitives (`Button`, `Card`, `Dialog`, `DropdownMenu`, `Table`, `Tabs`, `Toast`, `Popover`, `Command`). Composite components layered on top:
 
| Component | States required | Notes |
|---|---|---|
| `KpiCard` | default, loading (skeleton), empty, trend-up/down | Used across all dashboards |
| `StatusBadge` | on_track/at_risk/critical/done/blocked | Icon + color + text, never color alone |
| `AiSourceBadge` | classified, suggested, auto-created | `--info` blue, `Sparkles` icon, hover shows confidence (§8) |
| `KanbanBoard` / `KanbanCard` | default, dragging, drop-target, loading, empty column | Keyboard-navigable per accessibility rules |
| `DataTable` | default, loading, empty, error, sortable header | Shared across Email/Task/Audit views |
| `RiskPill` | low/medium/high severity | Maps to warning/danger scale |
| `ConfidenceChip` | ≥90% / 70–89% / <70% (visually distinct per §8) | Tooltip shows rationale |
| `ActionTimeline` | default, loading, collapsed/expanded | Reused across Email/Meeting/Task detail (SAD §13.9) |
| `CopilotButton` | idle, active/expanded, thinking | Floating, bottom-right, page-context aware |
| `ChatPanel` | idle, streaming response, action-pending (approval button), error | Persistent right-side, collapsible |
| `CommandPalette` | idle, searching, no-results | `cmdk`-based, ⌘K trigger |
 
---
 
## 7. Dashboard Layout Grid
12-column responsive grid, `gap-6` (24px).
- **Desktop (≥1280px)**: KPI row = 4 cards × 3 cols each; charts = 2 cards × 6 cols (side by side) or 1 × 12 (full-width timeline/heatmap).
- **Tablet (768–1279px)**: KPI row wraps to 2×2; charts stack full-width.
- **Mobile (<768px)**: everything single-column, charts simplify to sparklines (per SAD §6.7), Kanban becomes swipeable single-status columns.
Sidebar: 240px expanded / 64px icon-rail collapsed (breakpoint `lg`), persists via Zustand UI store (SAD §6.4).
 
---
 
## 8. Chart Specifications
 
| Chart | Library | Used for | Style notes |
|---|---|---|---|
| Progress Ring | Recharts `RadialBarChart` | Health score | Single ring, gradient fill, large center numeral |
| Line Chart | Recharts | Weekly trend, velocity | 2px stroke, subtle area fill at 8% opacity below line |
| Area Chart | Recharts | Burndown | Gradient fill primary→transparent |
| Bar Chart (horizontal) | Recharts | Project portfolio, team workload | Rounded corners (4px), status color per bar |
| Donut Chart | Recharts `PieChart` | Email intent distribution | Center label = total count |
| Heat Map | Custom (CSS grid + color scale) | Day×team completion density | 5-step color scale, `--muted` → `--success` |
| Dependency/Org Graph | React Flow | Ops dependency graph, Org Map | Custom nodes matching `Card` styling, edges colored by relationship type |
| Timeline | Custom vertical component | Activity/Action Timeline | Connector line + icon nodes, per §6 |
 
All charts: tooltip on hover using `Popover` styling for consistency, data-table fallback rendered visually-hidden for screen readers (accessibility, §10), loading state = skeleton matching chart's final shape (never a generic spinner, per SAD §6.6).
 
---
 
## 9. Animation Guidelines (Framer Motion)
- **Duration**: micro-interactions (hover, toggle) 120–150ms; panel open/close (Chat, Copilot, Command Palette) 200ms; page transitions none (instant, this is a productivity tool — animated route transitions cost more than they add).
- **Easing**: `easeOut` for entrances, `easeIn` for exits — standard, no bounce/spring on enterprise surfaces (springs read as playful, wrong register for this product).
- **Kanban drag**: card lifts with a subtle shadow + 1.02 scale, drop settles in 150ms.
- **Live/streaming content** (Chat responses, "AI is thinking" states): typing-indicator dots, not skeleton — signals active processing distinctly from static loading.
- Respect `prefers-reduced-motion` — all of the above disabled/instant when set.
---
 
## 10. Accessibility Rules
- WCAG 2.1 AA minimum contrast on all text/background pairs in both themes (verified against the palette in Section 2 before implementation, per SAD Phase 0.5 acceptance criteria).
- Status never conveyed by color alone (Section 6, `StatusBadge`).
- Full keyboard navigation: Kanban board supports keyboard reordering (not just drag-drop), Command Palette is keyboard-first by design, Chat Panel and Copilot fully operable via keyboard.
- All charts have a visually-hidden data-table equivalent for screen readers.
- Focus states: visible 2px `--primary` ring on all interactive elements, never suppressed.
- Motion respects `prefers-reduced-motion` (Section 9).
---
 
## 11. Responsive Breakpoints
```
sm:  640px   — mobile
md:  768px   — tablet portrait
lg:  1024px  — sidebar collapse threshold
xl:  1280px  — full dashboard grid
2xl: 1536px  — wide monitors, grid gains breathing room, not more columns
```
 
---
 
*End of Design System. See companion documents: Software Architecture Document (SAD), Product Requirements Document (PRD).*
 