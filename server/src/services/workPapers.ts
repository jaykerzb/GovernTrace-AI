// Thin re-export layer so existing callers (routes/workPapers.ts,
// services/workPaperSync.ts) don't need to know the scoping logic moved to
// a DB-backed, admin-editable model. See services/functionWorkPapers.ts.
export { getInScopeSections, getInScopeFunctions } from "./functionWorkPapers.js";
