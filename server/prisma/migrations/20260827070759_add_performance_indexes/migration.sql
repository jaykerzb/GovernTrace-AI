-- CreateIndex
CREATE INDEX "AiSystem_businessUnit_idx" ON "AiSystem"("businessUnit");

-- CreateIndex
CREATE INDEX "AiSystem_status_idx" ON "AiSystem"("status");

-- CreateIndex
CREATE INDEX "AiSystem_ownerId_idx" ON "AiSystem"("ownerId");

-- CreateIndex
CREATE INDEX "AuditLog_aiSystemId_idx" ON "AuditLog"("aiSystemId");

-- CreateIndex
CREATE INDEX "Comment_aiSystemId_idx" ON "Comment"("aiSystemId");

-- CreateIndex
CREATE INDEX "Document_aiSystemId_idx" ON "Document"("aiSystemId");
