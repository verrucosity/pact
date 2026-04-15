"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createInitialState, createProfile, normalizeImportedState, STORAGE_KEY } from "@/lib/profile";
import {
  filterTasks,
  findTaskState,
  getCurrentPhase,
  getNextBestTasks,
  getProgressMetrics,
  isTaskAvailable,
  sortTasks,
  SortMode,
  TaskFilters,
} from "@/lib/planner";
import { AppState, Assignment, LeagueGuide, RouteTask, RunProfile, TaskStatus } from "@/lib/types";

type Props = {
  guide: LeagueGuide;
};

type TaskViewMode = "focused" | "by-phase" | "full";

const STATUS_OPTIONS: TaskStatus[] = ["not-started", "in-progress", "done", "skipped"];
const ASSIGNMENT_OPTIONS: Assignment[] = ["either", "me", "homie", "both"];

const RELIC_OPTIONS = [
  "Woodsman",
  "Endless Harvest",
  "Corner Cutter",
  "Banker's Note",
  "Treasure Arbiter",
  "Golden God",
  "Reloaded",
  "Grimoire",
  "Overgrown",
  "Pocket Kingdom",
];

const PACT_OPTIONS = [
  "Wrath",
  "Envy",
  "Decay",
  "Gluttony",
  "Slumber",
  "Hubris",
  "Honor",
  "Lies",
  "First Magic Pact",
];

