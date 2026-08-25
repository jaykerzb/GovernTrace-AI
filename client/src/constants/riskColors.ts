// Fixed status severity ramp — never themed (see dataviz skill's status palette).
export const RISK_COLORS: Record<string, string> = {
  Low: "#0ca30c",
  Moderate: "#fab219",
  High: "#ec835a",
  Critical: "#d03b3b",
  NOT_RATED: "#94a3b8",
};

export const RISK_LABELS: Record<string, string> = {
  Low: "Low",
  Moderate: "Moderate",
  High: "High",
  Critical: "Critical",
  NOT_RATED: "Not Rated",
};

export const RISK_RATING_ORDER = ["Critical", "High", "Moderate", "Low", "NOT_RATED"];
