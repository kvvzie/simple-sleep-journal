export const BACKUP_TABLES = [
  "sleep_log_edits",
  "body_care_logs",
  "todo_tasks",
  "discussion_topics",
  "sleep_logs",
] as const;

export const CLEAR_ALL_DATA_SQL: readonly string[] = BACKUP_TABLES.map(
  (table) => `DELETE FROM ${table}`,
);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BODY_CARE_ZONES = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export type SanitizedSleepLog = {
  date: string;
  hours: number;
  mood: number;
  comment: string;
  logged_at: string;
  updated_at: string;
};

export type SanitizedSleepLogEdit = {
  log_date: string;
  edit_index: number;
  edited_at: string;
  prev_hours: number | null;
  new_hours: number | null;
  prev_mood: number | null;
  new_mood: number | null;
  prev_comment: string | null;
  new_comment: string | null;
  changed_hours: number;
  changed_mood: number;
  changed_comment: number;
};

export type SanitizedBodyCareLog = {
  date: string;
  product_id: string;
  amounts: Partial<Record<(typeof BODY_CARE_ZONES)[number], string>>;
  updated_at: string;
};

export type ParsedBackupPayload =
  | { kind: "legacy-array"; logs: unknown[] }
  | {
      kind: "full-backup";
      logs: unknown[];
      edits: unknown[];
      bodyCareLogs: unknown[];
      todos: unknown[];
      discussionTopics: unknown[];
    };

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toFlagInt(value: unknown): number {
  if (value === true || value === 1 || value === "1") return 1;
  return 0;
}

export function sanitizeImportedSleepLogs(
  rawLogs: unknown,
  fallbackIso: string,
): SanitizedSleepLog[] {
  if (!Array.isArray(rawLogs)) return [];
  const result: SanitizedSleepLog[] = [];
  for (const item of rawLogs) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.date !== "string" || !ISO_DATE_RE.test(raw.date)) continue;
    const hoursNum = Number(raw.hours);
    const moodNum = Number(raw.mood);
    const hours = Number.isFinite(hoursNum) ? Math.max(0, Math.min(24, hoursNum)) : 0;
    const mood = Number.isFinite(moodNum)
      ? Math.max(0, Math.min(10, Math.round(moodNum)))
      : 0;
    const comment = typeof raw.comment === "string" ? raw.comment : "";
    const loggedAt =
      typeof raw.logged_at === "string" && raw.logged_at.trim().length > 0
        ? raw.logged_at
        : fallbackIso;
    const updatedAt =
      typeof raw.updated_at === "string" && raw.updated_at.trim().length > 0
        ? raw.updated_at
        : loggedAt;
    result.push({
      date: raw.date,
      hours,
      mood,
      comment,
      logged_at: loggedAt,
      updated_at: updatedAt,
    });
  }
  return result;
}

export function sanitizeImportedSleepLogEdits(
  rawEdits: unknown,
  fallbackIso: string,
): SanitizedSleepLogEdit[] {
  if (!Array.isArray(rawEdits)) return [];
  const result: SanitizedSleepLogEdit[] = [];
  for (const item of rawEdits) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.log_date !== "string" || !ISO_DATE_RE.test(raw.log_date)) {
      continue;
    }
    const editIdxNum = Number(raw.edit_index);
    if (!Number.isFinite(editIdxNum) || editIdxNum < 1) continue;
    const editedAt =
      typeof raw.edited_at === "string" && raw.edited_at.trim().length > 0
        ? raw.edited_at
        : fallbackIso;
    result.push({
      log_date: raw.log_date,
      edit_index: Math.round(editIdxNum),
      edited_at: editedAt,
      prev_hours: toNullableNumber(raw.prev_hours),
      new_hours: toNullableNumber(raw.new_hours),
      prev_mood: toNullableNumber(raw.prev_mood),
      new_mood: toNullableNumber(raw.new_mood),
      prev_comment: typeof raw.prev_comment === "string" ? raw.prev_comment : null,
      new_comment: typeof raw.new_comment === "string" ? raw.new_comment : null,
      changed_hours: toFlagInt(raw.changed_hours),
      changed_mood: toFlagInt(raw.changed_mood),
      changed_comment: toFlagInt(raw.changed_comment),
    });
  }
  return result;
}

export function sanitizeImportedBodyCareLogs(
  rawBodyCareLogs: unknown,
  fallbackIso: string,
): SanitizedBodyCareLog[] {
  if (!Array.isArray(rawBodyCareLogs)) return [];
  const result: SanitizedBodyCareLog[] = [];
  for (const item of rawBodyCareLogs) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.date !== "string" || !ISO_DATE_RE.test(raw.date)) continue;
    if (typeof raw.product_id !== "string" || raw.product_id.trim().length === 0) {
      continue;
    }

    let rawAmounts: unknown = raw.amounts;
    if (
      (!rawAmounts || typeof rawAmounts !== "object") &&
      typeof raw.amounts_json === "string"
    ) {
      try {
        rawAmounts = JSON.parse(raw.amounts_json);
      } catch {
        rawAmounts = {};
      }
    }

    const amounts: SanitizedBodyCareLog["amounts"] = {};
    if (rawAmounts && typeof rawAmounts === "object") {
      const rec = rawAmounts as Record<string, unknown>;
      for (const zone of BODY_CARE_ZONES) {
        const val = rec[zone];
        if (typeof val === "string") {
          amounts[zone] = val;
        } else if (typeof val === "number" && Number.isFinite(val)) {
          amounts[zone] = String(val);
        }
      }
    }

    const updatedAt =
      typeof raw.updated_at === "string" && raw.updated_at.trim().length > 0
        ? raw.updated_at
        : fallbackIso;

    result.push({
      date: raw.date,
      product_id: raw.product_id.trim(),
      amounts,
      updated_at: updatedAt,
    });
  }
  return result;
}

export function parseBackupJsonPayload(
  parsed: unknown,
): ParsedBackupPayload | null {
  if (Array.isArray(parsed)) {
    return { kind: "legacy-array", logs: parsed };
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const obj = parsed as Record<string, unknown>;
  const hasKnownArray =
    Array.isArray(obj.logs) ||
    Array.isArray(obj.bodyCareLogs) ||
    Array.isArray(obj.todos) ||
    Array.isArray(obj.discussionTopics);
  if (!hasKnownArray) {
    return null;
  }
  return {
    kind: "full-backup",
    logs: Array.isArray(obj.logs) ? obj.logs : [],
    edits: Array.isArray(obj.edits) ? obj.edits : [],
    bodyCareLogs: Array.isArray(obj.bodyCareLogs) ? obj.bodyCareLogs : [],
    todos: Array.isArray(obj.todos) ? obj.todos : [],
    discussionTopics: Array.isArray(obj.discussionTopics)
      ? obj.discussionTopics
      : [],
  };
}
