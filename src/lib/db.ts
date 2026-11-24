import * as SQLite from "expo-sqlite";
import {
  generateDiscussionTopicId,
  getWeekDateRange,
  parseWeekKey,
  sanitizeImportedDiscussionTopics,
  type DiscussionTopic,
  type WeekTopicSummary,
} from "../components/to-discuss/to-discuss.utils";
import { CLEAR_ALL_DATA_SQL } from "./db-import.utils";
import { computeMinMaxIsoDates } from "./export-utils";
import {
  addDaysToIsoDate,
  generateTodoId,
  sanitizeImportedTodos,
  TODO_CARRYOVER_DAYS,
  type TodoTask,
} from "../components/sleep-modal/todo.utils";

export { CLEAR_ALL_DATA_SQL };
export type { DiscussionTopic, TodoTask, WeekTopicSummary };

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function ensureSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sleep_logs (
      date TEXT PRIMARY KEY,
      hours REAL,
      mood INTEGER,
      comment TEXT,
      logged INTEGER DEFAULT 1,
      updated_at TEXT
    );
  `);

  if (!(await columnExists(db, "sleep_logs", "logged_at"))) {
    await db.execAsync(`ALTER TABLE sleep_logs ADD COLUMN logged_at TEXT;`);
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sleep_log_edits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_date TEXT NOT NULL,
      edit_index INTEGER NOT NULL,
      edited_at TEXT NOT NULL,
      prev_hours REAL,
      new_hours REAL,
      prev_mood INTEGER,
      new_mood INTEGER,
      prev_comment TEXT,
      new_comment TEXT,
      changed_hours INTEGER NOT NULL DEFAULT 0,
      changed_mood INTEGER NOT NULL DEFAULT 0,
      changed_comment INTEGER NOT NULL DEFAULT 0
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS body_care_logs (
      date TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      amounts_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS todo_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_date TEXT NOT NULL,
      expires_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_date TEXT,
      completed_at TEXT
    );
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_sleep_log_edits_date
    ON sleep_log_edits(log_date);
  `);

  await db.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sleep_log_edits_unique
    ON sleep_log_edits(log_date, edit_index);
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_todo_tasks_window
    ON todo_tasks(created_date, expires_date);
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_todo_tasks_completed
    ON todo_tasks(completed_date);
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS discussion_topics (
      id TEXT PRIMARY KEY,
      week_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_discussion_topics_week
    ON discussion_topics(week_key);
  `);
}

async function openFreshDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync("sleepinapp.db");
  await ensureSchema(db);
  dbInstance = db;
  return db;
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (!dbPromise) {
    dbPromise = openFreshDb();
  }
  return dbPromise;
}

let opQueue: Promise<any> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = opQueue.then(fn, fn);
  opQueue = result.catch(() => undefined);
  return result;
}

async function withDb<T>(
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  return enqueue(() => withDbInner(fn));
}

async function withDbInner<T>(
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  try {
    return await fn(db);
  } catch (err: any) {
    const message = String(err?.message ?? err);
    if (
      message.includes("already released") ||
      message.includes("NativeDatabase")
    ) {
      dbInstance = null;
      dbPromise = null;
      const freshDb = await getDb();
      return await fn(freshDb);
    }
    throw err;
  }
}

async function columnExists(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table});`,
  );
  return rows.some((r) => r.name === column);
}

export type SleepLog = {
  date: string;
  hours: number;
  mood: number;
  comment: string;
  logged_at: string | null;
  updated_at: string | null;
};

export type BodyCareZone =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type BodyCareAmounts = Partial<Record<BodyCareZone, string>>;

export type BodyCareLog = {
  date: string;
  product_id: string;
  amounts: BodyCareAmounts;
  updated_at: string;
};

