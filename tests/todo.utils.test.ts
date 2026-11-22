import assert from "node:assert";
import test from "node:test";
import {
  addDaysToIsoDate,
  formatTodoElapsedHours,
  getTodoOutcome,
  isTodoVisibleOnDate,
  sanitizeImportedTodos,
  sortTodosChronologically,
  type TodoTask,
} from "../src/components/sleep-modal/todo.utils.ts";

test("addDaysToIsoDate handles month and leap year rollovers cleanly", () => {
  assert.strictEqual(addDaysToIsoDate("2026-11-22", 3), "2026-11-25");
  assert.strictEqual(addDaysToIsoDate("2026-11-29", 3), "2026-12-02");
  assert.strictEqual(addDaysToIsoDate("2024-02-27", 3), "2024-03-01");
  assert.strictEqual(addDaysToIsoDate("2025-02-27", 3), "2025-03-02");
});

test("isTodoVisibleOnDate keeps unfinished tasks for creation day + 3 next days", () => {
  const monday = "2026-11-16";
  const task: TodoTask = {
    id: "t1",
    title: "make music",
    created_date: monday,
    expires_date: addDaysToIsoDate(monday, 3), // Thursday 2026-11-19
    created_at: "2026-11-16T10:00:00.000Z",
    updated_at: "2026-11-16T10:00:00.000Z",
    completed_date: null,
    completed_at: null,
  };

  assert.strictEqual(isTodoVisibleOnDate(task, "2026-11-15"), false); // Sunday
  assert.strictEqual(isTodoVisibleOnDate(task, "2026-11-16"), true); // Monday
  assert.strictEqual(isTodoVisibleOnDate(task, "2026-11-17"), true); // Tuesday
  assert.strictEqual(isTodoVisibleOnDate(task, "2026-11-18"), true); // Wednesday
  assert.strictEqual(isTodoVisibleOnDate(task, "2026-11-19"), true); // Thursday (+3)
  assert.strictEqual(isTodoVisibleOnDate(task, "2026-11-20"), false); // Friday (+4)
});

test("isTodoVisibleOnDate shows completed task through completed_date and hides afterwards", () => {
  const monday = "2026-11-16";
  const completedTuesday: TodoTask = {
    id: "t2",
    title: "learn baking",
    created_date: monday,
    expires_date: addDaysToIsoDate(monday, 3),
    created_at: "2026-11-16T10:00:00.000Z",
    updated_at: "2026-11-17T12:00:00.000Z",
    completed_date: "2026-11-17", // Tuesday
    completed_at: "2026-11-17T12:00:00.000Z",
  };

  assert.strictEqual(isTodoVisibleOnDate(completedTuesday, "2026-11-16"), true); // Monday
  assert.strictEqual(isTodoVisibleOnDate(completedTuesday, "2026-11-17"), true); // Tuesday
  assert.strictEqual(isTodoVisibleOnDate(completedTuesday, "2026-11-18"), false); // Wednesday
  assert.strictEqual(isTodoVisibleOnDate(completedTuesday, "2026-11-19"), false); // Thursday
});

test("formatTodoElapsedHours formats <1h, exact hours up to 96, and >96 cap", () => {
  const baseMs = Date.parse("2026-11-22T10:00:00.000Z");

  assert.strictEqual(
    formatTodoElapsedHours("2026-11-22T10:00:00.000Z", baseMs + 30 * 60_000),
    "(<1 hours ago)",
  );
  assert.strictEqual(
    formatTodoElapsedHours("2026-11-22T10:00:00.000Z", baseMs + 47 * 3_600_000),
    "(47 hours ago)",
  );
  assert.strictEqual(
    formatTodoElapsedHours("2026-11-22T10:00:00.000Z", baseMs + 96 * 3_600_000),
    "(96 hours ago)",
  );
  assert.strictEqual(
    formatTodoElapsedHours("2026-11-22T10:00:00.000Z", baseMs + 97 * 3_600_000),
    "(>96 hours ago)",
  );
});

test("sortTodosChronologically orders oldest to newest across dates and timestamps", () => {
  const todos: TodoTask[] = [
    {
      id: "b",
      title: "second today",
      created_date: "2026-11-22",
      expires_date: "2026-11-25",
      created_at: "2026-11-22T14:00:00.000Z",
      updated_at: "2026-11-22T14:00:00.000Z",
      completed_date: null,
      completed_at: null,
    },
    {
      id: "a",
      title: "yesterday",
      created_date: "2026-11-21",
      expires_date: "2026-11-24",
      created_at: "2026-11-21T20:00:00.000Z",
      updated_at: "2026-11-21T20:00:00.000Z",
      completed_date: null,
      completed_at: null,
    },
    {
      id: "c",
      title: "first today",
      created_date: "2026-11-22",
      expires_date: "2026-11-25",
      created_at: "2026-11-22T09:00:00.000Z",
      updated_at: "2026-11-22T09:00:00.000Z",
      completed_date: null,
      completed_at: null,
    },
  ];

  const sorted = sortTodosChronologically(todos);
  assert.deepStrictEqual(
    sorted.map((t) => t.id),
    ["a", "c", "b"],
  );
});

test("getTodoOutcome distinguishes completed, active, and expired tasks", () => {
  const active: TodoTask = {
    id: "t1",
    title: "active",
    created_date: "2026-11-20",
    expires_date: "2026-11-23",
    created_at: "2026-11-20T10:00:00.000Z",
    updated_at: "2026-11-20T10:00:00.000Z",
    completed_date: null,
    completed_at: null,
  };
  assert.strictEqual(getTodoOutcome(active, "2026-11-23"), "in_progress");
  assert.strictEqual(getTodoOutcome(active, "2026-11-24"), "not_completed");
  assert.strictEqual(
    getTodoOutcome({ ...active, completed_date: "2026-11-21" }, "2026-11-24"),
    "completed",
  );
});

test("sanitizeImportedTodos tolerates missing/legacy payloads and populates defaults", () => {
  assert.deepStrictEqual(sanitizeImportedTodos(undefined), []);
  assert.deepStrictEqual(sanitizeImportedTodos(null), []);

  const parsed = sanitizeImportedTodos(
    [
      { id: "legacy_1", title: "  valid task  ", created_date: "2026-11-10" },
      { title: "", created_date: "2026-11-10" },
      { title: "bad date", created_date: "not-a-date" },
    ],
    "2026-11-22T00:00:00.000Z",
  );

  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].id, "legacy_1");
  assert.strictEqual(parsed[0].title, "valid task");
  assert.strictEqual(parsed[0].expires_date, "2026-11-13");
  assert.strictEqual(parsed[0].completed_date, null);
});
