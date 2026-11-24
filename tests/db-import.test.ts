import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  BACKUP_TABLES,
  CLEAR_ALL_DATA_SQL,
  parseBackupJsonPayload,
  sanitizeImportedBodyCareLogs,
  sanitizeImportedSleepLogEdits,
  sanitizeImportedSleepLogs,
} from "../src/lib/db-import.utils.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

test("CLEAR_ALL_DATA_SQL clears all 5 user data tables in safe dependency order", () => {
  assert.deepEqual(BACKUP_TABLES, [
    "sleep_log_edits",
    "body_care_logs",
    "todo_tasks",
    "discussion_topics",
    "sleep_logs",
  ]);
  assert.deepEqual(CLEAR_ALL_DATA_SQL, [
    "DELETE FROM sleep_log_edits",
    "DELETE FROM body_care_logs",
    "DELETE FROM todo_tasks",
    "DELETE FROM discussion_topics",
    "DELETE FROM sleep_logs",
  ]);
});

test("parseBackupJsonPayload accepts v1.0 flat array, v1.1.2 version-3 object, v1.3.0 full object, and rejects invalid data", () => {
  const legacyV1 = parseBackupJsonPayload([
    { date: "2026-01-10", hours: 7.5, mood: 8, comment: "solid" },
  ]);
  assert.equal(legacyV1?.kind, "legacy-array");
  assert.equal(legacyV1?.logs.length, 1);

  const prodV112 = parseBackupJsonPayload({
    version: 3,
    logs: [{ date: "2026-02-01", hours: 6, mood: 5, comment: "old prod" }],
    edits: [],
    bodyCareLogs: [{ date: "2026-02-01", product_id: "gillette-platinum", amounts: {} }],
  });
  assert.equal(prodV112?.kind, "full-backup");
  if (prodV112?.kind === "full-backup") {
    assert.equal(prodV112.logs.length, 1);
    assert.equal(prodV112.bodyCareLogs.length, 1);
    assert.deepEqual(prodV112.todos, []);
    assert.deepEqual(prodV112.discussionTopics, []);
  }

  const bodyCareOnly = parseBackupJsonPayload({
    bodyCareLogs: [{ date: "2026-03-01", product_id: "gillette-platinum", amounts: {} }],
  });
  assert.equal(bodyCareOnly?.kind, "full-backup");

  assert.equal(parseBackupJsonPayload(null), null);
  assert.equal(parseBackupJsonPayload("corrupt"), null);
  assert.equal(parseBackupJsonPayload({ version: 3 }), null);
});

test("sanitizers normalize legacy v1.0/v1.1.2 sleep logs, edits, and body-care records safely", () => {
  const now = "2026-11-24T12:00:00.000Z";
  const logs = sanitizeImportedSleepLogs(
    [
      { date: "2026-01-01", hours: 8, mood: 9, comment: null },
      { date: "2026-01-02", hours: "7.5", mood: 12, comment: "clamped", logged_at: "2026-01-02T08:00:00Z" },
      { date: "bad-date", hours: 5, mood: 5, comment: "skip" },
      null,
    ],
    now,
  );
  assert.equal(logs.length, 2);
  assert.deepEqual(logs[0], {
    date: "2026-01-01",
    hours: 8,
    mood: 9,
    comment: "",
    logged_at: now,
    updated_at: now,
  });
  assert.equal(logs[1].hours, 7.5);
  assert.equal(logs[1].mood, 10);
  assert.equal(logs[1].logged_at, "2026-01-02T08:00:00Z");
  assert.equal(logs[1].updated_at, "2026-01-02T08:00:00Z");

  const edits = sanitizeImportedSleepLogEdits(
    [
      {
        log_date: "2026-01-01",
        edit_index: 1,
        edited_at: "2026-01-01T10:00:00Z",
        prev_hours: 7,
        new_hours: 8,
        changed_hours: true,
        changed_mood: 0,
        changed_comment: false,
      },
      { log_date: "invalid", edit_index: 1 },
    ],
    now,
  );
  assert.equal(edits.length, 1);
  assert.equal(edits[0].changed_hours, 1);
  assert.equal(edits[0].changed_mood, 0);
  assert.equal(edits[0].prev_comment, null);

  const bc = sanitizeImportedBodyCareLogs(
    [
      {
        date: "2026-01-03",
        product_id: "gillette-platinum",
        amounts_json: JSON.stringify({ "top-left": "2", "bottom-right": 1 }),
      },
      { date: "2026-01-04", product_id: "" },
    ],
    now,
  );
  assert.equal(bc.length, 1);
  assert.deepEqual(bc[0].amounts, { "top-left": "2", "bottom-right": "1" });
});

test("db.ts schema initialization stays strictly additive to protect in-place production upgrades", () => {
  const dbSource = fs.readFileSync(path.join(ROOT_DIR, "src/lib/db.ts"), "utf8");
  assert.match(dbSource, /openDatabaseAsync\("sleepinapp\.db"\)/);
  assert.equal(/DROP\s+TABLE/i.test(dbSource), false);
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS sleep_logs/);
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS sleep_log_edits/);
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS body_care_logs/);
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS todo_tasks/);
  assert.match(dbSource, /CREATE TABLE IF NOT EXISTS discussion_topics/);
});
