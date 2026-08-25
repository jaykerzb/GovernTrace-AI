import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getCustomFieldDefs } from "../services/customFields.js";

export const customFieldsRouter = Router();
customFieldsRouter.use(requireAuth);

// Returns every field def (including inactive) — the intake form filters to
// active ones, while read-only displays need the full set so a system with a
// value under a since-deactivated field still shows a real label.
customFieldsRouter.get("/custom-fields", async (_req, res) => {
  res.json(await getCustomFieldDefs());
});
