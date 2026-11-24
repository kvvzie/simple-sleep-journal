export type TodoTask = {
  id: string;
  title: string;
  created_date: string;
  expires_date: string;
  created_at: string;
  updated_at: string;
  completed_date: string | null;
  completed_at: string | null;
};

export type TodoOutcome = "completed" | "not_completed" | "in_progress";

export const TODO_CARRYOVER_DAYS = 3;
export const MAX_TODO_DISPLAY_HOURS = 96;
const MS_PER_HOUR = 3_600_000;

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return isoDate;
  }
  const dt = new Date(Date.UTC(year, month, day + days));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return addDaysToIsoDate(value, 0) === value;
}

export function getLocalTodayIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function generateTodoId(): string {
  const timePart = Date.now().toString(36);
  const randPart = Math.random().toString(36).slice(2, 10);
  return `todo_${timePart}_${randPart}`;
}

export function isTodoVisibleOnDate(todo: TodoTask, viewDate: string): boolean {
  if (viewDate < todo.created_date || viewDate > todo.expires_date) {
    return false;
  }
  if (todo.completed_date !== null && viewDate > todo.completed_date) {
    return false;
  }
  return true;
}

export function sortTodosChronologically(todos: TodoTask[]): TodoTask[] {
  return [...todos].sort((a, b) => {
    if (a.created_date !== b.created_date) {
      return a.created_date < b.created_date ? -1 : 1;
    }
    if (a.created_at !== b.created_at) {
      return a.created_at < b.created_at ? -1 : 1;
    }
    if (a.id !== b.id) {
      return a.id < b.id ? -1 : 1;
    }
    return 0;
  });
}

export function formatTodoElapsedHours(
  createdAtIso: string,
  nowMs = Date.now(),
): string {
  const createdMs = Date.parse(createdAtIso);
  if (!Number.isFinite(createdMs)) {
    return "(<1 hours ago)";
  }
  const diffMs = Math.max(0, nowMs - createdMs);
  const hours = Math.floor(diffMs / MS_PER_HOUR);
  if (hours < 1) {
    return "(<1 hours ago)";
  }
  if (hours > MAX_TODO_DISPLAY_HOURS) {
    return `(>${MAX_TODO_DISPLAY_HOURS} hours ago)`;
  }
  return `(${hours} hours ago)`;
}

export function getTodoOutcome(
  todo: TodoTask,
  todayIsoDate: string,
): TodoOutcome {
  if (todo.completed_date !== null) {
    return "completed";
  }
  if (todayIsoDate > todo.expires_date) {
    return "not_completed";
  }
  return "in_progress";
}

export function sanitizeImportedTodos(
  rawTodos: unknown,
  fallbackIso = new Date().toISOString(),
): TodoTask[] {
  if (!Array.isArray(rawTodos)) return [];
  const sanitized: TodoTask[] = [];
  for (const item of rawTodos) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title || !isValidIsoDate(raw.created_date)) continue;

    const id =
      typeof raw.id === "string" && raw.id.trim().length > 0
        ? raw.id.trim()
        : generateTodoId();
    const expires_date = isValidIsoDate(raw.expires_date)
      ? raw.expires_date
      : addDaysToIsoDate(raw.created_date, TODO_CARRYOVER_DAYS);
    const created_at =
      typeof raw.created_at === "string" && raw.created_at.trim().length > 0
        ? raw.created_at
        : fallbackIso;
    const updated_at =
      typeof raw.updated_at === "string" && raw.updated_at.trim().length > 0
        ? raw.updated_at
        : created_at;
    const completed_date = isValidIsoDate(raw.completed_date)
      ? raw.completed_date
      : null;
    const completed_at =
      completed_date !== null &&
      typeof raw.completed_at === "string" &&
      raw.completed_at.trim().length > 0
        ? raw.completed_at
        : completed_date;

    sanitized.push({
      id,
      title,
      created_date: raw.created_date,
      expires_date,
      created_at,
      updated_at,
      completed_date,
      completed_at,
    });
  }
  return sortTodosChronologically(sanitized);
}
