// E2E Automation Framework: Playwright (Node.js)
// Framed as a learner journey on the CipherSchools practice app
// Author: QA Engineer Intern Assignment

const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const path = require('path');
const fs   = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────
// Load from .env if present, otherwise fall back to .env.example values
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const exPath  = path.join(__dirname, '..', '.env.example');
  const file    = fs.existsSync(envPath) ? envPath : exPath;
  const lines   = fs.readFileSync(file, 'utf8').split('\n');
  const env     = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
  return env;
}

const cfg = loadEnv();
const BASE_URL       = cfg.BASE_URL       || 'https://with-bugs.practicesoftwaretesting.com';
const SEARCH_KEYWORD = cfg.SEARCH_KEYWORD || 'pliers';

// ── Unique test user generated per run ────────────────────────────────────────
const timestamp = Date.now();
const TEST_USER = {
  firstName : 'Arjun',
  lastName  : 'Mehra',
  email     : `arjun.mehra.${timestamp}@testlearner.dev`,
  password  : 'Learner@2024!',
  dob       : '1998-05-14',
  address   : '42 Knowledge Park, Sector 18',
  city      : 'Noida',
  state     : 'Uttar Pradesh',
  country   : 'India',
  postcode  : '201301',
  phone     : '9876543210',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
async function waitForNav(page, action) {
  await Promise.all([page.waitForLoadState('networkidle'), action()]);
}

async function screenshotOnFail(page, name) {
  const dir = path.join(__dirname, '..', 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}-${Date.now()}.png`), fullPage: true });
}

// ── Main Journey ──────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true, slowMo: 80 });
  const context = await browser.newContext({
    viewport     : { width: 1280, height: 800 },
    recordVideo  : undefined,
    userAgent    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅  ${message}`);
      passed++;
    } else {
      console.error(`  ❌  ASSERTION FAILED: ${message}`);
      failed++;
    }
  }

  try {
    // ── STEP 1 : Navigate to app ─────────────────────────────────────────────
    console.log('\n[STEP 1] Navigating to app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const title = await page.title();
    assert(title.length > 0, `Page loaded — title: "${title}"`);

    // ── STEP 2 : Register a new user ─────────────────────────────────────────
    console.log('\n[STEP 2] Registering new learner account...');
    await page.goto(`${BASE_URL}/#/auth/register`, { waitUntil: 'networkidle' });

    // Fill registration form robustly using aria-labels / placeholders
    await page.locator('[data-test="first-name"]').fill(TEST_USER.firstName);
    await page.locator('[data-test="last-name"]').fill(TEST_USER.lastName);
    await page.locator('[data-test="dob"]').fill(TEST_USER.dob);
    await page.locator('[data-test="address"]').fill(TEST_USER.address);
    await page.locator('[data-test="postcode"]').fill(TEST_USER.postcode);
    await page.locator('[data-test="city"]').fill(TEST_USER.city);
    await page.locator('[data-test="state"]').fill(TEST_USER.state);

    // Country select — wait for options to populate
    const countrySelect = page.locator('[data-test="country"]');
    await countrySelect.waitFor({ state: 'visible' });
    await countrySelect.selectOption({ label: 'India' });

    await page.locator('[data-test="phone"]').fill(TEST_USER.phone);
    await page.locator('[data-test="email"]').fill(TEST_USER.email);
    await page.locator('[data-test="password"]').fill(TEST_USER.password);

    await page.locator('[data-test="register-submit"]').click();

    // Wait for success redirect or confirmation message
    await page.waitForURL(/login|account/, { timeout: 10000 }).catch(() => {});
    const postRegUrl = page.url();
    assert(
      postRegUrl.includes('login') || postRegUrl.includes('account'),
      `Registration redirected to: ${postRegUrl}`
    );
    await screenshotOnFail(page, 'step2-registration');

    // ── STEP 3 : Log in with the new credentials ──────────────────────────────
    console.log('\n[STEP 3] Logging in with newly registered credentials...');
    await page.goto(`${BASE_URL}/#/auth/login`, { waitUntil: 'networkidle' });

    await page.locator('[data-test="email"]').fill(TEST_USER.email);
    await page.locator('[data-test="password"]').fill(TEST_USER.password);
    await page.locator('[data-test="login-submit"]').click();

    // Explicit wait for nav element that only appears when authenticated
    await page.waitForSelector('[data-test="nav-menu"]', { timeout: 10000 }).catch(() => {});
    const loggedInUrl = page.url();
    assert(
      !loggedInUrl.includes('/auth/login'),
      `User redirected away from login page after auth — URL: ${loggedInUrl}`
    );
    await screenshotOnFail(page, 'step3-login');

    // ── STEP 4 : Search for a course/product ─────────────────────────────────
    console.log(`\n[STEP 4] Searching for "${SEARCH_KEYWORD}"...`);
    const searchBox = page.locator('[data-test="search-query"]');
    await searchBox.waitFor({ state: 'visible' });
    await searchBox.fill(SEARCH_KEYWORD);

    const searchBtn = page.locator('[data-test="search-submit"]');
    await searchBtn.click();
    await page.waitForLoadState('networkidle');

    // Verify results are shown
    const resultCards = page.locator('[data-test="product"]');
    await resultCards.first().waitFor({ state: 'visible', timeout: 8000 });
    const resultCount = await resultCards.count();
    assert(resultCount > 0, `Search returned ${resultCount} result(s) for "${SEARCH_KEYWORD}"`);

    // Open the first result detail page
    await resultCards.first().click();
    await page.waitForLoadState('networkidle');
    const detailUrl = page.url();
    assert(
      detailUrl.includes('/product') || detailUrl.includes('/detail') || detailUrl !== BASE_URL,
      `Navigated to product detail page: ${detailUrl}`
    );
    await screenshotOnFail(page, 'step4-search-detail');

    // ── STEP 5 : Add course to enrollment basket ──────────────────────────────
    console.log('\n[STEP 5] Adding product to basket...');
    const addToCartBtn = page.locator('[data-test="add-to-cart"]');
    await addToCartBtn.waitFor({ state: 'visible', timeout: 8000 });

    // Capture basket count BEFORE adding
    const cartCountBefore = await page
      .locator('[data-test="cart-quantity"]')
      .textContent()
      .catch(() => '0');
    const countBefore = parseInt(cartCountBefore?.trim() || '0', 10);

    await addToCartBtn.click();

    // ── STEP 6 : Assert basket count increments ───────────────────────────────
    console.log('\n[STEP 6] Asserting basket item count increments...');

    // Smart wait: poll until the displayed number changes or timeout
    let countAfter = countBefore;
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const raw = await page
        .locator('[data-test="cart-quantity"]')
        .textContent()
        .catch(() => '0');
      countAfter = parseInt(raw?.trim() || '0', 10);
      if (countAfter > countBefore) break;
      await page.waitForTimeout(300);
    }

    // THIS ASSERTION MUST FAIL IF THE ENROLLMENT FLOW IS BROKEN
    assert(
      countAfter > countBefore,
      `Basket count incremented: ${countBefore} → ${countAfter}. Enrollment flow is working.`
    );

    if (countAfter <= countBefore) {
      console.error(
        `\n  🚨  CRITICAL: Basket count did NOT increment (before=${countBefore}, after=${countAfter}).`
      );
      console.error('      The enrollment/add-to-cart flow is BROKEN.\n');
    }
    await screenshotOnFail(page, 'step6-basket-count');

  } catch (err) {
    console.error('\n[FATAL ERROR]', err.message);
    await screenshotOnFail(page, 'fatal-error');
    failed++;
  } finally {
    await browser.close();
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  TOTAL PASSED : ${passed}`);
    console.log(`  TOTAL FAILED : ${failed}`);
    console.log(`${'─'.repeat(50)}\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
})();
