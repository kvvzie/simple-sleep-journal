import { parseWeekKey } from "../to-discuss/to-discuss.utils.ts";

export type SleepSessionSnapshot = {
  hasEntry: boolean;
  hours: number;
  mood: number;
  comment: string;
  bodyCareEnabled: boolean;
  bodyCareProductId: string | null;
  bodyCareAmounts: Record<string, string>;
};

export function formatMovedToWeekToast(targetWeekKey: string): string {
  const parsed = parseWeekKey(targetWeekKey);
  const weekLabel = parsed ? `W${parsed.week}` : targetWeekKey;
  return `moved to ${weekLabel}`;
}

export function resolveToastTopOffset(
  localTopInset: number,
  rootTopInset: number,
): number {
  return Math.max(12, Math.max(localTopInset, rootTopInset) + 8);
}

export function resolveToastHostEntryMode(options: {
  isCurrentHost: boolean;
  toastId: number | null;
  phase: "visible" | "exiting" | null;
  alreadyEntered: boolean;
}): "hide" | "animate-in" | "snap-visible" | "animate-out" {
  const { isCurrentHost, toastId, phase, alreadyEntered } = options;
  if (!isCurrentHost || toastId === null || phase === null) {
    return "hide";
  }
  if (phase === "exiting") {
    return "animate-out";
  }
  return alreadyEntered ? "snap-visible" : "animate-in";
}

function normalizeAmountsMap(
  amounts: Partial<Record<string, string>>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const key of Object.keys(amounts).sort()) {
    const val = amounts[key];
    if (val !== undefined) {
      normalized[key] = val;
    }
  }
  return normalized;
}

export function createSleepSessionSnapshot(params: {
  hasEntry: boolean;
  hours: number;
  mood: number;
  comment: string;
  bodyCareEnabled: boolean;
  bodyCareProductId: string | null;
  bodyCareAmounts: Partial<Record<string, string>>;
}): SleepSessionSnapshot {
  return {
    hasEntry: params.hasEntry,
    hours: params.hours,
    mood: params.mood,
    comment: params.comment,
    bodyCareEnabled: params.bodyCareEnabled,
    bodyCareProductId: params.bodyCareEnabled ? params.bodyCareProductId : null,
    bodyCareAmounts: params.bodyCareEnabled
      ? normalizeAmountsMap(params.bodyCareAmounts)
      : {},
  };
}

export function hasSleepSessionChanges(options: {
  initial: SleepSessionSnapshot | null;
  current: SleepSessionSnapshot;
  features: {
    moodStarsEnabled: boolean;
    bodyCareEnabled: boolean;
    commentsEnabled: boolean;
  };
  todosModified: boolean;
}): boolean {
  const { initial, current, features, todosModified } = options;
  if (todosModified) return true;
  if (!initial) return false;

  if (current.hours !== initial.hours) return true;
  if (features.moodStarsEnabled && current.mood !== initial.mood) return true;
  if (features.commentsEnabled && current.comment !== initial.comment) {
    return true;
  }

  if (features.bodyCareEnabled) {
    if (current.bodyCareEnabled !== initial.bodyCareEnabled) return true;
    if (current.bodyCareEnabled) {
      if (current.bodyCareProductId !== initial.bodyCareProductId) return true;
      const prevKeys = Object.keys(initial.bodyCareAmounts);
      const nextKeys = Object.keys(current.bodyCareAmounts);
      if (prevKeys.length !== nextKeys.length) return true;
      for (const k of nextKeys) {
        if (current.bodyCareAmounts[k] !== initial.bodyCareAmounts[k]) {
          return true;
        }
      }
    }
  }

  return false;
}
