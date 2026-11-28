// Read-only guest check. --candidate serves just the local landing page; the APK
// always comes from the public domain. This emulates a phone, not Android's installer.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
const { chromium, devices } = createRequire(import.meta.url)(process.env.BB_PLAYWRIGHT || 'playwright-core');
const origin = 'https://bonzobyte.com';
const url = origin + '/android', filename = 'BonzoByte-0.1.2.apk';
const expected = await readFile(new URL('../public/downloads/' + filename, import.meta.url));
const browser = await chromium.launch({ executablePath: process.env.BB_BROWSER || undefined });
try {
    const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 360, height: 800 },
        locale: 'hr-HR', javaScriptEnabled: false });
    const page = await context.newPage();
    if (process.argv.includes('--candidate')) await page.route(url, route => route.fulfill({
        path: fileURLToPath(new URL('../public/android.html', import.meta.url)), contentType: 'text/html; charset=utf-8'
    }));
    const response = await page.goto(url);
    assert.equal(response.status(), 200);
    const button = page.getByRole('link', { name: 'Preuzmi APK', exact: true });
    const rect = await button.boundingBox();
    assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= 360 && rect.height >= 48);
    const [download] = await Promise.all([page.waitForEvent('download'), button.tap()]);
    assert.equal(download.suggestedFilename(), filename);
    assert.equal(download.url(), origin + '/downloads/' + filename);
    assert.equal(await download.failure(), null);
    const bytes = await readFile(await download.path());
    assert.ok(bytes.equals(expected));
    console.log(JSON.stringify({ guest: true, emulatedPhone: true, filename, bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex') }));
} finally { await browser.close(); }
