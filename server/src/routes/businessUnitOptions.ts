import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getBusinessUnitOptions } from "../services/businessUnitOptions.js";

export const businessUnitOptionsRouter = Router();
businessUnitOptionsRouter.use(requireAuth);

// Returns every option (including inactive) — the intake/edit forms filter
// to active ones for the picker, while read-only displays need the full set
// so a system using a since-deactivated business unit still shows a real label.
businessUnitOptionsRouter.get("/business-unit-options", async (_req, res) => {
  res.json(await getBusinessUnitOptions());
});
