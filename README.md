# GovernTrace AI

An internal, multi-user application for running your organization's AI governance process end-to-end: register AI use cases, run structured risk assessments, auto-map applicable regulatory obligations, track evidence, and keep an audit trail — all gated by role.

## Stack

- **Client**: React + TypeScript + Vite, Tailwind CSS, React Router, TanStack Query
- **Server**: Node + TypeScript, Express, Prisma ORM
- **Database**: SQLite (file-based, zero setup). The schema is provider-agnostic, so switching to Postgres later is a one-line change to `server/prisma/schema.prisma`'s `datasource` block plus a new `DATABASE_URL`.

## Getting started

```bash
npm install
npm run prisma:migrate   # creates server/prisma/dev.db and applies the schema
npm run prisma:seed      # seeds demo users and the regulatory obligation reference data
npm run dev               # runs the server (http://localhost:4000) and client (http://localhost:5173)
```

Then open http://localhost:5173. The login page lists five seeded demo accounts (one per role), all sharing the password `governance123`.

| Role | Email | Can do |
|---|---|---|
| Admin | admin@example.com | Everything |
| Compliance Officer | compliance@example.com | Run/finalize risk assessments, change system status, update obligations |
| System Owner | owner@example.com | Register/edit systems they own, start risk assessments |
| Approver | approver@example.com | Change system status (approve/deploy/etc.) |
| Viewer | viewer@example.com | Read-only |

## How the governance model works

1. **Register an AI use case through the guided intake wizard** (`Register use case` in the left nav) — a 4-step flow: **Basics** (use case name, description, capability category, line of business, business owner, application name, AI type/vendor, projected cost, target deployment date), **Data & deployment** (purpose, data types, deployment context), **Supporting documents** (optional — attach SOC reports, whitepapers, contracts on the spot or skip and add them later), and **Review**. The system is created as soon as step 1 is submitted (status `Draft`) and saved progressively at each step, so nothing is lost if you navigate away — the system's detail page shows a "Resume intake" banner linking back into the wizard until you finish the **Review** step and click **Complete intake** (status moves to `Intake`). Capability category, application name, projected cost, and target deployment date are all optional at the database level (same reasoning as purpose/data types/deployment context — a `Draft` record must be able to exist before every field is filled in) but marked required in the Basics step's form since they're meant to be captured up front.
2. **Run a risk assessment** — the org's actual two-dimension methodology (`server/src/services/riskQuestionnaire.ts`), not an invented framework:
   - **Dimension 1 — Trigger Questions**: 4 yes/no questions (customer-facing capability, regulated-decision recommendations, vendor use of customer data for training, full autonomy). Informational only — a "Yes" flags the system for additional review but doesn't affect the score or block anything.
   - **Dimension 2 — Risk Scoring**: 9 questions (Decision Autonomy, Prompt/Input Manipulation, Business Impact, External Interaction, Data Sensitivity, Output Content, Explainability, Accuracy Criticality, Change Autonomy), each scored 1/3/5. The total (9–45) determines the approval authority: **below 30, AIGA may approve; at or above 30, AISC approval is required.**
   
   You can save a draft and come back to it; only a Compliance Officer or Admin can finalize it. (Assessments can't be started until intake is complete.)
3. **Finalizing an assessment auto-populates obligations** — every regulatory obligation (managed in the admin panel's Obligations library) whose minimum approval authority is met by the system's score gets attached as a trackable checklist item, with a status (Not started / In progress / Satisfied / N/A) and a free-text evidence notes field.
4. **Supporting documents live on the system's detail page too**, not just during intake — upload a SOC report, whitepaper, contract, or policy at any point in the system's life, with a category and optional description. Files are stored on disk under `server/uploads/<systemId>/`; anyone authenticated can view/download, but only the system's owner, Compliance Officers, or Admins can upload or delete.
5. **Everything is audited** — registering a system, completing intake, starting/finalizing an assessment, changing status, updating an obligation, and uploading/deleting a document all write an audit log entry, visible on the system's detail page. Actions that aren't scoped to one system (user management, obligation library edits) land in the admin panel's **Activity** tab instead.
6. **The dashboard** rolls all of this up: a live-updating (polls every 15s) donut chart of obligation status across the whole registry, systems by status/tier, systems still needing an assessment, and open obligations.
7. **The AI Use Cases Registry** (`AI Use Cases Registry` in the left nav — the renamed AI systems list) can be filtered by name, business unit, status, approval authority, AI type, and owner.

### Navigation

The left sidebar collapses to an icon-only rail via the toggle at the bottom — the state persists per-browser in `localStorage`. It has: Dashboard, AI Use Cases Registry, Register use case (Admin/System Owner), Account (everyone), and — under an "Administration" divider — Admin (Admin role only).

### Account & Admin

- **Account** (`/account`, any role): edit your own name/email, change your password, or deactivate your account. Deactivation is intentionally **not** a hard delete — a user who has ever owned a system, run an assessment, or touched an obligation/document is referenced by required foreign keys that make the audit trail trustworthy in the first place. Deactivating signs you out and blocks further logins immediately (auth checks the DB on every request, not just the session token), while everything you're historically attributed to stays intact. A guard blocks deactivating (or demoting) the last active Admin so the system can never lock itself out.
- **Admin** (`/admin`, Admin role only): **Users** — create accounts, change roles, deactivate/reactivate, reset passwords. **Obligations library** — create/edit/delete the regulatory obligations that get auto-mapped onto systems (delete is blocked with a 409 if any system currently has that obligation attached). **Activity** — the system-level audit log for everything above.

### Seeded regulatory obligations

The obligation reference table starts seeded with a small illustrative set spanning **NIST AI RMF**, **Colorado SB 26-189**, **California AB 2013**, and **Texas TRAIGA** (see `server/prisma/seed.ts`) — but it's no longer seed-only: manage it going forward from Admin → Obligations library.

**These mappings are illustrative starting points, not legal advice.** The specific obligations, their trigger conditions, and applicable approval-authority thresholds should be reviewed and adjusted by legal/compliance counsel to match your organization's actual regulatory exposure.

> **Note on the risk model history**: the app originally used an invented 4-tier (Low/Medium/High/Critical) risk scale before switching to the org's real Dimension 1/Dimension 2 methodology and AIGA/AISC approval-authority split. Assessments finalized under the old model were one-time backfilled (old Low/Medium → AIGA, High/Critical → AISC) so historical systems still show a valid approval authority — their original saved answers remain in the audit trail for reference, but don't correspond to the current 13-question form.

## What's built vs. what's next

**Fully working:** auth & roles, guided AI use case intake wizard, filterable use case registry, risk assessment & tiering, obligation auto-mapping with evidence tracking, an editable obligations library, supporting document uploads (intake + ongoing), audit trail (per-system and system-level), a live dashboard chart, self-service account management, and an admin panel for users/obligations/activity.

**Scaffolded but not wired into the UI yet:** the `ApprovalStep` data model exists (per-system approval steps with a required role, status, and comment) but there's no UI to generate or act on them yet. The natural next step is to auto-generate approval steps when a risk assessment is finalized (more steps for higher tiers) and add an approvals inbox/action UI for Approvers — the same pattern used for obligation auto-mapping in `server/src/services/obligationMapper.ts` can be mirrored for this.

Other reasonable follow-ups: email notifications, and swapping local-disk document storage for cloud object storage if you outgrow a single-host deployment (the `Document` model/API shape doesn't need to change — only `server/src/lib/uploads.ts`).
