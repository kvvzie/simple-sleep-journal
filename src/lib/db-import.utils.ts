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
