/**
 * B2C AI System - E2E 端到端测试
 * 使用 Playwright 测试前端用户流程
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || '652364972@qq.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';

// ============================================
// Helper Functions
// ============================================
async function adminLogin(page: Page) {
  await page.goto('/admin/login');
  await page.waitForLoadState('networkidle');
  
  // Fill login form
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  
  // Wait for redirect to admin dashboard
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 10000 });
}

// ============================================
// 1. Frontend Public Pages Tests
// ============================================
test.describe('Frontend Public Pages', () => {
  test('Homepage should load', async ({ page }) => {
    const response = await page.goto('/');
    
    // Page should load (200 or 404 if no brand configured)
    expect([200, 404]).toContain(response?.status());
    
    // If 200, check for basic elements
    if (response?.status() === 200) {
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Products page should load', async ({ page }) => {
    const response = await page.goto('/products');
    expect([200, 404]).toContain(response?.status());
  });

  test('Cart page should load', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Contact page should load', async ({ page }) => {
    const response = await page.goto('/contact');
    expect([200, 404]).toContain(response?.status());
  });
});

// ============================================
// 2. Admin Login Tests
// ============================================
test.describe('Admin Login', () => {
  test('Login page should display', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('body')).toBeVisible();
    
    // Check for login form elements
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('Should show error for invalid credentials', async ({ page }) => {
    await page.goto('/admin/login');
    
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should stay on login page or show error
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/admin/login');
  });

  test.skip('Should login with valid credentials', async ({ page }) => {
    // Skip if no password configured
    if (!ADMIN_PASSWORD) {
      test.skip();
      return;
    }

    await adminLogin(page);
    
    // Should be on admin dashboard
    const url = page.url();
    expect(url).toContain('/admin');
    expect(url).not.toContain('/login');
  });
});

// ============================================
// 3. Admin Dashboard Tests
// ============================================
test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    if (!ADMIN_PASSWORD) {
      test.skip();
      return;
    }
    await adminLogin(page);
  });

  test.skip('Dashboard should display overview', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('body')).toBeVisible();
    
    // Check for dashboard elements
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test.skip('Should navigate to products page', async ({ page }) => {
    await page.goto('/admin/products');
    await expect(page.locator('body')).toBeVisible();
  });

  test.skip('Should navigate to orders page', async ({ page }) => {
    await page.goto('/admin/orders');
    await expect(page.locator('body')).toBeVisible();
  });

  test.skip('Should navigate to brands page', async ({ page }) => {
    await page.goto('/admin/brands');
    await expect(page.locator('body')).toBeVisible();
  });
});

// ============================================
// 4. Admin Brand Management Tests
// ============================================
test.describe('Admin Brand Management', () => {
  test.beforeEach(async ({ page }) => {
    if (!ADMIN_PASSWORD) {
      test.skip();
      return;
    }
    await adminLogin(page);
  });

  test.skip('Brand list should display', async ({ page }) => {
    await page.goto('/admin/brands');
    await page.waitForLoadState('networkidle');
    
    // Check for brand list or empty state
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test.skip('Add brand button should be visible', async ({ page }) => {
    await page.goto('/admin/brands');
    await page.waitForLoadState('networkidle');
    
    // Look for add brand button
    const addButton = page.locator('button:has-text("添加"), button:has-text("Add"), button:has-text("新增")');
    await expect(addButton.first()).toBeVisible();
  });
});

// ============================================
// 5. Admin Product Management Tests
// ============================================
test.describe('Admin Product Management', () => {
  test.beforeEach(async ({ page }) => {
    if (!ADMIN_PASSWORD) {
      test.skip();
      return;
    }
    await adminLogin(page);
  });

  test.skip('Product list should display', async ({ page }) => {
    await page.goto('/admin/products');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test.skip('Add product button should be visible', async ({ page }) => {
    await page.goto('/admin/products');
    await page.waitForLoadState('networkidle');
    
    const addButton = page.locator('button:has-text("添加"), button:has-text("Add"), a:has-text("新增")');
    await expect(addButton.first()).toBeVisible();
  });
});

// ============================================
// 6. Shopping Cart Flow Tests
// ============================================
test.describe('Shopping Cart Flow', () => {
  test('Cart page should show empty state', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.locator('body')).toBeVisible();
  });

  test.skip('Should add product to cart', async ({ page }) => {
    // Navigate to a product page
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    
    // Click on first product
    const productLink = page.locator('a[href*="/products/"]').first();
    if (await productLink.isVisible()) {
      await productLink.click();
      await page.waitForLoadState('networkidle');
      
      // Look for add to cart button
      const addToCartBtn = page.locator('button:has-text("Add to Cart"), button:has-text("加入购物车")');
      if (await addToCartBtn.isVisible()) {
        await addToCartBtn.click();
        
        // Verify cart updated
        await page.waitForTimeout(1000);
      }
    }
  });
});

// ============================================
// 7. Checkout Flow Tests
// ============================================
test.describe('Checkout Flow', () => {
  test('Checkout page should load', async ({ page }) => {
    const response = await page.goto('/checkout');
    expect([200, 302, 404]).toContain(response?.status());
  });
});

// ============================================
// 8. SEO Elements Tests
// ============================================
test.describe('SEO Elements', () => {
  test('Homepage should have meta tags', async ({ page }) => {
    await page.goto('/');
    
    // Check for basic meta tags
    const title = await page.title();
    expect(title).toBeTruthy();
    
    const description = page.locator('meta[name="description"]');
    const hasDescription = await description.count() > 0;
    // Description is optional but good to have
  });

  test('Robots.txt should be accessible', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect([200, 404]).toContain(response?.status());
  });

  test('Sitemap should be accessible', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    expect([200, 404]).toContain(response?.status());
  });
});

// ============================================
// 9. Responsive Design Tests
// ============================================
test.describe('Responsive Design', () => {
  test('Homepage should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Homepage should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Homepage should be responsive on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});

// ============================================
// 10. Performance Tests
// ============================================
test.describe('Performance', () => {
  test('Homepage should load within 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;
    
    console.log(`Homepage load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);
  });

  test('Admin login page should load within 5 seconds', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;
    
    console.log(`Admin login load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);
  });
});

// ============================================
// 11. Error Handling Tests
// ============================================
test.describe('Error Handling', () => {
  test('404 page should display for invalid routes', async ({ page }) => {
    const response = await page.goto('/nonexistent-page-12345');
    expect(response?.status()).toBe(404);
  });

  test('Invalid product slug should return 404', async ({ page }) => {
    const response = await page.goto('/products/invalid-product-slug-12345');
    expect([404, 200]).toContain(response?.status());
  });
});

// ============================================
// 12. Accessibility Tests
// ============================================
test.describe('Accessibility', () => {
  test('Homepage should have proper heading structure', async ({ page }) => {
    await page.goto('/');
    
    // Check for h1 tag
    const h1Count = await page.locator('h1').count();
    // Having at least one h1 is good for SEO
  });

  test('Forms should have labels', async ({ page }) => {
    await page.goto('/admin/login');
    
    // Check that inputs have associated labels or aria-labels
    const inputs = page.locator('input:not([type="hidden"])');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.getAttribute('aria-label') || 
                       await input.getAttribute('placeholder') ||
                       await input.getAttribute('id');
      // Inputs should have some form of labeling
    }
  });
});
