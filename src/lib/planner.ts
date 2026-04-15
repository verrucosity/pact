import { LeagueGuide, RouteTask, RunProfile, TaskRuntimeState, TaskStatus } from "@/lib/types";

export interface TaskFilters {
  showCompleted: boolean;
  showOptional: boolean;
  region: string;
  skill: string;
  relic: string;
  search: string;
  focusTag: "all" | "combat" | "non-combat" | "money-making" | "travel";
}

export type SortMode = "route-order" | "priority" | "area" | "shortest-next";

const STATUS_WEIGHT: Record<TaskStatus, number> = {
  "not-started": 0,
  "in-progress": 1,
  done: 2,
  skipped: 3,
};

const PRIORITY_WEIGHT: Record<RouteTask["priority"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const EFFORT_WEIGHT: Record<RouteTask["effort"], number> = {
  quick: 1,
  short: 2,
  medium: 3,
  long: 4,
};

export function isTaskAvailable(task: RouteTask, profile: RunProfile): boolean {
  return task.dependencies.every((dependencyId) => {
    const state = profile.taskState[dependencyId];
    return state && (state.status === "done" || state.status === "skipped");
  });
}

export function findTaskState(profile: RunProfile, taskId: string): TaskRuntimeState {
  return (
    profile.taskState[taskId] ?? {
      status: "not-started",
      pinned: false,
      assignment: "either",
      note: "",
      blockedReason: "",
      doneOnBoth: false,
    }
  );
}

export function filterTasks(guide: LeagueGuide, profile: RunProfile, filters: TaskFilters): RouteTask[] {
  return [...guide.tasks, ...profile.customTasks].filter((task) => {
    const state = findTaskState(profile, task.id);

    if (!filters.showCompleted && state.status === "done") {
      return false;
    }
    if (!filters.showOptional && !task.required) {
      return false;
    }
    if (filters.region !== "all" && task.area !== filters.region) {
      return false;
    }
    if (filters.skill !== "all" && !task.skillTags.includes(filters.skill)) {
      return false;
    }
    if (filters.relic !== "all" && !task.relicRelevance.includes(filters.relic)) {
      return false;
    }
    if (filters.focusTag !== "all" && !task.tags.includes(filters.focusTag)) {
      return false;
    }

    const query = filters.search.trim().toLowerCase();
    if (query.length > 0) {
      const haystack = [
        task.title,
        task.objective,
        task.instruction,
        task.area,
        task.tags.join(" "),
        task.skillTags.join(" "),
        task.itemRequirements.join(" "),
        task.why,
        state.note,
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

export function sortTasks(tasks: RouteTask[], profile: RunProfile, mode: SortMode): RouteTask[] {
  const cloned = [...tasks];

  if (mode === "route-order") {
    return cloned.sort((a, b) => a.routeOrder - b.routeOrder);
  }

  if (mode === "priority") {
    return cloned.sort((a, b) => {
      const priorityDelta = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return a.routeOrder - b.routeOrder;
    });
  }

  if (mode === "area") {
    return cloned.sort((a, b) => {
      const byArea = a.area.localeCompare(b.area);
      if (byArea !== 0) {
        return byArea;
      }
      return a.routeOrder - b.routeOrder;
    });
  }

  return cloned.sort((a, b) => {
    const aState = findTaskState(profile, a.id);
    const bState = findTaskState(profile, b.id);

    const aBlocked = isTaskAvailable(a, profile) ? 0 : 1;
    const bBlocked = isTaskAvailable(b, profile) ? 0 : 1;
    if (aBlocked !== bBlocked) {
      return aBlocked - bBlocked;
    }

    const statusDelta = STATUS_WEIGHT[aState.status] - STATUS_WEIGHT[bState.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }

    const effortDelta = EFFORT_WEIGHT[a.effort] - EFFORT_WEIGHT[b.effort];
    if (effortDelta !== 0) {
      return effortDelta;
    }

    return a.routeOrder - b.routeOrder;
  });
}

export function getNextBestTasks(guide: LeagueGuide, profile: RunProfile, count = 5): RouteTask[] {
  const candidates = [...guide.tasks, ...profile.customTasks].filter((task) => {
    const state = findTaskState(profile, task.id);
    return state.status !== "done" && state.status !== "skipped";
  });

  return candidates
    .sort((a, b) => {
      const aAvailable = isTaskAvailable(a, profile) ? 1 : 0;
      const bAvailable = isTaskAvailable(b, profile) ? 1 : 0;
      if (aAvailable !== bAvailable) {
        return bAvailable - aAvailable;
      }

      const priorityDelta = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const effortDelta = EFFORT_WEIGHT[a.effort] - EFFORT_WEIGHT[b.effort];
      if (effortDelta !== 0) {
        return effortDelta;
      }

      return a.routeOrder - b.routeOrder;
    })
    .slice(0, count);
}

export function getCurrentPhase(guide: LeagueGuide, profile: RunProfile): string {
  const ordered = [...guide.tasks].sort((a, b) => a.routeOrder - b.routeOrder);
  const firstPending = ordered.find((task) => {
    const state = findTaskState(profile, task.id);
    return state.status !== "done" && state.status !== "skipped";
  });

  if (!firstPending) {
    return "Route Complete";
  }

  const phase = guide.phases.find(
    (candidate) => firstPending.routeOrder >= candidate.startOrder && firstPending.routeOrder <= candidate.endOrder,
  );

  return phase?.name ?? "Uncategorized";
}

export function getProgressMetrics(guide: LeagueGuide, profile: RunProfile) {
  const allTasks = [...guide.tasks, ...profile.customTasks];
  const done = allTasks.filter((task) => findTaskState(profile, task.id).status === "done").length;
  const skippedOptional = allTasks.filter((task) => {
    const state = findTaskState(profile, task.id);
    return !task.required && state.status === "skipped";
  }).length;
  const inProgress = allTasks.filter((task) => findTaskState(profile, task.id).status === "in-progress").length;
  const pinned = allTasks.filter((task) => findTaskState(profile, task.id).pinned).length;

  const remaining = allTasks.length - done - skippedOptional;
  const completion = allTasks.length === 0 ? 0 : Math.round((done / allTasks.length) * 100);

  return {
    done,
    inProgress,
    remaining,
    skippedOptional,
    pinned,
    total: allTasks.length,
    completion,
  };
}
