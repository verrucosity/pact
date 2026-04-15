import { LeagueGuide, Requirement, RoleTag, RouteBranch, RoutePhase, RouteTask, RouteWarning } from "@/lib/types";

const PHASES: RoutePhase[] = [
  {
    id: "phase-varlamore-rush",
    name: "Early Varlamore Rush",
    description: "Fast tutorial completion, coin-sensitive setup, and core utility unlocks in Varlamore.",
    startOrder: 1,
    endOrder: 45,
  },
  {
    id: "phase-aldarin-gp",
    name: "Aldarin Money-Making",
    description: "Vineyard helper and gem-cutting GP burst to fund route momentum.",
    startOrder: 46,
    endOrder: 60,
  },
  {
    id: "phase-sunset-civitas-setup",
    name: "Sunset Coast and Civitas Setup",
    description: "Travel unlocks, early utility tasks, and Civitas setup chain.",
    startOrder: 61,
    endOrder: 97,
  },
  {
    id: "phase-aubernvale-forestry",
    name: "Aubernvale Forestry Branch",
    description: "Forestry and woodcutting-focused branch with Woodsman and Endless Harvest synergies.",
    startOrder: 98,
    endOrder: 125,
    branchHint: "Leans heavily on Woodsman and Endless Harvest choices.",
  },
  {
    id: "phase-tal-kastori",
    name: "Tal Teklan to Kastori",
    description: "Rune purchases, hunter/fishing chains, and mixed combat-skilling progression.",
    startOrder: 126,
    endOrder: 164,
  },
  {
    id: "phase-cam-torum",
    name: "Cam Torum and Mid-Route Prep",
    description: "Rune restock, pickaxe progression, and task-ready gear/loadout setup.",
    startOrder: 165,
    endOrder: 183,
  },
  {
    id: "phase-civitas-grind",
    name: "Civitas Resource Grind",
    description: "Dense objective chain across farming, combat, mining, smithing, and thieving.",
    startOrder: 184,
    endOrder: 221,
  },
  {
    id: "phase-puro-karamja-gate",
    name: "Puro Puro and Karamja Gate",
    description: "Optional hunter-heavy branch into Karamja unlock progression.",
    startOrder: 222,
    endOrder: 240,
  },
  {
    id: "phase-karamja-route",
    name: "Karamja Unlock Path",
    description: "Brimhaven, Shilo, TzHaar, and cleanup sequence toward route completion.",
    startOrder: 241,
    endOrder: 279,
  },
  {
    id: "phase-post-route",
    name: "Post-Route Suggestions",
    description: "Downtime tasks, prayer goals, and hunter contract optimization notes.",
    startOrder: 280,
    endOrder: 400,
  },
];

const REGION_KEYWORDS: Array<[string, string]> = [
  ["varlamore", "Varlamore"],
  ["aldarin", "Aldarin"],
  ["sunset coast", "Sunset Coast"],
  ["civitas", "Civitas Illa Fortis"],
  ["aubernvale", "Aubernvale"],
  ["tal teklan", "Tal Teklan"],
  ["kastori", "Kastori"],
  ["cam torum", "Cam Torum"],
  ["zanaris", "Zanaris"],
  ["karamja", "Karamja"],
  ["brimhaven", "Karamja"],
  ["shilo", "Karamja"],
  ["puro puro", "Puro Puro"],
  ["gloomthorn", "Gloomthorn"],
  ["yama", "Yama's Lair"],
  ["quetzacalli", "Quetzacalli Gorge"],
];

const SKILL_KEYWORDS: Array<[string, string]> = [
  ["thiev", "Thieving"],
  ["craft", "Crafting"],
  ["fish", "Fishing"],
  ["cook", "Cooking"],
  ["wood", "Woodcutting"],
  ["fletch", "Fletching"],
  ["fire", "Firemaking"],
  ["mine", "Mining"],
  ["smith", "Smithing"],
  ["herb", "Herblore"],
  ["hunter", "Hunter"],
  ["slayer", "Slayer"],
  ["magic", "Magic"],
  ["rune", "Runecraft"],
  ["agil", "Agility"],
  ["prayer", "Prayer"],
  ["farming", "Farming"],
  ["construction", "Construction"],
  ["attack", "Attack"],
  ["defence", "Defence"],
];

