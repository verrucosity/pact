export type TaskStatus = "not-started" | "in-progress" | "done" | "skipped";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export type Effort = "quick" | "short" | "medium" | "long";

export type Assignment = "me" | "homie" | "both" | "either";

export type RoleTag = "skilling" | "gp-setup" | "combat-prep" | "scouting";

export interface Requirement {
  type: "item" | "region" | "skill" | "relic" | "pact";
  value: string;
  optional?: boolean;
}

export interface RouteWarning {
  id: string;
  message: string;
  severity: "info" | "warning" | "critical";
  taskIds: string[];
}

export interface RouteTask {
  id: string;
  routeOrder: number;
  title: string;
  objective: string;
  instruction: string;
  why: string;
  required: boolean;
  branchLabel?: string;
  priority: TaskPriority;
  effort: Effort;
  area: string;
  skillTags: string[];
  tags: string[];
  roleTags: RoleTag[];
  relicRelevance: string[];
  pactRelevance: string[];
  itemRequirements: string[];
  dependencies: string[];
  followUps: string[];
  requirements: Requirement[];
  warnings: string[];
  pointsEstimate: number;
}

export interface RoutePhase {
  id: string;
  name: string;
  description: string;
  startOrder: number;
  endOrder: number;
  branchHint?: string;
}

export interface RouteBranch {
  id: string;
  name: string;
  description: string;
  relicDependencies: string[];
  optionalTaskIds: string[];
}

export interface LeagueGuide {
  id: string;
  title: string;
  version: string;
  source: string;
  sourceUrl: string;
  metadata: {
    estimatedPoints: number;
    estimatedTasks: number;
    author: string;
    assumptions: string[];
  };
  phases: RoutePhase[];
  tasks: RouteTask[];
  branches: RouteBranch[];
  warnings: RouteWarning[];
}

export interface TaskRuntimeState {
  status: TaskStatus;
  pinned: boolean;
  assignment: Assignment;
  note: string;
  blockedReason: string;
  doneOnBoth: boolean;
}

export interface Reminder {
  id: string;
  text: string;
  urgent: boolean;
}

export interface CustomTaskInput {
  title: string;
  objective: string;
  area: string;
  tags: string[];
  required: boolean;
}

export interface BuildPlannerState {
  chosenRelics: string[];
  chosenPacts: string[];
  unlockedRegions: string[];
  unlockedEchoBosses: string[];
  pactResetsUsed: number;
  buildNotes: string;
  branchNotes: string;
  manualPoints: number;
}

export interface RunProfile {
  id: string;
  name: string;
  mode: "solo" | "duo" | "custom";
  createdAt: number;
  updatedAt: number;
  compactMode: boolean;
  globalNotes: string;
  meNote: string;
  homieNote: string;
  elapsedMs: number;
  timerRunning: boolean;
  timerLastStartedAt?: number;
  taskState: Record<string, TaskRuntimeState>;
  reminders: Reminder[];
  customTasks: RouteTask[];
  planner: BuildPlannerState;
}

export interface AppState {
  guideId: string;
  profiles: RunProfile[];
  activeProfileId: string;
}
