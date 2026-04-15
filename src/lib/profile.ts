import { AppState, Assignment, LeagueGuide, RunProfile, TaskRuntimeState } from "@/lib/types";

export const STORAGE_KEY = "league-demonic-pacts-v1";

function buildTaskState(guide: LeagueGuide): Record<string, TaskRuntimeState> {
  const state: Record<string, TaskRuntimeState> = {};

  for (const task of guide.tasks) {
    state[task.id] = {
      status: "not-started",
      pinned: false,
      assignment: "either",
      note: "",
      blockedReason: "",
      doneOnBoth: false,
    };
  }

  return state;
}

export function createProfile(guide: LeagueGuide, name: string, mode: RunProfile["mode"]): RunProfile {
  const timestamp = Date.now();
  return {
    id: `profile-${timestamp}-${Math.random().toString(16).slice(2, 8)}`,
    name,
    mode,
    createdAt: timestamp,
    updatedAt: timestamp,
    compactMode: false,
    globalNotes: "",
    meNote: "",
    homieNote: "",
    elapsedMs: 0,
    timerRunning: false,
    taskState: buildTaskState(guide),
    reminders: [],
    customTasks: [],
    planner: {
      chosenRelics: [],
      chosenPacts: [],
      unlockedRegions: ["Varlamore"],
      unlockedEchoBosses: [],
      pactResetsUsed: 0,
      buildNotes: "",
      branchNotes: "",
      manualPoints: 0,
    },
  };
}

export function createInitialState(guide: LeagueGuide): AppState {
  const starter = createProfile(guide, "Main Run", "solo");
  return {
    guideId: guide.id,
    profiles: [starter],
    activeProfileId: starter.id,
  };
}

export function normalizeImportedState(guide: LeagueGuide, parsed: unknown): AppState | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const appState = parsed as Partial<AppState>;
  if (!Array.isArray(appState.profiles) || typeof appState.activeProfileId !== "string") {
    return null;
  }

  const fallback = createInitialState(guide);
  const mergedProfiles = appState.profiles
    .map((profile) => {
      const candidate = profile as Partial<RunProfile>;
      if (!candidate || typeof candidate !== "object" || typeof candidate.id !== "string") {
        return null;
      }

      return {
        ...fallback.profiles[0],
        ...candidate,
        taskState: {
          ...fallback.profiles[0].taskState,
          ...(candidate.taskState ?? {}),
        },
      } satisfies RunProfile;
    })
    .filter((profile): profile is RunProfile => profile !== null);

  if (mergedProfiles.length === 0) {
    return fallback;
  }

  const active = mergedProfiles.some((profile) => profile.id === appState.activeProfileId)
    ? appState.activeProfileId
    : mergedProfiles[0].id;

  return {
    guideId: typeof appState.guideId === "string" ? appState.guideId : guide.id,
    profiles: mergedProfiles,
    activeProfileId: active,
  };
}

export function setAssignmentForMany(
  profile: RunProfile,
  taskIds: string[],
  assignment: Assignment,
): RunProfile {
  const nextTaskState = { ...profile.taskState };
  for (const taskId of taskIds) {
    const current = nextTaskState[taskId];
    if (!current) {
      continue;
    }
    nextTaskState[taskId] = { ...current, assignment };
  }

  return {
    ...profile,
    updatedAt: Date.now(),
    taskState: nextTaskState,
  };
}
