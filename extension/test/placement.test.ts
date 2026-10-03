import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => { Object.assign(globalThis, { innerWidth: 1000, innerHeight: 700 }); });

describe("placeNear", () => {
  it("keeps the menu fully on screen near every edge", async () => {
    const { placeNear } = await import("../src/content/selection");
    for (const rect of [
      { x: 0, y: 0, width: 50, height: 50 }, { x: 950, y: 650, width: 50, height: 50 },
      { x: 0, y: 600, width: 1000, height: 100 }, { x: 10, y: 10, width: 980, height: 680 },
    ]) {
      const p = placeNear(rect, 300, 220);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + 300).toBeLessThanOrEqual(1000);
      expect(p.y + 220).toBeLessThanOrEqual(700);
    }
  });
  it("docks when the selection covers the screen", async () => {
    const { placeNear } = await import("../src/content/selection");
    expect(placeNear({ x: 0, y: 0, width: 1000, height: 700 }, 300, 220).docked).toBe(true);
  });
});
