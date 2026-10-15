import { expect, test } from "@playwright/test";
for (const [name, width, height] of [
  ["desktop", 1440, 1000],
  ["tablet", 834, 1194],
  ["mobile", 390, 844],
] as const) {
  test(`supervisor dashboard and staff monitoring on ${name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto("/#overview");
    await expect(
      page.getByRole("heading", { name: "Overview", level: 1 }),
    ).toBeVisible();
    await expect(page.locator(".staff-row")).toHaveCount(2);
    expect(
      await page
        .getByRole("heading", { name: "Overview", level: 1 })
        .evaluate((el) => getComputedStyle(el).fontWeight),
    ).toBe("700");
    expect(
      await page
        .locator(".staff-identity strong")
        .first()
        .evaluate((el) => getComputedStyle(el).fontWeight),
    ).toBe("600");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`overview-${name}.png`),
      fullPage: true,
    });
    await page.getByRole("link", { name: "My team", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My team", level: 1 }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Find a team member" })
      .fill("Grace");
    await expect(page.locator(".staff-row")).toHaveCount(1);
    await page.locator(".staff-row").click();
    await expect(
      page.getByRole("heading", { name: "Grace M.", level: 1 }),
    ).toBeVisible();
    for (const row of await page.locator(".worklist-row").all())
      await expect(row).toContainText("Grace M.");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`staff-${name}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Profile and demo access" }).click();
    await page
      .getByRole("combobox", { name: "Demo team member" })
      .selectOption({ label: "Grace · CHW" });
    await expect(
      page.getByRole("heading", { name: "Overview", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "My team", exact: true }),
    ).toHaveCount(0);
    await page.goto("/#team");
    await expect(
      page.getByRole("heading", { name: "Supervisor access required" }),
    ).toBeVisible();
  });
}
