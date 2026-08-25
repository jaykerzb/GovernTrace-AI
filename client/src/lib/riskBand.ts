export interface RiskBandThresholds {
  riskBandLowMax: number;
  riskBandModerateMax: number;
  riskBandHighMax: number;
}

// Categorizes a Dimension 2 risk score (9-45) into the same four-tier scale
// used everywhere else in the platform (Low/Moderate/High/Critical — see
// constants/riskColors.ts). Cutoffs are org-configurable (Admin >
// Organization) so "Moderate" etc. mean whatever the org has set them to.
export function riskBand(score: number, thresholds: RiskBandThresholds): "Low" | "Moderate" | "High" | "Critical" {
  if (score <= thresholds.riskBandLowMax) return "Low";
  if (score <= thresholds.riskBandModerateMax) return "Moderate";
  if (score <= thresholds.riskBandHighMax) return "High";
  return "Critical";
}
