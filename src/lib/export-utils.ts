import {
  getTodoOutcome,
  sortTodosChronologically,
  type TodoTask,
} from "../components/sleep-modal/todo.utils.ts";

export type ExportSleepLog = {
  date: string;
  hours: number;
  mood: number;
  comment: string;
  logged_at: string | null;
  updated_at: string | null;
};

export type ExportSleepLogEdit = {
  id: number;
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

export type ExportBodyCareLog = {
  date: string;
  product_id: string;
  amounts: Partial<
    Record<"top-left" | "top-right" | "bottom-left" | "bottom-right", string>
  >;
  updated_at: string;
};

export const MOOD_SCALE_MAX = 10;

export function filterByDateRange<T>(
  items: T[],
  getDate: (item: T) => string,
  startDate: string,
  endDate: string,
): T[] {
  return items.filter((item) => {
    const date = getDate(item);
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
  });
}

export function buildJsonExportPayload(params: {
  exportedAt: string;
  logs: ExportSleepLog[];
  edits: ExportSleepLogEdit[];
  bodyCareLogs: ExportBodyCareLog[];
  todos: TodoTask[];
  bodyCareEnabled: boolean;
}) {
  return {
    export_date: params.exportedAt,
    version: "1.2.0",
    logs: params.logs,
    edits: params.edits,
    bodyCareLogs: params.bodyCareEnabled ? params.bodyCareLogs : [],
    todos: params.todos,
  };
}

export function buildTxtExportContent(params: {
  logs: ExportSleepLog[];
  edits: ExportSleepLogEdit[];
  bodyCareLogs: ExportBodyCareLog[];
  todos: TodoTask[];
  startDate: string;
  endDate: string;
  moodStarsEnabled: boolean;
  bodyCareEnabled: boolean;
  commentsEnabled: boolean;
  todoListEnabled: boolean;
  todayDate: string;
}): string {
  const {
    logs,
    edits,
    bodyCareLogs,
    todos,
    startDate,
    endDate,
    moodStarsEnabled,
    bodyCareEnabled,
    commentsEnabled,
    todoListEnabled,
    todayDate,
  } = params;

  const filteredLogs = filterByDateRange(logs, (l) => l.date, startDate, endDate);
  const bodyCareByDate = new Map(bodyCareLogs.map((b) => [b.date, b]));

  const editsByDate = new Map<string, ExportSleepLogEdit[]>();
  for (const e of edits) {
    const bucket = editsByDate.get(e.log_date);
    if (bucket) bucket.push(e);
    else editsByDate.set(e.log_date, [e]);
  }

  const orderedTodos = sortTodosChronologically(todos);
  const addedByDate = new Map<string, TodoTask[]>();
  const completedByDate = new Map<string, TodoTask[]>();
  const expiredByDate = new Map<string, TodoTask[]>();

  if (todoListEnabled) {
    for (const todo of orderedTodos) {
      const addedBucket = addedByDate.get(todo.created_date);
      if (addedBucket) addedBucket.push(todo);
      else addedByDate.set(todo.created_date, [todo]);

      if (todo.completed_date) {
        const completedBucket = completedByDate.get(todo.completed_date);
        if (completedBucket) completedBucket.push(todo);
        else completedByDate.set(todo.completed_date, [todo]);
      } else if (todayDate > todo.expires_date) {
        const expiredBucket = expiredByDate.get(todo.expires_date);
        if (expiredBucket) expiredBucket.push(todo);
        else expiredByDate.set(todo.expires_date, [todo]);
      }
    }
  }

  let fileContent = `SLEEP / MOOD LOG REPORT (${startDate || "All Time"} to ${endDate || "All Time"})\n\n`;

  for (const log of filteredLogs) {
    const bodyCare = bodyCareByDate.get(log.date);
    fileContent += `Date: ${log.date}\n`;
    fileContent += `Hours Slept: ${log.hours}\n`;
    if (moodStarsEnabled) {
      fileContent += `Mood Rating: ${log.mood}/${MOOD_SCALE_MAX}\n`;
    }
    if (bodyCareEnabled) {
      fileContent += `Self Harm: ${bodyCare ? "yes" : "no"}\n`;
    }
    if (commentsEnabled && log.comment) {
      fileContent += `Notes: ${log.comment}\n`;
    }
    if (log.logged_at) fileContent += `Logged: ${log.logged_at}\n`;
    if (log.updated_at) {
      fileContent += `Last Edited: ${log.updated_at}\n`;
      const dateEdits = editsByDate.get(log.date) ?? [];
      for (const e of dateEdits) {
        const parts: string[] = [];
        if (e.changed_hours) parts.push(`hours ${e.prev_hours} → ${e.new_hours}`);
        if (moodStarsEnabled && e.changed_mood) {
          parts.push(`mood ${e.prev_mood} → ${e.new_mood}`);
        }
        if (commentsEnabled && e.changed_comment) parts.push("comment");
        fileContent += `  #${e.edit_index} ${e.edited_at} changed ${parts.join(", ")}\n`;
      }
    }

    if (todoListEnabled) {
      const added = addedByDate.get(log.date) ?? [];
      if (added.length > 0) {
        fileContent += `Tasks Added (${added.length}):\n`;
        for (const t of added) {
          fileContent += `  - "${t.title}" (${t.created_at})\n`;
        }
      }

      const completed = completedByDate.get(log.date) ?? [];
      if (completed.length > 0) {
        fileContent += `Tasks Completed (${completed.length}):\n`;
        for (const t of completed) {
          fileContent += `  - "${t.title}" (completed ${t.completed_at ?? t.completed_date})\n`;
        }
      }

      const expired = expiredByDate.get(log.date) ?? [];
      if (expired.length > 0) {
        fileContent += `Tasks Not Completed In Time (${expired.length}):\n`;
        for (const t of expired) {
          fileContent += `  - "${t.title}" (added ${t.created_at}, expired after ${t.expires_date})\n`;
        }
      }
    }

    fileContent += `---------------------------\n`;
  }

  return fileContent;
}

export const CSV_HEADER = [
  "record_type",
  "date",
  "hours",
  "mood",
  "comment",
  "logged_at",
  "updated_at",
  "edit_index",
  "edited_at",
  "prev_hours",
  "new_hours",
  "prev_mood",
  "new_mood",
  "prev_comment",
  "new_comment",
  "changed_hours",
  "changed_mood",
  "changed_comment",
  "self_harm_product_id",
  "self_harm_top_left",
  "self_harm_top_right",
  "self_harm_bottom_left",
  "self_harm_bottom_right",
  "self_harm_updated_at",
  "todo_title",
  "todo_completed",
  "todo_status",
  "todo_created_at",
  "todo_completed_at",
  "todo_expires_date",
] as const;

const TODO_TRAIL_EMPTY = Array(6).fill("") as string[];

export function csvEscapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildCsvExportContent(params: {
  logs: ExportSleepLog[];
  edits: ExportSleepLogEdit[];
  bodyCareLogs: ExportBodyCareLog[];
  todos: TodoTask[];
  startDate: string;
  endDate: string;
  moodStarsEnabled: boolean;
  bodyCareEnabled: boolean;
  commentsEnabled: boolean;
  todoListEnabled: boolean;
  todayDate: string;
}): string {
  const {
    logs,
    edits,
    bodyCareLogs,
    todos,
    startDate,
    endDate,
    moodStarsEnabled,
    bodyCareEnabled,
    commentsEnabled,
    todoListEnabled,
    todayDate,
  } = params;

  const filteredLogs = filterByDateRange(logs, (l) => l.date, startDate, endDate);
  const filteredEdits = filterByDateRange(edits, (e) => e.log_date, startDate, endDate);
  const filteredBodyCare = filterByDateRange(bodyCareLogs, (b) => b.date, startDate, endDate);
  const filteredTodos = filterByDateRange(
    sortTodosChronologically(todos),
    (t) => t.created_date,
    startDate,
    endDate,
  );

  const rowsData: string[][] = [[...CSV_HEADER]];

  for (const log of filteredLogs) {
    rowsData.push([
      "log",
      log.date,
      String(log.hours),
      moodStarsEnabled ? String(log.mood) : "",
      commentsEnabled ? (log.comment ?? "") : "",
      log.logged_at ?? "",
      log.updated_at ?? "",
      ...Array(17).fill(""),
      ...TODO_TRAIL_EMPTY,
    ]);
  }

  for (const edit of filteredEdits) {
    rowsData.push([
      "edit",
      edit.log_date,
      "",
      "",
      "",
      "",
      "",
      String(edit.edit_index),
      edit.edited_at,
      edit.prev_hours?.toString() ?? "",
      edit.new_hours?.toString() ?? "",
      edit.prev_mood?.toString() ?? "",
      edit.new_mood?.toString() ?? "",
      edit.prev_comment ?? "",
      edit.new_comment ?? "",
      String(edit.changed_hours),
      String(edit.changed_mood),
      String(edit.changed_comment),
      ...Array(6).fill(""),
      ...TODO_TRAIL_EMPTY,
    ]);
  }

  if (bodyCareEnabled) {
    for (const bodyCare of filteredBodyCare) {
      rowsData.push([
        "self_harm",
        bodyCare.date,
        ...Array(16).fill(""),
        bodyCare.product_id,
        bodyCare.amounts["top-left"] ?? "",
        bodyCare.amounts["top-right"] ?? "",
        bodyCare.amounts["bottom-left"] ?? "",
        bodyCare.amounts["bottom-right"] ?? "",
        bodyCare.updated_at ?? "",
        ...TODO_TRAIL_EMPTY,
      ]);
    }
  }

  if (todoListEnabled) {
    for (const todo of filteredTodos) {
      const outcome = getTodoOutcome(todo, todayDate);
      rowsData.push([
        "todo",
        todo.created_date,
        ...Array(22).fill(""),
        todo.title,
        todo.completed_date !== null ? "yes" : "no",
        outcome,
        todo.created_at,
        todo.completed_at ?? "",
        todo.expires_date,
      ]);
    }
  }

  return rowsData.map((r) => r.map(csvEscapeCell).join(",")).join("\n");
}
