import { test, expect } from '@playwright/test';

/**
 * Minimal E2E test for the public Help Center frontend.
 * 
 * Just verifies the homepage loads. Full e2e testing is done on the backend.
 */

test.describe('Public Help Center', () => {
  
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Page should have loaded without crashing
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Should have meaningful content (not just a blank page)
    const textContent = await body.textContent();
    expect(textContent?.length).toBeGreaterThan(50);
  });

});
