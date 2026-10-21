import assert from "node:assert";
import test from "node:test";

type BodyCareZone = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type BodyCareAmounts = Partial<Record<BodyCareZone, string>>;

const BODY_CARE_ZONES: BodyCareZone[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

function calculateTotalUses(amounts: BodyCareAmounts): number {
  return BODY_CARE_ZONES.reduce((sum, zone) => {
    const val = parseInt(amounts[zone] || "0", 10);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}

function parseAmountsJson(jsonStr: string): BodyCareAmounts {
  try {
    return JSON.parse(jsonStr) as BodyCareAmounts;
  } catch {
    return {};
  }
}

test("BODY_CARE_ZONES covers exactly the 4 blade quadrants", () => {
  assert.strictEqual(BODY_CARE_ZONES.length, 4);
  assert.deepStrictEqual(BODY_CARE_ZONES, [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ]);
});

test("calculateTotalUses sums uses across all 4 zones correctly", () => {
  const amounts: BodyCareAmounts = {
    "top-left": "2",
    "top-right": "1",
    "bottom-left": "3",
    "bottom-right": "0",
  };
  assert.strictEqual(calculateTotalUses(amounts), 6);
});

test("calculateTotalUses handles missing or invalid amounts gracefully", () => {
  assert.strictEqual(calculateTotalUses({}), 0);
  assert.strictEqual(
    calculateTotalUses({ "top-left": "invalid", "top-right": "4" }),
    4,
  );
});

test("parseAmountsJson parses valid JSON and recovers safely from corrupted JSON", () => {
  const valid = JSON.stringify({ "top-left": "5" });
  assert.deepStrictEqual(parseAmountsJson(valid), { "top-left": "5" });

  assert.deepStrictEqual(parseAmountsJson("invalid-json{"), {});
  assert.deepStrictEqual(parseAmountsJson(""), {});
});
