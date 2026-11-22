import assert from "node:assert";
import test from "node:test";
import type { TodoTask } from "../src/components/sleep-modal/todo.utils.ts";
import {
  buildCsvExportContent,
  buildJsonExportPayload,
  buildTxtExportContent,
  CSV_HEADER,
} from "../src/lib/export-utils.ts";

const csvEscape = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

function pageToHour(page: number, hoursCenter = 30, maxHours = 24) {
  const diff = page - hoursCenter;
  return ((diff % (maxHours + 1)) + (maxHours + 1)) % (maxHours + 1);
}

function pageToYearMonth(
  page: number,
  baseYear: number,
  baseMonth: number,
  centerPage = 60,
) {
  const diff = page - centerPage;
  const total = baseYear * 12 + baseMonth + diff;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return { year, month };
}

test("csvEscape handles special characters and escaping", () => {
  assert.strictEqual(csvEscape(null), "");
  assert.strictEqual(csvEscape(undefined), "");
  assert.strictEqual(csvEscape("simple text"), "simple text");
  assert.strictEqual(csvEscape(42), "42");
  assert.strictEqual(
    csvEscape('contains "quotes"'),
    '"contains ""quotes"""',
  );
  assert.strictEqual(
    csvEscape("contains, comma"),
    '"contains, comma"',
  );
  assert.strictEqual(
    csvEscape("multi\nline"),
    '"multi\nline"',
  );
});

test("pageToHour maps pager index to 0..24 range cyclically", () => {
  assert.strictEqual(pageToHour(30), 0); // Center is 0 hours
  assert.strictEqual(pageToHour(38), 8); // +8 pages
  assert.strictEqual(pageToHour(54), 24); // +24 pages
  assert.strictEqual(pageToHour(55), 0); // wraps around to 0
  assert.strictEqual(pageToHour(29), 24); // -1 page wraps to 24
});

test("pageToYearMonth computes correct month and year offsets", () => {
  const baseYear = 2026;
  const baseMonth = 9; // October (0-indexed: 9)

  // Current page
  const current = pageToYearMonth(60, baseYear, baseMonth);
  assert.deepStrictEqual(current, { year: 2026, month: 9 });

  // Next month
  const nextMonth = pageToYearMonth(61, baseYear, baseMonth);
  assert.deepStrictEqual(nextMonth, { year: 2026, month: 10 }); // November

  // +3 months -> January 2027
  const jan2027 = pageToYearMonth(63, baseYear, baseMonth);
  assert.deepStrictEqual(jan2027, { year: 2027, month: 0 });

  // -10 months -> December 2025
  const dec2025 = pageToYearMonth(50, baseYear, baseMonth);
  assert.deepStrictEqual(dec2025, { year: 2025, month: 11 });
});

function extractUriFromIntentData(raw: string): string {
  if (raw.startsWith("content://") || raw.startsWith("file://")) {
    return raw;
  }
  const match = raw.match(/dat=([^\s}]+)/);
  if (match) {
    let uri = match[1];
    if (uri.startsWith("content:/") && !uri.startsWith("content://")) {
      uri = "content://" + uri.slice("content:/".length);
    }
    return uri;
  }
  return raw;
}

test("extractUriFromIntentData parses raw Intent string into valid content URI", () => {
  const androidIntentString =
    "Intent { dat=content:/com.android.externalstorage.documents/document/primary%3ADownload%2Fsleepinapp.json flg=0x43 xflg=0x4 }";
  const extracted = extractUriFromIntentData(androidIntentString);
  assert.strictEqual(
    extracted,
    "content://com.android.externalstorage.documents/document/primary%3ADownload%2Fsleepinapp.json",
  );

  const directContentUri = "content://com.android.providers.downloads.documents/document/123";
  assert.strictEqual(extractUriFromIntentData(directContentUri), directContentUri);

  const directFileUri = "file:///storage/emulated/0/Download/test.txt";
  assert.strictEqual(extractUriFromIntentData(directFileUri), directFileUri);
});

const SAMPLE_LOGS = [
  {
    date: "2026-10-01",
    hours: 7,
    mood: 6,
    comment: "old day without todos",
    logged_at: "2026-10-01T22:00:00.000Z",
    updated_at: "2026-10-01T22:00:00.000Z",
  },
  {
    date: "2026-11-16",
    hours: 8,
    mood: 8,
    comment: "monday log",
    logged_at: "2026-11-16T22:00:00.000Z",
    updated_at: "2026-11-16T22:00:00.000Z",
  },
  {
    date: "2026-11-17",
    hours: 6,
    mood: 7,
    comment: "tuesday log",
    logged_at: "2026-11-17T22:00:00.000Z",
    updated_at: "2026-11-17T22:00:00.000Z",
  },
  {
    date: "2026-11-19",
    hours: 7,
    mood: 5,
    comment: "thursday log",
    logged_at: "2026-11-19T22:00:00.000Z",
    updated_at: "2026-11-19T22:00:00.000Z",
  },
];

