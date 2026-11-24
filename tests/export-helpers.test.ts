import assert from "node:assert";
import test from "node:test";
import type { TodoTask } from "../src/components/sleep-modal/todo.utils.ts";
import type { DiscussionTopic } from "../src/components/to-discuss/to-discuss.utils.ts";
import {
  buildCsvExportContent,
  buildJsonExportPayload,
  buildTxtExportContent,
  computeMinMaxIsoDates,
  CSV_HEADER,
  formatExportDateRangeLabel,
  isoDateToUtcMidnightIso,
  utcDateToIsoDate,
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
  assert.deepStrictEqual(payload.discussionTopics, []);
});

const SAMPLE_TOPICS: DiscussionTopic[] = [
  {
    id: "topic_1",
    week_key: "2026-W47",
    title: "sleep onset worry",
    description: "talk about Sunday anxiety\nand racing thoughts",
    completed: true,
    completed_at: "2026-11-21T16:00:00.000Z",
    created_date: "2026-11-18",
    created_at: "2026-11-18T10:00:00.000Z",
    updated_at: "2026-11-21T16:00:00.000Z",
  },
];

test("buildTxtExportContent appends discussion topics at the end of each week", () => {
  const txt = buildTxtExportContent({
    logs: SAMPLE_LOGS,
    edits: [],
    bodyCareLogs: [],
    todos: [],
    discussionTopics: SAMPLE_TOPICS,
    startDate: "",
    endDate: "",
    moodStarsEnabled: true,
    bodyCareEnabled: false,
    commentsEnabled: true,
    todoListEnabled: false,
    todayDate: "2026-11-22",
  });

  const thursdayIdx = txt.indexOf("Date: 2026-11-19");
  const weekIdx = txt.indexOf("Week W47 (2026-11-16 to 2026-11-22) - Weekly Recaps (1):");
  assert.ok(thursdayIdx !== -1 && weekIdx > thursdayIdx);
  assert.ok(txt.includes("- [x] sleep onset worry (completed 2026-11-21T16:00:00.000Z)"));
  assert.ok(txt.includes("talk about Sunday anxiety"));
  assert.ok(txt.includes("and racing thoughts"));
});

test("buildCsvExportContent emits discussion rows by created_date and preserves column count", () => {
  const csv = buildCsvExportContent({
    logs: [SAMPLE_LOGS[0]],
    edits: [],
    bodyCareLogs: [],
    todos: [],
    discussionTopics: SAMPLE_TOPICS,
    startDate: "",
    endDate: "",
    moodStarsEnabled: true,
    bodyCareEnabled: false,
    commentsEnabled: true,
    todoListEnabled: false,
    todayDate: "2026-11-22",
  });

  // Parse quoted CSV records (descriptions may contain embedded newlines)
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"' && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  records.push(row);

  assert.strictEqual(records.length, 3);
  for (const r of records) {
    assert.strictEqual(r.length, CSV_HEADER.length);
  }
  assert.strictEqual(records[2][0], "discussion");
  assert.strictEqual(records[2][1], "2026-11-18");
  assert.ok(records[2].includes("2026-W47"));
  assert.ok(records[2].includes("sleep onset worry"));
  assert.ok(records[2].includes("talk about Sunday anxiety\nand racing thoughts"));
  assert.ok(records[2].includes("yes"));
  assert.ok(records[2].includes("2026-11-18T10:00:00.000Z"));
});

test("native date range picker ISO helpers roundtrip dates cleanly in UTC", () => {
  assert.strictEqual(
    isoDateToUtcMidnightIso("2026-11-23"),
    "2026-11-23T00:00:00.000Z",
  );
  assert.strictEqual(isoDateToUtcMidnightIso(""), null);
  assert.strictEqual(isoDateToUtcMidnightIso("2026-1-2"), null);

  assert.strictEqual(
    utcDateToIsoDate(new Date("2026-11-23T00:00:00.000Z")),
    "2026-11-23",
  );
  assert.strictEqual(utcDateToIsoDate(null), "");
  assert.strictEqual(utcDateToIsoDate(new Date("invalid")), "");

  assert.strictEqual(formatExportDateRangeLabel("", ""), "all time");
  assert.strictEqual(
    formatExportDateRangeLabel("2026-01-01", "2026-11-23"),
    "2026-01-01 -> 2026-11-23",
  );
  assert.strictEqual(
    formatExportDateRangeLabel("2026-01-01", ""),
    "from 2026-01-01",
  );
  assert.strictEqual(
    formatExportDateRangeLabel("", "2026-11-23"),
    "until 2026-11-23",
  );

  assert.deepStrictEqual(
    computeMinMaxIsoDates([
      null,
      undefined,
      "bad-date",
      "2026-11-18",
      "2026-09-03",
      "2026-12-01",
    ]),
    { minDate: "2026-09-03", maxDate: "2026-12-01" },
  );
  assert.deepStrictEqual(computeMinMaxIsoDates([null, "invalid"]), {
    minDate: null,
    maxDate: null,
  });
});

