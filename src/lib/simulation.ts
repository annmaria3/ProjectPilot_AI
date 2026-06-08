import type { Project as ProjectState, ProjectModule } from "./project-store";

export interface SimResult {
  successProbability: number; // 0-100
  riskScore: number; // 0-100 (higher = riskier)
  complexity: number; // 0-100
  innovation: number; // 0-100
  costScore: number; // 0-100 (higher = better budget fit)
  readiness: number; // 0-100
  predictedDelayDays: number;
  predictedCompletion: string; // ISO date
  health: number; // 0-100
  criticalModuleId: string | null;
  signals: { label: string; tone: "good" | "warn" | "bad" }[];
}

const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, n));

export function simulate(state: ProjectState): SimResult {
  const {
    teamSize, durationWeeks, budget, skillLevel, description, modules,
  } = state;

  // crude complexity heuristic based on description length & keywords
  const desc = (description || "").toLowerCase();
  const complexityKeywords = ["ai", "ml", "blockchain", "realtime", "iot", "ar", "vr", "video", "kubernetes", "distributed"];
  const innovationKeywords = ["ai", "ml", "novel", "patent", "research", "agent", "twin", "simulator", "blockchain", "ar", "vr"];
  const complexityHits = complexityKeywords.filter((k) => desc.includes(k)).length;
  const innovationHits = innovationKeywords.filter((k) => desc.includes(k)).length;

  const baseComplexity = clamp(40 + complexityHits * 10 + Math.max(0, desc.length - 80) * 0.05);
  const innovation = clamp(45 + innovationHits * 9);

  // ideal capacity: team * weeks should comfortably exceed complexity
  const capacity = teamSize * durationWeeks * (skillLevel / 6);
  const demand = baseComplexity * 4; // points of effort
  const capacityRatio = capacity / Math.max(1, demand);

  const readiness = clamp((skillLevel / 10) * 60 + (teamSize >= 3 ? 25 : 10) + (durationWeeks >= 8 ? 15 : 5));
  const costScore = clamp(40 + Math.min(60, budget * 1.6) - baseComplexity * 0.25);
  const riskScore = clamp(70 - capacityRatio * 30 + (10 - skillLevel) * 3 + (baseComplexity - 50) * 0.4);
  const successProbability = clamp(
    35 + capacityRatio * 30 + (skillLevel - 5) * 4 + (innovation - 50) * 0.15 - (baseComplexity - 50) * 0.3
  );
  const health = clamp(
    (modules.reduce((s, m) => s + m.progress, 0) / Math.max(1, modules.length)) * 0.6 +
      (100 - riskScore) * 0.4
  );

  // delay prediction: blocked or stalled modules add days
  const blocked = modules.filter((m) => m.status === "blocked").length;
  const slow = modules.filter((m) => m.status === "in_progress" && m.progress < 30).length;
  const predictedDelayDays = Math.round(blocked * 6 + slow * 2 + Math.max(0, 1 - capacityRatio) * 14);

  const start = new Date(state.startDate);
  const end = new Date(start.getTime() + durationWeeks * 7 * 86400000 + predictedDelayDays * 86400000);

  const critical = pickCriticalModule(modules);

  const signals: SimResult["signals"] = [];
  if (capacityRatio < 0.9) signals.push({ label: "Capacity below demand", tone: "bad" });
  if (skillLevel < 5) signals.push({ label: "Skill gap detected", tone: "warn" });
  if (innovation > 70) signals.push({ label: "High innovation score", tone: "good" });
  if (budget < 10) signals.push({ label: "Budget tight", tone: "warn" });
  if (blocked > 0) signals.push({ label: `${blocked} blocked module${blocked > 1 ? "s" : ""}`, tone: "bad" });
  if (successProbability > 75) signals.push({ label: "On track to ship", tone: "good" });

  return {
    successProbability: Math.round(successProbability),
    riskScore: Math.round(riskScore),
    complexity: Math.round(baseComplexity),
    innovation: Math.round(innovation),
    costScore: Math.round(costScore),
    readiness: Math.round(readiness),
    predictedDelayDays,
    predictedCompletion: end.toISOString().slice(0, 10),
    health: Math.round(health),
    criticalModuleId: critical?.id ?? null,
    signals,
  };
}

function pickCriticalModule(mods: ProjectModule[]): ProjectModule | null {
  // module with highest downstream weight that isn't done
  const downstream = new Map<string, number>();
  mods.forEach((m) => downstream.set(m.id, 0));
  mods.forEach((m) => m.dependsOn.forEach((d) => downstream.set(d, (downstream.get(d) ?? 0) + 1)));
  let best: ProjectModule | null = null;
  let bestScore = -1;
  for (const m of mods) {
    if (m.status === "done") continue;
    const score = (downstream.get(m.id) ?? 0) * 10 + (100 - m.progress);
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

export function criticalPath(mods: ProjectModule[]): string[] {
  // greedy longest dependency chain among incomplete modules
  const byId = new Map(mods.map((m) => [m.id, m]));
  const memo = new Map<string, string[]>();
  const walk = (id: string): string[] => {
    if (memo.has(id)) return memo.get(id)!;
    const m = byId.get(id);
    if (!m) return [];
    let best: string[] = [];
    for (const dep of m.dependsOn) {
      const path = walk(dep);
      if (path.length > best.length) best = path;
    }
    const out = [...best, id];
    memo.set(id, out);
    return out;
  };
  let longest: string[] = [];
  for (const m of mods) {
    const p = walk(m.id);
    if (p.length > longest.length) longest = p;
  }
  return longest;
}
