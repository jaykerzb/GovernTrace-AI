-- Removes the Regulatory Obligations feature. Function work papers now
-- cover the same statutory ground per business unit, so this table pair is
-- redundant and is dropped along with its data.
DROP TABLE "SystemObligation";
DROP TABLE "RegulatoryObligation";
