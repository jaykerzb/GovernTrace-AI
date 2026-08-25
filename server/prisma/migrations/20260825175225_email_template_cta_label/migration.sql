-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmailTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ctaLabel" TEXT NOT NULL DEFAULT 'View in GovernTrace AI',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_EmailTemplate" ("body", "id", "kind", "subject", "updatedAt") SELECT "body", "id", "kind", "subject", "updatedAt" FROM "EmailTemplate";
DROP TABLE "EmailTemplate";
ALTER TABLE "new_EmailTemplate" RENAME TO "EmailTemplate";
CREATE UNIQUE INDEX "EmailTemplate_kind_key" ON "EmailTemplate"("kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
