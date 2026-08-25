import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getAiTypeOptions } from "../services/aiTypeOptions.js";

export const aiTypeOptionsRouter = Router();
aiTypeOptionsRouter.use(requireAuth);

// Returns every option (including inactive) — the intake/edit forms filter
// to active ones for the picker, while read-only displays need the full set
// so a system using a since-deactivated type still shows a real label.
aiTypeOptionsRouter.get("/ai-type-options", async (_req, res) => {
  res.json(await getAiTypeOptions());
});
