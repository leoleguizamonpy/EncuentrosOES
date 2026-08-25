import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000';
const email = process.env.E2E_SUPERADMIN_EMAIL;
const password = process.env.E2E_SUPERADMIN_PASSWORD;
const outputDir = process.env.E2E_SCREENSHOT_DIR ?? 'artifacts/visual-e2e';
const competitionFixtureId = '96000000-0000-4000-8000-000000000001';

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

async function assertMobileNavigationStack(page) {
  const metrics = await page.evaluate(() => {
    const nav = document.querySelector('#workspace-navigation nav');
    if (!(nav instanceof HTMLElement)) return null;
    const items = [...nav.querySelectorAll('.nav-item')].map((item) => {
      const rect = item.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width };
    });
    return { navWidth: nav.getBoundingClientRect().width, items };
  });
  assert(metrics !== null, 'Mobile navigation must exist.');
  assert(metrics.items.length >= 8, 'Mobile navigation must expose the expected entries.');
  for (const item of metrics.items) {
    assert(Math.abs(item.left - metrics.items[0].left) <= 2, 'Mobile navigation items must stay in one vertical column.');
    assert(item.width >= metrics.navWidth - 4, 'Mobile navigation items must use the available navigation width.');
  }
  for (let index = 1; index < metrics.items.length; index += 1) {
    assert(metrics.items[index].top > metrics.items[index - 1].top, 'Mobile navigation entries must be vertically ordered.');
  }
}

async function assertDesktopShellGeometry(page) {
  const geometry = await page.evaluate(() => {
    const sidebar = document.querySelector('#workspace-navigation');
    const main = document.querySelector('#main-content');
    if (!(sidebar instanceof HTMLElement) || !(main instanceof HTMLElement)) return null;
    const sidebarRect = sidebar.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    return {
      mainLeft: mainRect.left,
      sidebarHeight: sidebarRect.height,
      sidebarLeft: sidebarRect.left,
      sidebarTop: sidebarRect.top,
      sidebarWidth: sidebarRect.width,
      viewportHeight: window.innerHeight,
    };
  });
  assert(geometry !== null, 'Desktop shell geometry must be measurable.');
  assert(geometry.sidebarLeft <= 1 && geometry.sidebarTop <= 1, 'Desktop sidebar must be anchored to the top-left edge.');
  assert(geometry.sidebarWidth >= 210 && geometry.sidebarWidth <= 270, `Desktop sidebar width is invalid: ${geometry.sidebarWidth}px.`);
  assert(geometry.sidebarHeight >= geometry.viewportHeight - 2, 'Desktop sidebar must span the viewport height.');
  assert(geometry.mainLeft >= geometry.sidebarWidth - 2, 'Desktop main content must render beside the sidebar, not below it.');
}

async function assertCompetitionRulesGeometry(page) {
  const geometry = await page.getByRole('heading', { name: 'Puntuación y desempates' }).evaluate((heading) => {
    const panel = heading.closest('section');
    const grid = panel?.parentElement;
    if (!(panel instanceof HTMLElement) || !(grid instanceof HTMLElement)) return null;
    const panelRect = panel.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    return { gridWidth: gridRect.width, panelLeft: panelRect.left, panelWidth: panelRect.width };
  });
  assert(geometry !== null, 'Competition rules panel geometry must be measurable.');
  assert(geometry.panelWidth >= geometry.gridWidth - 4, `Rules panel must span the competition grid: ${geometry.panelWidth}px of ${geometry.gridWidth}px.`);
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
  await assertMobileNavigationStack(page);
  await screenshot(page, 'mobile-navigation');
  await closeToggle.click();

  await page.goto(`${baseUrl}/admin/users`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 2, name: 'Usuarios' }).waitFor();
  await page.getByRole('button', { name: /E2E Superadmin/ }).waitFor();
  await assertNoHorizontalOverflow(page, 'mobile users');
  await screenshot(page, 'mobile-users');

  await page.setViewportSize({ height: 1180, width: 820 });
  await assertNoHorizontalOverflow(page, 'tablet users');
  await screenshot(page, 'tablet-users');

  await page.setViewportSize({ height: 768, width: 1024 });
  await assertNoHorizontalOverflow(page, 'small desktop users');
  await assertDesktopShellGeometry(page);
  await screenshot(page, 'small-desktop-users');

  await page.setViewportSize({ height: 900, width: 1440 });
  await assertNoHorizontalOverflow(page, 'desktop users');
  await assertDesktopShellGeometry(page);
  await screenshot(page, 'desktop-users');

  const usersLink = page.getByRole('link', { name: /Usuarios/ });
  const settingsLink = page.getByRole('link', { name: /Configuración/ });
  assert(await usersLink.count() === 1, 'SUPERADMIN must see Usuarios navigation.');
  assert(await settingsLink.count() === 1, 'SUPERADMIN must see Configuración navigation.');

  await page.goto(`${baseUrl}/competitions/${competitionFixtureId}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Puntuación y desempates' }).waitFor();
  await page.getByRole('heading', { name: 'Perfil de puntuación' }).waitFor();
  await page.getByRole('heading', { name: 'Orden de desempate' }).waitFor();
  await page.getByText('Plantilla inmutable').waitFor();
  await page.getByRole('heading', { name: 'Recorrido completo' }).waitFor();
  await assertNoHorizontalOverflow(page, 'desktop competition detail');
  await assertDesktopShellGeometry(page);
  await assertCompetitionRulesGeometry(page);
  await screenshot(page, 'desktop-competition-detail');

  await page.setViewportSize({ height: 844, width: 390 });
  await assertNoHorizontalOverflow(page, 'mobile competition detail');
  await page.getByRole('heading', { name: 'Perfil de puntuación' }).waitFor();
  await page.getByRole('heading', { name: 'Orden de desempate' }).waitFor();
  await screenshot(page, 'mobile-competition-detail');
} finally {
  await context.close();
  await browser.close();
}
