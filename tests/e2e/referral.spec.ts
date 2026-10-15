import { test, expect } from "@playwright/test";
test("one referral survives reload, is completed by the facility, and notifies the assigned CHW", async ({
  page,
}, testInfo) => {
  const alias = "Demo " + Date.now();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Keep every referral in view." }),
  ).toBeVisible();
  expect(
    await page
      .getByRole("heading", { name: "Keep every referral in view." })
      .evaluate((el) => getComputedStyle(el).fontWeight),
  ).toBe("700");
  expect(
    await page
      .locator(".referral-row strong")
      .first()
      .evaluate((el) => getComputedStyle(el).fontWeight),
  ).toBe("600");
  await page.screenshot({
    path: testInfo.outputPath("supervisor-queue.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "New referral", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "New referral", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("chw-form.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.getByLabel("Patient alias").fill(alias);
  await page
    .getByLabel("Receiving facility")
    .selectOption({ label: "Highland Demo Hospital" });
  await page.getByLabel("Assigned CHW").selectOption({ label: "Grace M." });
  await page.getByLabel("Referral note").fill("Synthetic end-to-end test");
  await page
    .getByRole("button", { name: "Create referral", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: alias + "’s referral" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: alias + "’s referral" }),
  ).toBeVisible();
  await page
    .getByLabel("Note", { exact: true })
    .fill("Transport follow-up assigned");
  await page
    .getByRole("button", { name: "Save follow-up", exact: true })
    .click();
  await expect(
    page.getByText("Follow-up recorded", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Demo team member" })
    .selectOption({ label: "Receiving team · Highland" });
  await page.getByRole("link").filter({ hasText: alias }).click();
  await page
    .getByRole("button", { name: "Open facility confirmation" })
    .click();
  await page
    .getByRole("button", { name: "Confirm arrival", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Record clinician contact", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Record clinician contact", exact: true })
    .click();
  await expect(page.getByLabel("Outcome category")).toBeVisible();
  await page
    .getByLabel("Outcome note")
    .fill("Assessment completed · synthetic test");
  await page
    .getByRole("button", { name: "Record outcome & notify CHW" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Outcome recorded", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Demo team member" })
    .selectOption({ label: "Grace · CHW" });
  await page.getByRole("link", { name: /Updates/ }).click();
  const notice = page.locator(".closure").filter({ hasText: alias });
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Acknowledge update" }).click();
  await expect(
    notice.getByRole("button", { name: "Acknowledged", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "An update for you." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("queue filtering, CSV export, and public-data failure work independently", async ({
  page,
}) => {
  await page.goto("/");
  const due = page.getByRole("button", { name: /Follow-up due ·/ });
  await expect(due).toBeVisible();
  const count = Number((await due.textContent())?.split("·")[1].trim());
  await due.click();
  await expect(page.locator(".referral-row")).toHaveCount(count);
  for (const row of await page.locator(".referral-row").all())
    await expect(row).toContainText("Follow-up due");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("tafu-synthetic-referrals.csv");
  await page.route("**/api/context", (route) =>
    route.fulfill({
      json: {
        source: "World Bank Indicators API",
        url: "https://api.worldbank.org",
        indicator: "Maternal mortality ratio",
        retrieved_at: new Date().toISOString(),
        status: "unavailable",
        value: null,
        year: null,
      },
    }),
  );
  await page.getByRole("button", { name: "Load public context" }).click();
  await expect(
    page.getByText(
      "The public source is unavailable. Referral records are unaffected.",
    ),
  ).toBeVisible();
  await expect(page.locator(".referral-row")).toHaveCount(count);
});
