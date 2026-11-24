import assert from "node:assert";
import test from "node:test";
import {
  BACKUP_TABLES,
  CLEAR_ALL_DATA_SQL,
} from "../src/lib/db-import.utils.ts";

test("CLEAR_ALL_DATA_SQL clears all 5 user data tables in safe dependency order", () => {
  assert.deepStrictEqual(BACKUP_TABLES, [
    "sleep_log_edits",
    "body_care_logs",
    "todo_tasks",
    "discussion_topics",
    "sleep_logs",
  ]);

  assert.strictEqual(CLEAR_ALL_DATA_SQL.length, 5);
  assert.deepStrictEqual(CLEAR_ALL_DATA_SQL, [
    "DELETE FROM sleep_log_edits",
    "DELETE FROM body_care_logs",
    "DELETE FROM todo_tasks",
    "DELETE FROM discussion_topics",
    "DELETE FROM sleep_logs",
  ]);

  // Dependent / child tables must always be cleared before sleep_logs
  const sleepLogsIdx = CLEAR_ALL_DATA_SQL.indexOf("DELETE FROM sleep_logs");
  assert.strictEqual(sleepLogsIdx, CLEAR_ALL_DATA_SQL.length - 1);
});
