import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000';
const email = process.env.E2E_SUPERADMIN_EMAIL;
const password = process.env.E2E_SUPERADMIN_PASSWORD;
const outputDir = process.env.E2E_SCREENSHOT_DIR ?? 'artifacts/visual-e2e';

if (!email || !password) throw new Error('E2E superadmin credentials are required.');

await mkdir(outputDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(metrics.scrollWidth <= metrics.clientWidth + 1, `${label} has horizontal overflow: ${metrics.scrollWidth}px > ${metrics.clientWidth}px`);
}

async function screenshot(page, name) {
  await page.screenshot({ fullPage: true, path: `${outputDir}/${name}.png` });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { height: 844, width: 390 } });
const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Correo institucional').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await page.waitForURL('**/dashboard');
  await screenshot(page, 'post-login-dashboard');
  await page.getByRole('heading', { level: 1, name: 'Centro de operaciones' }).waitFor();
  await assertNoHorizontalOverflow(page, 'mobile dashboard');
  await screenshot(page, 'mobile-dashboard');

  const menu = page.getByRole('button', { name: 'Abrir navegación' });
  await menu.click();
  const closeToggle = page.locator('button[aria-controls="workspace-navigation"][aria-expanded="true"]');
  await closeToggle.waitFor();
  await page.waitForFunction(() => {
    const navigation = document.querySelector('#workspace-navigation');
    if (!(navigation instanceof HTMLElement)) return false;
    return navigation.getBoundingClientRect().x >= -1;
  });
  await screenshot(page, 'mobile-navigation');
  await page.locator('button[aria-label="Cerrar navegación"]:not([aria-controls])').click();

  await page.goto(`${baseUrl}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 2, name: 'Usuarios' }).waitFor();
  await page.getByText('E2E Superadmin').first().waitFor();
  await assertNoHorizontalOverflow(page, 'mobile users');
  await screenshot(page, 'mobile-users');

  await page.setViewportSize({ height: 1180, width: 820 });
  await assertNoHorizontalOverflow(page, 'tablet users');
  await screenshot(page, 'tablet-users');

  await page.setViewportSize({ height: 768, width: 1024 });
  await assertNoHorizontalOverflow(page, 'small desktop users');
  await screenshot(page, 'small-desktop-users');

  await page.setViewportSize({ height: 900, width: 1440 });
  await assertNoHorizontalOverflow(page, 'desktop users');
  await screenshot(page, 'desktop-users');

  const usersLink = page.getByRole('link', { name: /Usuarios/ });
  const settingsLink = page.getByRole('link', { name: /Configuración/ });
  assert(await usersLink.count() === 1, 'SUPERADMIN must see Usuarios navigation.');
  assert(await settingsLink.count() === 1, 'SUPERADMIN must see Configuración navigation.');
} finally {
  await context.close();
  await browser.close();
}
