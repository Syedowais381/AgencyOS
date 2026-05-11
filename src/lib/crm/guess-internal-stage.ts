export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "appointment_set"
  | "showed"
  | "won"
  | "lost";

export function guessInternalStageFromGhlStageName(name: string): LeadStage {
  const n = name.toLowerCase();
  if (n.includes("won")) return "won";
  if (n.includes("lost") || n.includes("abandon")) return "lost";
  if (n.includes("show") || n.includes("attended")) return "showed";
  if (
    n.includes("book") ||
    n.includes("sched") ||
    n.includes("appt") ||
    n.includes("call")
  )
    return "appointment_set";
  if (n.includes("qualif")) return "qualified";
  if (n.includes("contact") || n.includes("reach")) return "contacted";
  return "new";
}

export function mapGhlOpportunityStatusToStage(
  status: string | undefined,
  fallback: LeadStage,
): LeadStage {
  if (status === "won") return "won";
  if (status === "lost" || status === "abandoned") return "lost";
  return fallback;
}