export type SleepLogEdit = {
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

export async function initDB() {
  await withDb(async (db) => {
    await ensureSchema(db);
  });
}

export async function saveSleepLog(
  date: string,
  hours: number,
  mood: number,
  comment: string,
) {
  const now = new Date().toISOString();

  await withDb(async (db) => {
    const existing = await db.getFirstAsync<SleepLog>(
      "SELECT * FROM sleep_logs WHERE date = ?",
      [date],
    );

    if (!existing) {
      await db.runAsync(
        `INSERT INTO sleep_logs (date, hours, mood, comment, logged, logged_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        [date, hours, mood, comment, now, now],
      );
      return;
    }

    const changedHours = existing.hours !== hours;
    const changedMood = existing.mood !== mood;
    const changedComment = existing.comment !== comment;

    if (!changedHours && !changedMood && !changedComment) {
      return;
    }

    const editCountRow = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM sleep_log_edits WHERE log_date = ?",
      [date],
    );
    const nextEditIndex = (editCountRow?.c ?? 0) + 1;

    await db.runAsync(
      `INSERT INTO sleep_log_edits
        (log_date, edit_index, edited_at,
         prev_hours, new_hours, prev_mood, new_mood, prev_comment, new_comment,
         changed_hours, changed_mood, changed_comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        date,
        nextEditIndex,
        now,
        changedHours ? existing.hours : null,
        changedHours ? hours : null,
        changedMood ? existing.mood : null,
        changedMood ? mood : null,
        changedComment ? existing.comment : null,
        changedComment ? comment : null,
        changedHours ? 1 : 0,
        changedMood ? 1 : 0,
        changedComment ? 1 : 0,
      ],
    );

    await db.runAsync(
      `UPDATE sleep_logs SET hours=?, mood=?, comment=?, updated_at=? WHERE date=?`,
      [hours, mood, comment, now, date],
    );
  });
}

export async function getSleepLog(date: string) {
  return withDb((db) =>
    db.getFirstAsync<SleepLog>("SELECT * FROM sleep_logs WHERE date = ?", [
      date,
    ]),
  );
}

export async function getSleepLogEdits(date: string) {
  return withDb((db) =>
    db.getAllAsync<SleepLogEdit>(
      "SELECT * FROM sleep_log_edits WHERE log_date = ? ORDER BY edit_index ASC",
      [date],
    ),
  );
}

export async function getBodyCareLog(
  date: string,
): Promise<BodyCareLog | null> {
  return withDb(async (db) => {
    const row = await db.getFirstAsync<{
      date: string;
      product_id: string;
      amounts_json: string;
      updated_at: string;
    }>(
      `SELECT date, product_id, amounts_json, updated_at
       FROM body_care_logs
       WHERE date = ?`,
      [date],
    );

    if (!row) return null;

    try {
      return {
        date: row.date,
        product_id: row.product_id,
        amounts: JSON.parse(row.amounts_json) as BodyCareAmounts,
        updated_at: row.updated_at,
      };
    } catch {
      return {
        date: row.date,
        product_id: row.product_id,
        amounts: {},
        updated_at: row.updated_at,
      };
    }
  });
}

export async function getLastBodyCareProductId(): Promise<string | null> {
  return withDb(async (db) => {
    const row = await db.getFirstAsync<{ product_id: string }>(
      `SELECT product_id
       FROM body_care_logs
       ORDER BY updated_at DESC
       LIMIT 1`,
    );

    return row?.product_id ?? null;
  });
}

export async function saveBodyCareLog(
  date: string,
  enabled: boolean,
  productId: string | null,
  amounts: BodyCareAmounts,
) {
  await withDb(async (db) => {
    if (!enabled || !productId) {
      await db.runAsync("DELETE FROM body_care_logs WHERE date = ?", [date]);

      return;
    }

    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO body_care_logs
       (date, product_id, amounts_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
       product_id = excluded.product_id,
       amounts_json = excluded.amounts_json,
       updated_at = excluded.updated_at`,
      [date, productId, JSON.stringify(amounts), now],
    );
  });
}

export async function getAllBodyCareLogs(): Promise<BodyCareLog[]> {
  return withDb(async (db) => {
    const rows = await db.getAllAsync<{
      date: string;
      product_id: string;
      amounts_json: string;
      updated_at: string;
    }>(
      `SELECT date, product_id, amounts_json, updated_at
       FROM body_care_logs
       ORDER BY date ASC`,
    );

    return rows.map((row) => {
      let amounts: BodyCareAmounts = {};

      try {
        amounts = JSON.parse(row.amounts_json) as BodyCareAmounts;
      } catch {}

      return {
        date: row.date,
        product_id: row.product_id,
        amounts,
        updated_at: row.updated_at,
      };
    });
  });
}

export async function getMonthLogs(year: number, month: number) {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}%`;
  return withDb((db) =>
    db.getAllAsync<{ date: string }>(
      `SELECT date FROM sleep_logs WHERE date LIKE ?
       UNION
       SELECT created_date AS date FROM todo_tasks WHERE created_date LIKE ?
       UNION
       SELECT completed_date AS date FROM todo_tasks
       WHERE completed_date IS NOT NULL AND completed_date LIKE ?`,
      [prefix, prefix, prefix],
    ),
  );
}

export async function getAllLoggedDates(): Promise<string[]> {
  return withDb(async (db) => {
    const rows = await db.getAllAsync<{ date: string }>(
      `SELECT date FROM sleep_logs
       UNION
       SELECT created_date AS date FROM todo_tasks
       UNION
       SELECT completed_date AS date FROM todo_tasks
       WHERE completed_date IS NOT NULL`,
    );
    return rows.map((r) => r.date);
  });
}

export async function getTodosForDate(viewDate: string): Promise<TodoTask[]> {
  return withDb((db) =>
    db.getAllAsync<TodoTask>(
      `SELECT * FROM todo_tasks
       WHERE created_date <= ?
         AND expires_date >= ?
         AND (completed_date IS NULL OR completed_date >= ?)
       ORDER BY created_date ASC, created_at ASC, id ASC`,
      [viewDate, viewDate, viewDate],
    ),
  );
}

export async function getAllTodos(): Promise<TodoTask[]> {
  return withDb((db) =>
    db.getAllAsync<TodoTask>(
      `SELECT * FROM todo_tasks
       ORDER BY created_date ASC, created_at ASC, id ASC`,
    ),
  );
}

export async function addTodoTask(
  date: string,
  title: string,
): Promise<TodoTask> {
  const trimmed = title.trim();
  const now = new Date().toISOString();
  const task: TodoTask = {
    id: generateTodoId(),
    title: trimmed,
    created_date: date,
    expires_date: addDaysToIsoDate(date, TODO_CARRYOVER_DAYS),
    created_at: now,
    updated_at: now,
    completed_date: null,
    completed_at: null,
  };

  await withDb(async (db) => {
    await db.runAsync(
      `INSERT INTO todo_tasks
        (id, title, created_date, expires_date, created_at, updated_at, completed_date, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`,
      [
        task.id,
        task.title,
        task.created_date,
        task.expires_date,
        task.created_at,
        task.updated_at,
      ],
    );
  });

  return task;
}

export async function updateTodoTitle(id: string, title: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  const now = new Date().toISOString();
  await withDb(async (db) => {
    await db.runAsync(
      `UPDATE todo_tasks SET title = ?, updated_at = ? WHERE id = ?`,
      [trimmed, now, id],
    );
  });
}

export async function toggleTodoCompleted(
  id: string,
  viewDate: string,
): Promise<void> {
  const now = new Date().toISOString();
  await withDb(async (db) => {
    const existing = await db.getFirstAsync<TodoTask>(
      "SELECT * FROM todo_tasks WHERE id = ?",
      [id],
    );
    if (!existing) return;

    const nextCompletedDate = existing.completed_date === null ? viewDate : null;
    const nextCompletedAt = existing.completed_date === null ? now : null;
    await db.runAsync(
      `UPDATE todo_tasks
       SET completed_date = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`,
      [nextCompletedDate, nextCompletedAt, now, id],
    );
  });
}

export async function deleteTodoTask(id: string): Promise<void> {
  await withDb(async (db) => {
    await db.runAsync("DELETE FROM todo_tasks WHERE id = ?", [id]);
  });
}

export async function deleteSleepLog(date: string) {
  const now = new Date().toISOString();
  await withDb(async (db) => {
    await db.runAsync("DELETE FROM sleep_log_edits WHERE log_date = ?", [date]);

    await db.runAsync("DELETE FROM body_care_logs WHERE date = ?", [date]);

    await db.runAsync("DELETE FROM sleep_logs WHERE date = ?", [date]);

    await db.runAsync("DELETE FROM todo_tasks WHERE created_date = ?", [date]);

    await db.runAsync(
      `UPDATE todo_tasks
       SET completed_date = NULL, completed_at = NULL, updated_at = ?
       WHERE completed_date = ?`,
      [now, date],
    );
  });
}

export async function getAllLogs() {
  return withDb((db) =>
    db.getAllAsync<SleepLog>("SELECT * FROM sleep_logs ORDER BY date ASC"),
  );
}

export async function getAllEdits() {
  return withDb((db) =>
    db.getAllAsync<SleepLogEdit>(
      "SELECT * FROM sleep_log_edits ORDER BY log_date ASC, edit_index ASC",
    ),
  );
}

export async function importLogs(
  logs: { date: string; hours: number; mood: number; comment: string }[],
) {
  const now = new Date().toISOString();
  await withDb(async (db) => {
    await db.withTransactionAsync(async () => {
      for (const sql of CLEAR_ALL_DATA_SQL) {
        await db.runAsync(sql);
      }
      for (const log of logs) {
        await db.runAsync(
          `INSERT INTO sleep_logs (date, hours, mood, comment, logged, logged_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(date) DO UPDATE SET hours=?, mood=?, comment=?, updated_at=?`,
          [
            log.date,
            log.hours,
            log.mood,
            log.comment,
            now,
            now,
            log.hours,
            log.mood,
            log.comment,
            now,
          ],
        );
      }
    });
  });
}

type DiscussionTopicRow = {
  id: string;
  week_key: string;
  title: string;
  description: string;
  completed: number;
  completed_at: string | null;
  created_date: string;
  created_at: string;
  updated_at: string;
};

function mapDiscussionTopicRow(row: DiscussionTopicRow): DiscussionTopic {
  return {
    id: row.id,
    week_key: row.week_key,
    title: row.title,
    description: row.description,
    completed: row.completed === 1,
    completed_at: row.completed_at,
    created_date: row.created_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getAllLoggedWeekKeys(): Promise<string[]> {
  return withDb(async (db) => {
    const rows = await db.getAllAsync<{ week_key: string }>(
      "SELECT DISTINCT week_key FROM discussion_topics ORDER BY week_key ASC",
    );
    return rows.map((r) => r.week_key);
  });
}

export async function getAllWeekTopicSummaries(): Promise<
  Record<string, WeekTopicSummary>
> {
  return withDb(async (db) => {
    const rows = await db.getAllAsync<{
      week_key: string;
      title: string;
      completed: number;
    }>(
      `SELECT week_key, title, completed
       FROM discussion_topics
       ORDER BY created_at ASC, rowid ASC`,
    );
    const map: Record<string, WeekTopicSummary> = {};
    for (const r of rows) {
      let entry = map[r.week_key];
      if (!entry) {
        entry = {
          totalCount: 0,
          openCount: 0,
          doneCount: 0,
          firstOpenTitle: null,
          firstTitle: null,
        };
        map[r.week_key] = entry;
      }
      entry.totalCount += 1;
      if (!entry.firstTitle) {
        entry.firstTitle = r.title;
      }
      if (r.completed === 1) {
        entry.doneCount += 1;
      } else {
        entry.openCount += 1;
        if (!entry.firstOpenTitle) {
          entry.firstOpenTitle = r.title;
        }
      }
    }
    return map;
  });
}

export async function getTopicsForWeek(
  weekKey: string,
): Promise<DiscussionTopic[]> {
  return withDb(async (db) => {
    const rows = await db.getAllAsync<DiscussionTopicRow>(
      `SELECT * FROM discussion_topics
       WHERE week_key = ?
       ORDER BY created_at ASC, rowid ASC`,
      [weekKey],
    );
    return rows.map(mapDiscussionTopicRow);
  });
}

export async function getWeekLastEdited(weekKey: string): Promise<string | null> {
  return withDb(async (db) => {
    const row = await db.getFirstAsync<{ latest: string | null }>(
      `SELECT MAX(updated_at) as latest FROM discussion_topics WHERE week_key = ?`,
      [weekKey],
    );
    return row?.latest ?? null;
  });
}

export async function getAllDiscussionTopics(): Promise<DiscussionTopic[]> {
  return withDb(async (db) => {
    const rows = await db.getAllAsync<DiscussionTopicRow>(
      `SELECT * FROM discussion_topics
       ORDER BY week_key ASC, created_at ASC, rowid ASC`,
    );
    return rows.map(mapDiscussionTopicRow);
  });
}

export async function addDiscussionTopic(
  weekKey: string,
  title: string,
  description: string,
  createdDate: string,
): Promise<DiscussionTopic> {
  const id = generateDiscussionTopicId();
  const now = new Date().toISOString();
  await withDb(async (db) => {
    await db.runAsync(
      `INSERT INTO discussion_topics
       (id, week_key, title, description, completed, completed_at, created_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?)`,
      [id, weekKey, title, description, createdDate, now, now],
    );
  });
  return {
    id,
    week_key: weekKey,
    title,
    description,
    completed: false,
    completed_at: null,
    created_date: createdDate,
    created_at: now,
    updated_at: now,
  };
}

export async function updateDiscussionTopic(
  id: string,
  title: string,
  description: string,
): Promise<void> {
  const now = new Date().toISOString();
  await withDb(async (db) => {
    await db.runAsync(
      `UPDATE discussion_topics
       SET title = ?, description = ?, updated_at = ?
       WHERE id = ?`,
      [title, description, now, id],
    );
  });
}

export async function toggleDiscussionTopicCompleted(
  id: string,
): Promise<void> {
  const now = new Date().toISOString();
  await withDb(async (db) => {
    const existing = await db.getFirstAsync<{ completed: number }>(
      "SELECT completed FROM discussion_topics WHERE id = ?",
      [id],
    );
    if (!existing) return;
    const nextCompleted = existing.completed === 1 ? 0 : 1;
    const nextCompletedAt = nextCompleted === 1 ? now : null;
    await db.runAsync(
      `UPDATE discussion_topics
       SET completed = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`,
      [nextCompleted, nextCompletedAt, now, id],
    );
  });
}

export async function moveDiscussionTopic(
  id: string,
  targetWeekKey: string,
): Promise<void> {
  const now = new Date().toISOString();
  await withDb(async (db) => {
    await db.runAsync(
      `UPDATE discussion_topics
       SET week_key = ?, updated_at = ?
       WHERE id = ?`,
      [targetWeekKey, now, id],
    );
  });
}

export async function deleteDiscussionTopic(id: string): Promise<void> {
  await withDb(async (db) => {
    await db.runAsync("DELETE FROM discussion_topics WHERE id = ?", [id]);
  });
}

export async function deleteWeekDiscussionTopics(
  weekKey: string,
): Promise<void> {
  await withDb(async (db) => {
    await db.runAsync("DELETE FROM discussion_topics WHERE week_key = ?", [
      weekKey,
    ]);
  });
}

export async function importBackup(
  logs: {
    date: string;
    hours: number;
    mood: number;
    comment: string;
    logged_at?: string | null;
    updated_at?: string | null;
  }[],
  edits: Omit<SleepLogEdit, "id">[],
  bodyCareLogs: {
    date: string;
    product_id: string;
    amounts?: BodyCareAmounts;
    updated_at?: string | null;
  }[] = [],
  rawTodos: unknown = [],
  rawDiscussionTopics: unknown = [],
) {
  const now = new Date().toISOString();
  const sanitizedTodos = sanitizeImportedTodos(rawTodos, now);
  const sanitizedTopics = sanitizeImportedDiscussionTopics(
    rawDiscussionTopics,
    now,
  );

  const editsByDate = new Map<string, typeof edits>();
  for (const e of edits) {
    if (!editsByDate.has(e.log_date)) editsByDate.set(e.log_date, []);
    editsByDate.get(e.log_date)!.push(e);
  }

  await withDb(async (db) => {
    await db.withTransactionAsync(async () => {
      for (const sql of CLEAR_ALL_DATA_SQL) {
        await db.runAsync(sql);
      }

      for (const log of logs) {
        const loggedAt = log.logged_at ?? now;
        const updatedAt = log.updated_at ?? now;

        await db.runAsync(
          `INSERT INTO sleep_logs (date, hours, mood, comment, logged, logged_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
             hours=?, mood=?, comment=?, logged_at=?, updated_at=?`,
          [
            log.date,
            log.hours,
            log.mood,
            log.comment,
            loggedAt,
            updatedAt,
            log.hours,
            log.mood,
            log.comment,
            loggedAt,
            updatedAt,
          ],
        );

        const dateEdits = editsByDate.get(log.date) ?? [];

        for (const edit of dateEdits) {
          await db.runAsync(
            `INSERT INTO sleep_log_edits
        (log_date, edit_index, edited_at,
         prev_hours, new_hours, prev_mood, new_mood, prev_comment, new_comment,
         changed_hours, changed_mood, changed_comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(log_date, edit_index) DO UPDATE SET
         edited_at = excluded.edited_at,
         prev_hours = excluded.prev_hours,
         new_hours = excluded.new_hours,
         prev_mood = excluded.prev_mood,
         new_mood = excluded.new_mood,
         prev_comment = excluded.prev_comment,
         new_comment = excluded.new_comment,
         changed_hours = excluded.changed_hours,
         changed_mood = excluded.changed_mood,
         changed_comment = excluded.changed_comment`,
            [
              edit.log_date,
              edit.edit_index,
              edit.edited_at,
              edit.prev_hours,
              edit.new_hours,
              edit.prev_mood,
              edit.new_mood,
              edit.prev_comment,
              edit.new_comment,
              edit.changed_hours,
              edit.changed_mood,
              edit.changed_comment,
            ],
          );
        }
      }

      for (const bodyCare of bodyCareLogs) {
        if (!bodyCare?.date || !bodyCare?.product_id) continue;
        await db.runAsync(
          `INSERT INTO body_care_logs
      (date, product_id, amounts_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       product_id = excluded.product_id,
       amounts_json = excluded.amounts_json,
       updated_at = excluded.updated_at`,
          [
            bodyCare.date,
            bodyCare.product_id,
            JSON.stringify(bodyCare.amounts ?? {}),
            bodyCare.updated_at ?? now,
          ],
        );
      }

      for (const todo of sanitizedTodos) {
        await db.runAsync(
          `INSERT INTO todo_tasks
            (id, title, created_date, expires_date, created_at, updated_at, completed_date, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             created_date = excluded.created_date,
             expires_date = excluded.expires_date,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at,
             completed_date = excluded.completed_date,
             completed_at = excluded.completed_at`,
          [
            todo.id,
            todo.title,
            todo.created_date,
            todo.expires_date,
            todo.created_at,
            todo.updated_at,
            todo.completed_date,
            todo.completed_at,
          ],
        );
      }

      for (const topic of sanitizedTopics) {
        await db.runAsync(
          `INSERT INTO discussion_topics
            (id, week_key, title, description, completed, completed_at, created_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             week_key = excluded.week_key,
             title = excluded.title,
             description = excluded.description,
             completed = excluded.completed,
             completed_at = excluded.completed_at,
             created_date = excluded.created_date,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at`,
          [
            topic.id,
            topic.week_key,
            topic.title,
            topic.description,
            topic.completed ? 1 : 0,
            topic.completed_at,
            topic.created_date,
            topic.created_at,
            topic.updated_at,
          ],
        );
      }
    });
  });
}

export async function getExportDateBounds(
  includeBodyCare: boolean,
): Promise<{ minDate: string | null; maxDate: string | null }> {
  return withDb(async (db) => {
    const candidates: (string | null | undefined)[] = [];

    const sleepBounds = await db.getFirstAsync<{
      min_d: string | null;
      max_d: string | null;
    }>("SELECT MIN(date) AS min_d, MAX(date) AS max_d FROM sleep_logs");
    candidates.push(sleepBounds?.min_d, sleepBounds?.max_d);

    if (includeBodyCare) {
      const bcBounds = await db.getFirstAsync<{
        min_d: string | null;
        max_d: string | null;
      }>("SELECT MIN(date) AS min_d, MAX(date) AS max_d FROM body_care_logs");
      candidates.push(bcBounds?.min_d, bcBounds?.max_d);
    }

    const todoBounds = await db.getFirstAsync<{
      min_d: string | null;
      max_d: string | null;
    }>(
      "SELECT MIN(created_date) AS min_d, MAX(created_date) AS max_d FROM todo_tasks",
    );
    candidates.push(todoBounds?.min_d, todoBounds?.max_d);

    const topicBounds = await db.getFirstAsync<{
      min_d: string | null;
      max_d: string | null;
      min_w: string | null;
      max_w: string | null;
    }>(
      "SELECT MIN(created_date) AS min_d, MAX(created_date) AS max_d, MIN(week_key) AS min_w, MAX(week_key) AS max_w FROM discussion_topics",
    );
    candidates.push(topicBounds?.min_d, topicBounds?.max_d);
    for (const wk of [topicBounds?.min_w, topicBounds?.max_w]) {
      if (!wk) continue;
      const parsed = parseWeekKey(wk);
      if (!parsed) continue;
      const range = getWeekDateRange(parsed.weekYear, parsed.week);
      candidates.push(range.startDateStr, range.endDateStr);
    }

    return computeMinMaxIsoDates(candidates);
  });
}
