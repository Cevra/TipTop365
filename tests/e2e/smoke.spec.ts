import { expect, test } from '@playwright/test';

// Smoke coverage of the E0.4 locale routing. Feature E2E (booking, cleaner job,
// admin) arrive at their gates (G3/G4/G9).
test.describe('locale routing smoke', () => {
  test('/ redirects to a locale-prefixed path', async ({ page }) => {
    // next-intl detects the browser Accept-Language, so a real browser may land
    // on /en while a header-less client (curl) falls to the default /bs. The
    // contract we assert here is only that the root always gets a locale prefix.
    await page.goto('/');
    await expect(page).toHaveURL(/\/(bs|en)$/);
  });

  test('English home renders English nav', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByRole('link', { name: 'Services' })).toBeVisible();
  });

  test('Bosnian home renders Bosnian nav', async ({ page }) => {
    await page.goto('/bs');
    await expect(page.getByRole('link', { name: 'Usluge' })).toBeVisible();
  });

  test('anonymous visit to a protected route redirects to login', async ({ page }) => {
    await page.goto('/bs/book-service');
    await expect(page).toHaveURL(/\/bs\/login/);
  });
});
