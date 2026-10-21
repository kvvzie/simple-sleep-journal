import assert from "node:assert";
import test from "node:test";
import { GRID_STEPS } from "../src/constants/grid.ts";

test("GRID_STEPS has 5 predefined row and column configurations", () => {
  assert.strictEqual(GRID_STEPS.length, 5);
  assert.deepStrictEqual(GRID_STEPS[0], { rows: 4, columns: 8 });
  assert.deepStrictEqual(GRID_STEPS[1], { rows: 5, columns: 7 });
  assert.deepStrictEqual(GRID_STEPS[2], { rows: 6, columns: 6 });
  assert.deepStrictEqual(GRID_STEPS[3], { rows: 7, columns: 5 });
  assert.deepStrictEqual(GRID_STEPS[4], { rows: 8, columns: 4 });
});

test("Each GRID_STEP yields between 32 and 36 total cells", () => {
  for (const step of GRID_STEPS) {
    const total = step.rows * step.columns;
    assert.ok(
      total >= 32 && total <= 36,
      `Step ${step.rows}x${step.columns} has unexpected total cells: ${total}`,
    );
  }
});

test("columnsPageForStep and columnsStepForPage are inverse bijections", () => {
  const MAX_STEP = GRID_STEPS.length - 1;
  const columnsPageForStep = (idx: number) => MAX_STEP - idx;
  const columnsStepForPage = (page: number) => MAX_STEP - page;

  for (let i = 0; i <= MAX_STEP; i++) {
    const page = columnsPageForStep(i);
    assert.strictEqual(columnsStepForPage(page), i);
  }
});

test("Step index clamping preserves valid range [0, 4]", () => {
  const clampIndex = (index: number) =>
    Math.max(0, Math.min(GRID_STEPS.length - 1, index));

  assert.strictEqual(clampIndex(-5), 0);
  assert.strictEqual(clampIndex(0), 0);
  assert.strictEqual(clampIndex(2), 2);
  assert.strictEqual(clampIndex(4), 4);
  assert.strictEqual(clampIndex(10), 4);
});