const REGION_OPTIONS = ["Varlamore", "Karamja", "Morytania", "Kharidian Desert", "Asgarnia", "Fremennik", "Kandarin"];

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((totalSec % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function badgeTone(priority: RouteTask["priority"]): string {
  switch (priority) {
    case "critical":
      return "bg-red-500/20 text-red-200 border-red-400/40";
    case "high":
      return "bg-amber-400/20 text-amber-100 border-amber-300/40";
    case "medium":
      return "bg-sky-400/20 text-sky-100 border-sky-300/40";
    default:
      return "bg-slate-500/20 text-slate-200 border-slate-400/40";
  }
}

export default function LeagueCompanion({ guide }: Props) {
  const [appState, setAppState] = useState<AppState>(() => {
    const fallback = createInitialState(guide);
    if (typeof window === "undefined") {
      return fallback;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      return normalizeImportedState(guide, parsed) ?? fallback;
    } catch {
      return fallback;
    }
  });

  const [filters, setFilters] = useState<TaskFilters>({
    showCompleted: true,
    showOptional: true,
    region: "all",
    skill: "all",
    relic: "all",
    search: "",
    focusTag: "all",
  });
  const [sortMode, setSortMode] = useState<SortMode>("shortest-next");
  const [showPalette, setShowPalette] = useState(false);
  const [newReminderText, setNewReminderText] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customObjective, setCustomObjective] = useState("");
  const [customArea, setCustomArea] = useState("General");
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>("focused");
  const [focusedCount, setFocusedCount] = useState(20);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeProfile = useMemo(() => {
    return appState.profiles.find((profile) => profile.id === appState.activeProfileId) ?? appState.profiles[0];
  }, [appState.activeProfileId, appState.profiles]);

  const updateProfile = useCallback((mutator: (profile: RunProfile) => RunProfile) => {
    setAppState((current) => ({
      ...current,
      profiles: current.profiles.map((profile) =>
        profile.id === current.activeProfileId ? { ...mutator(profile), updatedAt: Date.now() } : profile,
      ),
    }));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  }, [appState]);

  useEffect(() => {
    if (!activeProfile?.timerRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setAppState((current) => {
        const profile = current.profiles.find((candidate) => candidate.id === current.activeProfileId);
        if (!profile || !profile.timerRunning || !profile.timerLastStartedAt) {
          return current;
        }

        return {
          ...current,
          profiles: current.profiles.map((candidate) => {
            if (candidate.id !== profile.id) {
              return candidate;
            }
            return {
              ...candidate,
              elapsedMs: candidate.elapsedMs + 1000,
              timerLastStartedAt: Date.now(),
              updatedAt: Date.now(),
            };
          }),
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeProfile?.timerRunning]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowPalette((current) => !current);
        return;
      }

      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const activeTag = (event.target as HTMLElement | null)?.tagName;
        if (activeTag !== "INPUT" && activeTag !== "TEXTAREA") {
          event.preventDefault();
          searchRef.current?.focus();
        }
      }

      if (event.key.toLowerCase() === "c" && event.altKey) {
        event.preventDefault();
        updateProfile((profile) => ({ ...profile, compactMode: !profile.compactMode, updatedAt: Date.now() }));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeProfile, updateProfile]);

  const filteredTasks = useMemo(() => {
    if (!activeProfile) {
      return [];
    }
    return sortTasks(filterTasks(guide, activeProfile, filters), activeProfile, sortMode);
  }, [activeProfile, filters, guide, sortMode]);

  const tasksByPhase = useMemo(() => {
    const buckets = guide.phases.map((phase) => ({
      id: phase.id,
      label: phase.name,
      start: phase.startOrder,
      end: phase.endOrder,
      tasks: [] as RouteTask[],
    }));
    const customBucket = { id: "phase-custom", label: "Custom and Unphased", tasks: [] as RouteTask[] };

    for (const task of filteredTasks) {
      const phaseBucket = buckets.find(
        (candidate) => task.routeOrder >= candidate.start && task.routeOrder <= candidate.end,
      );
      if (phaseBucket) {
        phaseBucket.tasks.push(task);
      } else {
        customBucket.tasks.push(task);
      }
    }

    const visible = buckets
      .map((bucket) => ({ id: bucket.id, label: bucket.label, tasks: bucket.tasks }))
      .filter((bucket) => bucket.tasks.length > 0);

    if (customBucket.tasks.length > 0) {
      visible.push(customBucket);
    }

    return visible;
  }, [filteredTasks, guide.phases]);

  const focusedTasks = useMemo(() => {
    if (!activeProfile) {
      return [];
    }

    const nextIndex = filteredTasks.findIndex((task) => {
      const state = findTaskState(activeProfile, task.id);
      return state.status !== "done" && state.status !== "skipped";
    });

    if (nextIndex < 0) {
      return filteredTasks.slice(0, focusedCount);
    }

    const start = Math.max(0, nextIndex - 3);
    const end = Math.min(filteredTasks.length, start + focusedCount);
    return filteredTasks.slice(start, end);
  }, [activeProfile, filteredTasks, focusedCount]);

  const nextBest = useMemo(() => {
    if (!activeProfile) {
      return [];
    }
    return getNextBestTasks(guide, activeProfile, 6);
  }, [activeProfile, guide]);

  const metrics = useMemo(() => {
    if (!activeProfile) {
      return {
        done: 0,
        inProgress: 0,
        remaining: 0,
        skippedOptional: 0,
        pinned: 0,
        total: 0,
        completion: 0,
      };
    }
    return getProgressMetrics(guide, activeProfile);
  }, [activeProfile, guide]);

  const skillOptions = useMemo(() => {
    const set = new Set<string>();
    for (const task of guide.tasks) {
      for (const skill of task.skillTags) {
        set.add(skill);
      }
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [guide.tasks]);

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const task of guide.tasks) {
      set.add(task.area);
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [guide.tasks]);

  function setTaskStatus(taskId: string, status: TaskStatus) {
    updateProfile((profile) => ({
      ...profile,
      taskState: {
        ...profile.taskState,
        [taskId]: { ...findTaskState(profile, taskId), status },
      },
    }));
  }

  function setTaskAssignment(taskId: string, assignment: Assignment) {
    updateProfile((profile) => ({
      ...profile,
      taskState: {
        ...profile.taskState,
        [taskId]: { ...findTaskState(profile, taskId), assignment },
      },
    }));
  }

  function togglePinned(taskId: string) {
    updateProfile((profile) => ({
      ...profile,
      taskState: {
        ...profile.taskState,
        [taskId]: { ...findTaskState(profile, taskId), pinned: !findTaskState(profile, taskId).pinned },
      },
    }));
  }

  function setTaskNote(taskId: string, note: string) {
    updateProfile((profile) => ({
      ...profile,
      taskState: {
        ...profile.taskState,
        [taskId]: { ...findTaskState(profile, taskId), note },
      },
    }));
  }

  function addReminder() {
    const text = newReminderText.trim();
    if (!text) {
      return;
    }

    updateProfile((profile) => ({
      ...profile,
      reminders: [
        ...profile.reminders,
        {
          id: `reminder-${Date.now()}`,
          text,
          urgent: /urgent|important|now|warning/i.test(text),
        },
      ],
    }));
    setNewReminderText("");
  }

  function removeReminder(reminderId: string) {
    updateProfile((profile) => ({
      ...profile,
      reminders: profile.reminders.filter((item) => item.id !== reminderId),
    }));
  }

  function addCustomTask() {
    const title = customTitle.trim();
    const objective = customObjective.trim();
    if (!title || !objective) {
      return;
    }

    updateProfile((profile) => {
      const routeOrder = guide.tasks.length + profile.customTasks.length + 1;
      const customTask: RouteTask = {
        id: `custom-${Date.now()}`,
        routeOrder,
        title,
        objective,
        instruction: objective,
        why: "Player-authored objective to track personal route variations.",
        required: false,
        priority: "medium",
        effort: "short",
        area: customArea.trim() || "General",
        skillTags: [],
        tags: ["custom"],
        roleTags: ["skilling"],
        relicRelevance: [],
        pactRelevance: [],
        itemRequirements: [],
        dependencies: [],
        followUps: [],
        requirements: [],
        warnings: [],
        pointsEstimate: 0,
      };

      return {
        ...profile,
        customTasks: [...profile.customTasks, customTask],
        taskState: {
          ...profile.taskState,
          [customTask.id]: {
            status: "not-started",
            pinned: false,
            assignment: "either",
            note: "",
            blockedReason: "",
            doneOnBoth: false,
          },
        },
      };
    });

    setCustomTitle("");
    setCustomObjective("");
  }

  function createNewProfile(mode: RunProfile["mode"]) {
    const nameBase = mode === "duo" ? "Duo Route" : mode === "custom" ? "Custom Run" : "Solo Route";
    const profile = createProfile(guide, `${nameBase} ${appState.profiles.length + 1}`, mode);

    setAppState((current) => ({
      ...current,
      activeProfileId: profile.id,
      profiles: [...current.profiles, profile],
    }));
  }

  function duplicateProfile() {
    if (!activeProfile) {
      return;
    }

    const clone: RunProfile = {
      ...activeProfile,
      id: `profile-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: `${activeProfile.name} Copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      taskState: { ...activeProfile.taskState },
      reminders: [...activeProfile.reminders],
      customTasks: [...activeProfile.customTasks],
      planner: { ...activeProfile.planner },
    };

    setAppState((current) => ({
      ...current,
      activeProfileId: clone.id,
      profiles: [...current.profiles, clone],
    }));
  }

  function deleteActiveProfile() {
    if (!activeProfile || appState.profiles.length <= 1) {
      return;
    }

    const remaining = appState.profiles.filter((profile) => profile.id !== activeProfile.id);
    setAppState((current) => ({
      ...current,
      profiles: remaining,
      activeProfileId: remaining[0].id,
    }));
  }

  function exportProfiles() {
    const payload = JSON.stringify(appState, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `league-profile-export-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importProfiles(text: string) {
    try {
      const parsed = JSON.parse(text) as unknown;
      const normalized = normalizeImportedState(guide, parsed);
      if (normalized) {
        setAppState(normalized);
      }
    } catch {
      // Ignore malformed files so users can try again.
    }
  }

  function onImportSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        importProfiles(reader.result);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  if (!activeProfile) {
    return <div className="p-6">Loading profile...</div>;
  }

  const currentPhase = getCurrentPhase(guide, activeProfile);
  const timerLabel = formatDuration(activeProfile.elapsedMs);

  function renderTaskCard(task: RouteTask) {
    const state = findTaskState(activeProfile, task.id);
    const available = isTaskAvailable(task, activeProfile);

    if (activeProfile.compactMode && state.status === "done") {
      return null;
    }

    return (
      <article
        key={task.id}
        className={`rounded-xl border p-3 transition ${
          state.status === "done"
            ? "border-emerald-300/35 bg-emerald-300/8"
            : state.pinned
              ? "border-amber-300/45 bg-amber-300/10"
              : "border-stone-100/20 bg-black/35"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-stone-300">#{task.routeOrder} • {task.area}</p>
            <h3 className="text-base font-semibold text-stone-100">{task.title}</h3>
            <p className="text-sm text-stone-300">{task.objective}</p>
          </div>
          <div className={`rounded border px-2 py-1 text-xs ${badgeTone(task.priority)}`}>{task.priority}</div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setTaskStatus(task.id, option)}
              className={`rounded border px-2 py-1 ${
                state.status === option ? "border-amber-200/70 bg-amber-200/20" : "border-stone-300/20 hover:bg-stone-200/10"
              }`}
            >
              {option}
            </button>
          ))}

          <button onClick={() => togglePinned(task.id)} className="rounded border border-stone-300/20 px-2 py-1 hover:bg-stone-200/10">
            {state.pinned ? "Unpin" : "Pin"}
          </button>

          <select
            value={state.assignment}
            onChange={(event) => setTaskAssignment(task.id, event.target.value as Assignment)}
            className="rounded border border-stone-300/20 bg-stone-900/70 px-2 py-1"
          >
            {ASSIGNMENT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2 text-xs text-stone-300">
          <p>{task.why}</p>
          {!available ? <p className="mt-1 text-rose-200">Blocked until dependencies are complete.</p> : null}
        </div>

        <textarea
          value={state.note}
          onChange={(event) => setTaskNote(task.id, event.target.value)}
          placeholder="Task notes, supply checks, duo timing..."
          rows={2}
          className="mt-2 w-full rounded border border-stone-300/20 bg-stone-900/70 px-2 py-1 text-xs"
        />
      </article>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_10%_10%,#5b7f53_0%,rgba(39,53,34,0.55)_32%,rgba(20,22,18,0.95)_75%),radial-gradient(circle_at_90%_20%,rgba(199,137,58,0.24)_0%,rgba(38,30,23,0.15)_30%,transparent_62%)] text-stone-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:100%_28px] opacity-35" />

      <header className="relative border-b border-amber-200/20 bg-black/25 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-100/80">Leagues VI Companion</p>
              <h1 className="font-mono text-2xl font-semibold text-amber-50 sm:text-3xl">Demonic Pacts Route Control Room</h1>
              <p className="mt-1 text-sm text-stone-200/85">{guide.title} • {guide.tasks.length} parsed steps • Current phase: {currentPhase}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowPalette((current) => !current)}
                className="rounded-md border border-amber-200/30 bg-amber-100/10 px-3 py-2 text-xs uppercase tracking-wide text-amber-100 hover:bg-amber-100/20"
              >
                Command Palette (Ctrl+K)
              </button>
              <button
                onClick={exportProfiles}
                className="rounded-md border border-emerald-200/30 bg-emerald-200/15 px-3 py-2 text-xs uppercase tracking-wide text-emerald-100 hover:bg-emerald-200/25"
              >
                Export
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-sky-200/30 bg-sky-200/15 px-3 py-2 text-xs uppercase tracking-wide text-sky-100 hover:bg-sky-200/25"
              >
                Import
              </button>
              <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onImportSelected} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-amber-100/20 bg-black/25 p-3">
              <p className="text-xs uppercase tracking-wider text-amber-100/70">Completion</p>
              <p className="mt-1 font-mono text-2xl text-amber-50">{metrics.completion}%</p>
              <p className="text-xs text-stone-300">{metrics.done}/{metrics.total} done</p>
            </div>
            <div className="rounded-lg border border-sky-100/20 bg-black/25 p-3">
              <p className="text-xs uppercase tracking-wider text-sky-100/70">In Progress</p>
              <p className="mt-1 font-mono text-2xl text-sky-100">{metrics.inProgress}</p>
              <p className="text-xs text-stone-300">Pinned: {metrics.pinned}</p>
            </div>
            <div className="rounded-lg border border-lime-100/20 bg-black/25 p-3">
              <p className="text-xs uppercase tracking-wider text-lime-100/70">Remaining</p>
              <p className="mt-1 font-mono text-2xl text-lime-100">{metrics.remaining}</p>
              <p className="text-xs text-stone-300">Optional skipped: {metrics.skippedOptional}</p>
            </div>
            <div className="rounded-lg border border-rose-100/20 bg-black/25 p-3">
              <p className="text-xs uppercase tracking-wider text-rose-100/70">Run Timer</p>
              <p className="mt-1 font-mono text-2xl text-rose-100">{timerLabel}</p>
              <div className="mt-2 flex gap-2 text-xs">
                <button
                  onClick={() =>
                    updateProfile((profile) => ({
                      ...profile,
                      timerRunning: true,
                      timerLastStartedAt: Date.now(),
                    }))
                  }
                  className="rounded border border-rose-200/40 px-2 py-1 text-rose-100 hover:bg-rose-300/15"
                >
                  Start
                </button>
                <button
                  onClick={() => updateProfile((profile) => ({ ...profile, timerRunning: false, timerLastStartedAt: undefined }))}
                  className="rounded border border-rose-200/40 px-2 py-1 text-rose-100 hover:bg-rose-300/15"
                >
                  Stop
                </button>
                <button
                  onClick={() =>
                    updateProfile((profile) => ({
                      ...profile,
                      elapsedMs: 0,
                      timerRunning: false,
                      timerLastStartedAt: undefined,
                    }))
                  }
                  className="rounded border border-rose-200/40 px-2 py-1 text-rose-100 hover:bg-rose-300/15"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-stone-100/20 bg-black/25 p-3">
              <p className="text-xs uppercase tracking-wider text-stone-100/70">Active Profile</p>
              <select
                className="mt-2 w-full rounded border border-stone-200/20 bg-stone-900/70 px-2 py-1 text-sm"
                value={activeProfile.id}
                onChange={(event) =>
                  setAppState((current) => ({
                    ...current,
                    activeProfileId: event.target.value,
                  }))
                }
              >
                {appState.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({profile.mode})
                  </option>
                ))}
              </select>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button onClick={() => createNewProfile("solo")} className="rounded border border-stone-300/30 px-2 py-1 hover:bg-stone-300/15">
                  + Solo
                </button>
                <button onClick={() => createNewProfile("duo")} className="rounded border border-stone-300/30 px-2 py-1 hover:bg-stone-300/15">
                  + Duo
                </button>
                <button onClick={duplicateProfile} className="rounded border border-stone-300/30 px-2 py-1 hover:bg-stone-300/15">
                  Duplicate
                </button>
                <button
                  onClick={deleteActiveProfile}
                  className="rounded border border-red-300/30 px-2 py-1 text-red-100 hover:bg-red-300/15 disabled:opacity-40"
                  disabled={appState.profiles.length <= 1}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[290px_1fr_320px] lg:px-8">
        <aside className="space-y-4">
          <section className="rounded-xl border border-stone-100/20 bg-black/35 p-4">
            <h2 className="font-mono text-lg text-amber-50">Filters</h2>
            <div className="mt-3 space-y-2 text-sm">
              <input
                ref={searchRef}
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search route... (/)"
                className="w-full rounded border border-stone-300/20 bg-stone-900/70 px-3 py-2"
              />
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="w-full rounded border border-stone-300/20 bg-stone-900/70 px-3 py-2"
              >
                <option value="shortest-next">Sort: Next Best</option>
                <option value="route-order">Sort: Route Order</option>
                <option value="priority">Sort: Priority</option>
                <option value="area">Sort: Area</option>
              </select>
              <select
                value={filters.region}
                onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value }))}
                className="w-full rounded border border-stone-300/20 bg-stone-900/70 px-3 py-2"
              >
                {regionOptions.map((option) => (
                  <option key={option} value={option}>
                    Region: {option}
                  </option>
                ))}
              </select>
              <select
                value={filters.skill}
                onChange={(event) => setFilters((current) => ({ ...current, skill: event.target.value }))}
                className="w-full rounded border border-stone-300/20 bg-stone-900/70 px-3 py-2"
              >
                {skillOptions.map((option) => (
                  <option key={option} value={option}>
                    Skill: {option}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.showCompleted}
                  onChange={(event) => setFilters((current) => ({ ...current, showCompleted: event.target.checked }))}
                />
                Show completed
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.showOptional}
                  onChange={(event) => setFilters((current) => ({ ...current, showOptional: event.target.checked }))}
                />
                Show optional
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-stone-100/20 bg-black/35 p-4">
            <h2 className="font-mono text-lg text-amber-50">Reminders</h2>
            <div className="mt-2 flex gap-2">
              <input
                value={newReminderText}
                onChange={(event) => setNewReminderText(event.target.value)}
                placeholder="Potion prep, rune shop, etc"
                className="w-full rounded border border-stone-300/20 bg-stone-900/70 px-2 py-1 text-sm"
              />
              <button onClick={addReminder} className="rounded border border-stone-300/30 px-2 py-1 text-xs hover:bg-stone-200/15">
                Add
              </button>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {activeProfile.reminders.map((reminder) => (
                <li key={reminder.id} className="rounded border border-stone-300/20 bg-stone-900/40 px-2 py-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className={reminder.urgent ? "text-rose-200" : "text-stone-200"}>{reminder.text}</span>
                    <button className="text-xs text-stone-300" onClick={() => removeReminder(reminder.id)}>
                      x
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-stone-100/20 bg-black/35 p-4">
            <h2 className="font-mono text-lg text-amber-50">Custom Task</h2>
            <div className="mt-2 space-y-2 text-sm">
              <input
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
                placeholder="Title"
                className="w-full rounded border border-stone-300/20 bg-stone-900/70 px-2 py-1"
              />
              <textarea
                value={customObjective}
                onChange={(event) => setCustomObjective(event.target.value)}
                placeholder="Objective"
                rows={3}
                className="w-full rounded border border-stone-300/20 bg-stone-900/70 px-2 py-1"
              />
              <input
                value={customArea}
                onChange={(event) => setCustomArea(event.target.value)}
                placeholder="Area"
                className="w-full rounded border border-stone-300/20 bg-stone-900/70 px-2 py-1"
              />
              <button onClick={addCustomTask} className="w-full rounded border border-amber-200/40 px-2 py-1 hover:bg-amber-100/15">
                Add Task
              </button>
            </div>
          </section>
        </aside>

        <section className="space-y-3 lg:max-h-[calc(100vh-215px)] lg:overflow-y-auto lg:pr-1">
          <div className="rounded-xl border border-stone-100/20 bg-black/35 p-3 text-sm text-stone-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                Showing {filteredTasks.length} tasks. Keyboard: <span className="font-mono">/</span> search, <span className="font-mono">Ctrl+K</span> command palette, <span className="font-mono">Alt+C</span> compact mode.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => setTaskViewMode("focused")}
                  className={`rounded border px-2 py-1 ${taskViewMode === "focused" ? "border-amber-200/70 bg-amber-200/20" : "border-stone-300/20"}`}
                >
                  Focused
                </button>
                <button
                  onClick={() => setTaskViewMode("by-phase")}
                  className={`rounded border px-2 py-1 ${taskViewMode === "by-phase" ? "border-amber-200/70 bg-amber-200/20" : "border-stone-300/20"}`}
                >
                  By Phase
                </button>
                <button
                  onClick={() => setTaskViewMode("full")}
                  className={`rounded border px-2 py-1 ${taskViewMode === "full" ? "border-amber-200/70 bg-amber-200/20" : "border-stone-300/20"}`}
                >
                  Full List
                </button>
              </div>
            </div>

            {taskViewMode === "focused" ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span>Window size:</span>
                <button
                  onClick={() => setFocusedCount(12)}
                  className={`rounded border px-2 py-1 ${focusedCount === 12 ? "border-sky-200/70 bg-sky-200/20" : "border-stone-300/20"}`}
                >
                  12
                </button>
                <button
                  onClick={() => setFocusedCount(20)}
                  className={`rounded border px-2 py-1 ${focusedCount === 20 ? "border-sky-200/70 bg-sky-200/20" : "border-stone-300/20"}`}
                >
                  20
                </button>
                <button
                  onClick={() => setFocusedCount(30)}
                  className={`rounded border px-2 py-1 ${focusedCount === 30 ? "border-sky-200/70 bg-sky-200/20" : "border-stone-300/20"}`}
                >
                  30
                </button>
              </div>
            ) : null}
          </div>

          {taskViewMode === "focused" ? focusedTasks.map((task) => renderTaskCard(task)) : null}

          {taskViewMode === "full" ? filteredTasks.map((task) => renderTaskCard(task)) : null}

          {taskViewMode === "by-phase"
            ? tasksByPhase.map((phase) => {
                const phaseDone = phase.tasks.filter((task) => {
                  const state = findTaskState(activeProfile, task.id);
                  return state.status === "done";
                }).length;

                return (
                  <details
                    key={phase.id}
                    className="group rounded-xl border border-stone-100/20 bg-black/35 p-3"
                    open={phase.label === currentPhase}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-left">
                      <div>
                        <h3 className="font-mono text-base text-amber-50">{phase.label}</h3>
                        <p className="text-xs text-stone-300">
                          {phaseDone}/{phase.tasks.length} complete
                        </p>
                      </div>
                      <span className="rounded border border-stone-300/20 px-2 py-1 text-xs group-open:hidden">Expand</span>
                      <span className="hidden rounded border border-stone-300/20 px-2 py-1 text-xs group-open:inline">Collapse</span>
                    </summary>

                    <div className="mt-3 space-y-3">{phase.tasks.map((task) => renderTaskCard(task))}</div>
                  </details>
                );
              })
            : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-stone-100/20 bg-black/35 p-4">
            <h2 className="font-mono text-lg text-amber-50">Next Best Actions</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {nextBest.map((task) => {
                const available = isTaskAvailable(task, activeProfile);
                return (
                  <li key={task.id} className="rounded border border-stone-300/20 bg-stone-900/45 px-2 py-2">
                    <p className="font-medium text-stone-100">{task.title}</p>
                    <p className="text-xs text-stone-300">{task.area} • {task.priority} • {task.effort}</p>
                    {!available ? <p className="mt-1 text-xs text-rose-200">Dependency locked</p> : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-stone-100/20 bg-black/35 p-4">
            <h2 className="font-mono text-lg text-amber-50">Build Planner</h2>
            <div className="mt-2 space-y-3 text-sm">
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-stone-300">Relics</p>
                <div className="flex flex-wrap gap-1">
                  {RELIC_OPTIONS.map((relic) => {
                    const active = activeProfile.planner.chosenRelics.includes(relic);
                    return (
                      <button
                        key={relic}
                        onClick={() =>
                          updateProfile((profile) => ({
                            ...profile,
                            planner: {
                              ...profile.planner,
                              chosenRelics: active
                                ? profile.planner.chosenRelics.filter((item) => item !== relic)
                                : [...profile.planner.chosenRelics, relic],
                            },
                          }))
                        }
                        className={`rounded border px-2 py-1 text-xs ${active ? "border-amber-200/70 bg-amber-200/20" : "border-stone-300/20"}`}
                      >
                        {relic}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-stone-300">Pacts</p>
                <div className="flex flex-wrap gap-1">
                  {PACT_OPTIONS.map((pact) => {
                    const active = activeProfile.planner.chosenPacts.includes(pact);
                    return (
                      <button
                        key={pact}
                        onClick={() =>
                          updateProfile((profile) => ({
                            ...profile,
                            planner: {
                              ...profile.planner,
                              chosenPacts: active
                                ? profile.planner.chosenPacts.filter((item) => item !== pact)
                                : [...profile.planner.chosenPacts, pact],
                            },
                          }))
                        }
                        className={`rounded border px-2 py-1 text-xs ${active ? "border-sky-200/70 bg-sky-200/20" : "border-stone-300/20"}`}
                      >
                        {pact}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-stone-300">Unlocked Regions</p>
                <div className="flex flex-wrap gap-1">
                  {REGION_OPTIONS.map((region) => {
                    const active = activeProfile.planner.unlockedRegions.includes(region);
                    return (
                      <button
                        key={region}
                        onClick={() =>
                          updateProfile((profile) => ({
                            ...profile,
                            planner: {
                              ...profile.planner,
                              unlockedRegions: active
                                ? profile.planner.unlockedRegions.filter((item) => item !== region)
                                : [...profile.planner.unlockedRegions, region],
                            },
                          }))
                        }
                        className={`rounded border px-2 py-1 text-xs ${active ? "border-lime-200/70 bg-lime-200/20" : "border-stone-300/20"}`}
                      >
                        {region}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="text-xs uppercase tracking-wider text-stone-300">Build Notes</span>
                <textarea
                  rows={3}
                  value={activeProfile.planner.buildNotes}
                  onChange={(event) =>
                    updateProfile((profile) => ({
                      ...profile,
                      planner: {
                        ...profile.planner,
                        buildNotes: event.target.value,
                      },
                    }))
                  }
                  className="mt-1 w-full rounded border border-stone-300/20 bg-stone-900/70 px-2 py-1"
                />
              </label>
            </div>
          </section>
        </aside>
      </main>

      {showPalette ? (
        <div className="fixed inset-0 z-50 grid place-items-start bg-black/60 px-4 pt-24" onClick={() => setShowPalette(false)}>
          <div className="w-full max-w-lg rounded-xl border border-amber-200/30 bg-stone-950/95 p-4" onClick={(event) => event.stopPropagation()}>
            <h3 className="font-mono text-lg text-amber-50">Quick Actions</h3>
            <div className="mt-3 grid gap-2 text-sm">
              <button
                onClick={() => {
                  updateProfile((profile) => ({ ...profile, compactMode: !profile.compactMode }));
                  setShowPalette(false);
                }}
                className="rounded border border-stone-300/20 px-3 py-2 text-left hover:bg-stone-100/10"
              >
                Toggle compact mode
              </button>
              <button
                onClick={() => {
                  setFilters((current) => ({ ...current, showCompleted: !current.showCompleted }));
                  setShowPalette(false);
                }}
                className="rounded border border-stone-300/20 px-3 py-2 text-left hover:bg-stone-100/10"
              >
                Toggle completed visibility
              </button>
              <button
                onClick={() => {
                  setFilters((current) => ({ ...current, search: "" }));
                  searchRef.current?.focus();
                  setShowPalette(false);
                }}
                className="rounded border border-stone-300/20 px-3 py-2 text-left hover:bg-stone-100/10"
              >
                Clear search and focus search box
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
