import { expect, it } from "vitest";
import { eatInput, eatToIso } from "../src/domain";
it("keeps explicit EAT timestamps independent of browser timezone and preserves seconds", () => {
  const date = new Date("2026-10-15T19:48:35Z");
  expect(eatInput(date)).toBe("2026-10-15T22:48:35");
  expect(eatToIso(eatInput(date))).toBe(date.toISOString());
  expect(eatToIso("2026-10-15T22:48")).toBe("2026-10-15T19:48:00.000Z");
});