function normalizeText(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function inferArea(text: string, order: number): string {
  const lower = text.toLowerCase();
  for (const [keyword, area] of REGION_KEYWORDS) {
    if (lower.includes(keyword)) {
      return area;
    }
  }

  const phase = PHASES.find((candidate) => order >= candidate.startOrder && order <= candidate.endOrder);
  return phase?.name ?? "General";
}

function inferTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags = new Set<string>();

  if (/(tele|travel|run |rowboat|charter|fairy ring|quetzal|home teleport)/.test(lower)) {
    tags.add("travel");
  }
  if (/(buy |sell |gp|coins|money making|profit|alch)/.test(lower)) {
    tags.add("money-making");
  }
  if (/(kill|defeat|attack|safespot|boss|dungeon)/.test(lower)) {
    tags.add("combat");
  }
  if (!(tags.has("combat")) && /(pick|chop|fish|craft|fletch|cook|mine|smith|thieve|rake)/.test(lower)) {
    tags.add("non-combat");
  }
  if (/(optional|skip|can skip|if you want)/.test(lower)) {
    tags.add("optional");
  }
  if (/(warning|don't|do not|intentional|be smart|only)/.test(lower)) {
    tags.add("warning");
  }
  if (/(woodsman|endless harvest|relic|pact)/.test(lower)) {
    tags.add("relic-relevant");
  }

  return Array.from(tags);
}

function inferSkillTags(text: string): string[] {
  const lower = text.toLowerCase();
  const skills = new Set<string>();
  for (const [keyword, skill] of SKILL_KEYWORDS) {
    if (lower.includes(keyword)) {
      skills.add(skill);
    }
  }
  return Array.from(skills);
}

function inferRoleTags(tags: string[], skillTags: string[]): RoleTag[] {
  const roles = new Set<RoleTag>();

  if (tags.includes("combat")) {
    roles.add("combat-prep");
  }
  if (tags.includes("money-making")) {
    roles.add("gp-setup");
  }
  if (tags.includes("travel")) {
    roles.add("scouting");
  }
  if (skillTags.length > 0) {
    roles.add("skilling");
  }

  return Array.from(roles);
}

function inferRelicRelevance(text: string): string[] {
  const lower = text.toLowerCase();
  const relevant: string[] = [];

  if (lower.includes("endless harvest") || lower.includes("eh")) {
    relevant.push("Endless Harvest");
  }
  if (lower.includes("woodsman")) {
    relevant.push("Woodsman");
  }
  if (lower.includes("magic pact") || lower.includes("pact")) {
    relevant.push("Magic Pact Interaction");
  }

  return relevant;
}

function inferPactRelevance(text: string): string[] {
  const lower = text.toLowerCase();
  const values: string[] = [];
  if (lower.includes("demonic pact")) {
    values.push("Demonic Pact Point");
  }
  if (lower.includes("magic pact")) {
    values.push("First Magic Pact");
  }
  if (lower.includes("echo boss") || lower.includes("reset")) {
    values.push("Pact Reset Economy");
  }
  return values;
}

function inferPriority(tags: string[], text: string): RouteTask["priority"] {
  const lower = text.toLowerCase();
  if (tags.includes("warning") || lower.includes("do not") || lower.includes("intentional")) {
    return "critical";
  }
  if (tags.includes("money-making") || tags.includes("travel")) {
    return "high";
  }
  if (tags.includes("optional")) {
    return "low";
  }
  return "medium";
}

function inferEffort(text: string): RouteTask["effort"] {
  const lower = text.toLowerCase();
  if (/(until|stay|50 |75 |100 |150 |1000 |70 crafting|to 36)/.test(lower)) {
    return "long";
  }
  if (/(10 |15 |20 |25 |50)/.test(lower)) {
    return "medium";
  }
  if (/(run|go|buy|equip|deposit|withdraw)/.test(lower)) {
    return "short";
  }
  return "quick";
}

function inferItemRequirements(text: string): string[] {
  const cleaned = text.replace(/\(.*?\)/g, "");
  const match = cleaned.match(/(?:buy|withdraw|equip|keep|bring)\s+(.+)/i);
  if (!match) {
    return [];
  }

  return match[1]
    .split(/,| and /i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, 6);
}

function inferRequirements(task: RouteTask): Requirement[] {
  const requirements: Requirement[] = [];

  for (const item of task.itemRequirements) {
    requirements.push({ type: "item", value: item });
  }

  if (task.area === "Karamja") {
    requirements.push({ type: "region", value: "Karamja" });
  }

  for (const relic of task.relicRelevance) {
    requirements.push({ type: "relic", value: relic, optional: true });
  }

  for (const pact of task.pactRelevance) {
    requirements.push({ type: "pact", value: pact, optional: true });
  }

  return requirements;
}

function inferWhy(task: RouteTask): string {
  if (task.tags.includes("money-making")) {
    return "Funds early unlocks, runes, and planned shop purchases without stalling the route.";
  }
  if (task.tags.includes("travel")) {
    return "Improves route tempo by reducing movement downtime between objective clusters.";
  }
  if (task.tags.includes("combat")) {
    return "Secures combat-locked points and progression gates needed for later route flexibility.";
  }
  if (task.tags.includes("optional")) {
    return "Optional branch objective that can be deferred if your build path differs from Faux assumptions.";
  }
  return "Advances core route progression and maintains the intended task/point pacing.";
}

function inferBranchLabel(task: RouteTask): string | undefined {
  const lower = task.instruction.toLowerCase();
  if (lower.includes("woodsman") || lower.includes("endless harvest") || lower.includes("if not woodsman")) {
    return "Woodsman / Endless Harvest";
  }
  if (lower.includes("magic pact")) {
    return "Magic Pact Conditional";
  }
  return undefined;
}

function inferPointsEstimate(task: RouteTask): number {
  if (task.priority === "critical") {
    return 30;
  }
  if (task.priority === "high") {
    return 20;
  }
  if (task.priority === "low") {
    return 10;
  }
  return 15;
}

function createWarnings(tasks: RouteTask[]): RouteWarning[] {
  const warnings: RouteWarning[] = [];

  const explicitWarningTasks = tasks.filter((task) => task.tags.includes("warning"));
  if (explicitWarningTasks.length > 0) {
    warnings.push({
      id: "warn-coin-sensitive",
      message:
        "Coin-sensitive steps are intentional. Buying or selling wrong quantities can desync progression and GP breakpoints.",
      severity: "critical",
      taskIds: explicitWarningTasks.map((task) => task.id),
    });
  }

  const branchTasks = tasks.filter((task) => task.branchLabel);
  if (branchTasks.length > 0) {
    warnings.push({
      id: "warn-relic-branch",
      message:
        "Some objectives assume Woodsman or Endless Harvest. If your relics differ, skip safely and continue with branch-aware recommendations.",
      severity: "warning",
      taskIds: branchTasks.map((task) => task.id),
    });
  }

  return warnings;
}

function createBranches(tasks: RouteTask[]): RouteBranch[] {
  const woodsmanTaskIds = tasks
    .filter((task) => task.branchLabel === "Woodsman / Endless Harvest")
    .map((task) => task.id);

  const magicPactTaskIds = tasks
    .filter((task) => task.branchLabel === "Magic Pact Conditional")
    .map((task) => task.id);

  return [
    {
      id: "branch-woodsman-eh",
      name: "Woodsman / Endless Harvest Branch",
      description: "Optional skilling-heavy sequence optimized for Woodsman and Endless Harvest relic assumptions.",
      relicDependencies: ["Woodsman", "Endless Harvest"],
      optionalTaskIds: woodsmanTaskIds,
    },
    {
      id: "branch-magic-pact-boost",
      name: "Magic Pact Boost Branch",
      description: "Optional magic-level boost path tied to first magic pact timing and reset economy.",
      relicDependencies: ["First Magic Pact"],
      optionalTaskIds: magicPactTaskIds,
    },
  ];
}

export function parseFauxGuide(rawText: string): LeagueGuide {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter((line) => line.length > 0);

  const assumptions: string[] = [];
  const bulletLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("-")) {
      bulletLines.push(line.slice(1).trim());
      continue;
    }

    if (
      line.toLowerCase().includes("guide leans") ||
      line.toLowerCase().includes("don't buy more") ||
      line.toLowerCase().includes("my relics")
    ) {
      assumptions.push(line);
    }
  }

  const tasks: RouteTask[] = bulletLines.map((instruction, index): RouteTask => {
    const routeOrder = index + 1;
    const id = `faux-task-${routeOrder.toString().padStart(3, "0")}`;
    const tags = inferTags(instruction);
    const skillTags = inferSkillTags(instruction);
    const roleTags = inferRoleTags(tags, skillTags);
    const area = inferArea(instruction, routeOrder);
    const relicRelevance = inferRelicRelevance(instruction);
    const pactRelevance = inferPactRelevance(instruction);
    const itemRequirements = inferItemRequirements(instruction);

    const task: RouteTask = {
      id,
      routeOrder,
      title: instruction.length > 72 ? `${instruction.slice(0, 69)}...` : instruction,
      objective: instruction,
      instruction,
      why: "",
      required: !tags.includes("optional"),
      priority: inferPriority(tags, instruction),
      effort: inferEffort(instruction),
      area,
      skillTags,
      tags,
      roleTags,
      relicRelevance,
      pactRelevance,
      itemRequirements,
      dependencies: routeOrder > 1 ? [`faux-task-${(routeOrder - 1).toString().padStart(3, "0")}`] : [],
      followUps: [],
      requirements: [],
      warnings: tags.includes("warning") ? ["Review exact quantity or condition before completing this step."] : [],
      pointsEstimate: 0,
    };

    task.branchLabel = inferBranchLabel(task);
    task.why = inferWhy(task);
    task.requirements = inferRequirements(task);
    task.pointsEstimate = inferPointsEstimate(task);

    return task;
  });

  for (let index = 0; index < tasks.length - 1; index += 1) {
    tasks[index].followUps.push(tasks[index + 1].id);
  }

  const warnings = createWarnings(tasks);
  const branches = createBranches(tasks);

  return {
    id: "faux-demonic-pact-v1",
    title: "Faux's Demonic Pact League Guide",
    version: "1.0.0",
    source: "Pastebin",
    sourceUrl: "https://pastebin.com/bG3SfLUw",
    metadata: {
      estimatedPoints: 3300,
      estimatedTasks: 181,
      author: "Faux",
      assumptions,
    },
    phases: PHASES,
    tasks,
    branches,
    warnings,
  };
}
