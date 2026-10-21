import * as SQLite from "expo-sqlite";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openFreshDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync("sleepinapp.db");
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
      CREATE INDEX IF NOT EXISTS idx_sleep_log_edits_date
      ON sleep_log_edits(log_date);
    `);

    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sleep_log_edits_unique
      ON sleep_log_edits(log_date, edit_index);
    `);
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
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  return withDb((db) =>
    db.getAllAsync<{ date: string }>(
      "SELECT date FROM sleep_logs WHERE date LIKE ?",
      [`${prefix}%`],
    ),
  );
}

export async function deleteSleepLog(date: string) {
  await withDb(async (db) => {
    await db.runAsync("DELETE FROM sleep_log_edits WHERE log_date = ?", [date]);

    await db.runAsync("DELETE FROM body_care_logs WHERE date = ?", [date]);

    await db.runAsync("DELETE FROM sleep_logs WHERE date = ?", [date]);
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
    for (const log of logs) {
      await db.runAsync("DELETE FROM body_care_logs WHERE date = ?", [
        log.date,
      ]);
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
) {
  const now = new Date().toISOString();

  const editsByDate = new Map<string, typeof edits>();
  for (const e of edits) {
    if (!editsByDate.has(e.log_date)) editsByDate.set(e.log_date, []);
    editsByDate.get(e.log_date)!.push(e);
  }

  const bodyCareByDate = new Map(
    bodyCareLogs.map((bodyCare) => [bodyCare.date, bodyCare]),
  );

  await withDb(async (db) => {
    for (const log of logs) {
      const loggedAt = log.logged_at ?? now;
      const updatedAt = log.updated_at ?? now;

      await db.runAsync("DELETE FROM body_care_logs WHERE date = ?", [
        log.date,
      ]);

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

      await db.runAsync("DELETE FROM sleep_log_edits WHERE log_date = ?", [
        log.date,
      ]);

      const dateEdits = editsByDate.get(log.date) ?? [];

      for (const edit of dateEdits) {
        await db.runAsync(
          `INSERT INTO sleep_log_edits
      (log_date, edit_index, edited_at,
       prev_hours, new_hours, prev_mood, new_mood, prev_comment, new_comment,
       changed_hours, changed_mood, changed_comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

      const bodyCare = bodyCareByDate.get(log.date);

      if (bodyCare?.product_id) {
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
    }
  });
}