const SAMPLE_TODOS: TodoTask[] = [
  {
    id: "todo_1",
    title: "make music",
    created_date: "2026-11-16",
    expires_date: "2026-11-19",
    created_at: "2026-11-16T10:00:00.000Z",
    updated_at: "2026-11-17T14:00:00.000Z",
    completed_date: "2026-11-17",
    completed_at: "2026-11-17T14:00:00.000Z",
  },
  {
    id: "todo_2",
    title: "study for a test",
    created_date: "2026-11-16",
    expires_date: "2026-11-19",
    created_at: "2026-11-16T12:00:00.000Z",
    updated_at: "2026-11-16T12:00:00.000Z",
    completed_date: null,
    completed_at: null,
  },
];

test("buildTxtExportContent appends added, completed, and missed tasks while leaving old days clean", () => {
  const txt = buildTxtExportContent({
    logs: SAMPLE_LOGS,
    edits: [],
    bodyCareLogs: [],
    todos: SAMPLE_TODOS,
    startDate: "",
    endDate: "",
    moodStarsEnabled: true,
    bodyCareEnabled: false,
    commentsEnabled: true,
    todoListEnabled: true,
    todayDate: "2026-11-22",
  });

  // Old day without todos should not contain any Tasks headers
  const oldDayBlock = txt.split("---------------------------")[0];
  assert.ok(oldDayBlock.includes("Date: 2026-10-01"));
  assert.ok(!oldDayBlock.includes("Tasks"));

  // Monday shows 2 added tasks with names & timestamps
  assert.ok(txt.includes("Tasks Added (2):"));
  assert.ok(txt.includes('"make music" (2026-11-16T10:00:00.000Z)'));
  assert.ok(txt.includes('"study for a test" (2026-11-16T12:00:00.000Z)'));

  // Tuesday shows completed task
  assert.ok(txt.includes("Tasks Completed (1):"));
  assert.ok(txt.includes('"make music" (completed 2026-11-17T14:00:00.000Z)'));

  // Thursday (created_date + 3) shows task not completed in time
  assert.ok(txt.includes("Tasks Not Completed In Time (1):"));
  assert.ok(
    txt.includes(
      '"study for a test" (added 2026-11-16T12:00:00.000Z, expired after 2026-11-19)',
    ),
  );
});

test("buildTxtExportContent excludes sleep-less todo-only dates", () => {
  const txt = buildTxtExportContent({
    logs: [SAMPLE_LOGS[0]],
    edits: [],
    bodyCareLogs: [],
    todos: SAMPLE_TODOS,
    startDate: "",
    endDate: "",
    moodStarsEnabled: true,
    bodyCareEnabled: false,
    commentsEnabled: true,
    todoListEnabled: true,
    todayDate: "2026-11-22",
  });

  assert.ok(!txt.includes("2026-11-16"));
  assert.ok(!txt.includes("Tasks Added"));
});

test("buildCsvExportContent aligns columns and exports todo status & creation timestamps", () => {
  const csv = buildCsvExportContent({
    logs: [SAMPLE_LOGS[0]],
    edits: [],
    bodyCareLogs: [],
    todos: SAMPLE_TODOS,
    startDate: "",
    endDate: "",
    moodStarsEnabled: true,
    bodyCareEnabled: false,
    commentsEnabled: true,
    todoListEnabled: true,
    todayDate: "2026-11-22",
  });

  const lines = csv.split("\n");
  assert.strictEqual(lines.length, 4); // header + 1 log + 2 todos
  for (const line of lines) {
    const cells = line.slice(1, -1).split('","');
    assert.strictEqual(cells.length, CSV_HEADER.length);
  }

  assert.ok(lines[2].includes('"todo","2026-11-16"'));
  assert.ok(lines[2].includes('"make music","yes","completed","2026-11-16T10:00:00.000Z","2026-11-17T14:00:00.000Z","2026-11-19"'));
  assert.ok(lines[3].includes('"study for a test","no","not_completed","2026-11-16T12:00:00.000Z","","2026-11-19"'));
});

test("buildJsonExportPayload includes todos alongside existing backup fields", () => {
  const payload = buildJsonExportPayload({
    exportedAt: "2026-11-22T18:00:00.000Z",
    logs: SAMPLE_LOGS,
    edits: [],
    bodyCareLogs: [],
    todos: SAMPLE_TODOS,
    bodyCareEnabled: false,
  });

  assert.strictEqual(payload.logs.length, SAMPLE_LOGS.length);
  assert.strictEqual(payload.todos.length, SAMPLE_TODOS.length);
});

