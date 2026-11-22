import assert from "node:assert/strict";
import test from "node:test";
import { getRadioDotMetrics } from "../src/components/animated-radio-dot/radio-dot.utils.ts";

test("getRadioDotMetrics scales cleanly and keeps inner dot comfortably inside the ring", () => {
  for (const size of [16, 22, 24, 32]) {
    const m = getRadioDotMetrics(size);
    assert.equal(m.boxSize, size);
    assert.ok(m.ringSize > 0 && m.ringSize < m.boxSize);
    assert.ok(m.strokeWidth >= 1.5);
    const innerDiameter = m.ringSize - m.strokeWidth * 2;
    assert.ok(m.dotSize > 0 && m.dotSize < innerDiameter);
  }
});

test("getRadioDotMetrics clamps tiny sizes to safe minimum bounds", () => {
  const tiny = getRadioDotMetrics(4);
  assert.equal(tiny.boxSize, 12);
  assert.ok(tiny.dotSize < tiny.ringSize - tiny.strokeWidth * 2);
});
