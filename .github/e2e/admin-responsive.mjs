import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001/api/v1';
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

async function assertCompetitionReadModels(page) {
  const paths = [
    `/competitions/${competitionFixtureId}`,
    `/competitions/${competitionFixtureId}/draw-workspace`,
    `/competitions/${competitionFixtureId}/results-workspace`,
    `/competitions/${competitionFixtureId}/history`,
    `/competitions/${competitionFixtureId}/champion`,
  ];
  const results = await page.evaluate(async ({ root, requestedPaths }) => Promise.all(requestedPaths.map(async (path) => {
    const response = await fetch(`${root}${path}`, { cache: 'no-store', credentials: 'include' });
    return { body: (await response.text()).slice(0, 800), path, status: response.status };
  })), { requestedPaths: paths, root: apiUrl });
  for (const result of results) {
    assert(result.status >= 200 && result.status < 300, `Competition read model ${result.path} failed with HTTP ${result.status}: ${result.body}`);
  }
}

async function apiGet(page, path) {
  const result = await page.evaluate(async ({ root, target }) => {
    const response = await fetch(`${root}${target}`, { cache: 'no-store', credentials: 'include' });
    return { body: await response.text(), status: response.status };
  }, { root: apiUrl, target: path });
  assert(result.status >= 200 && result.status < 300, `GET ${path} failed with HTTP ${result.status}: ${result.body.slice(0, 800)}`);
  return result.body.trim().length === 0 ? null : JSON.parse(result.body);
}

async function apiPost(page, path, body) {
  const result = await page.evaluate(async ({ payload, root, target }) => {
    const prefix = 'oes_csrf=';
    const token = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
    if (token === undefined) return { body: 'Missing CSRF cookie', status: 0 };
    const response = await fetch(`${root}${target}`, {
      body: JSON.stringify(payload),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
        'X-CSRF-Token': decodeURIComponent(token),
      },
      method: 'POST',
    });
    return { body: await response.text(), status: response.status };
  }, { payload: body, root: apiUrl, target: path });
  assert(result.status >= 200 && result.status < 300, `POST ${path} failed with HTTP ${result.status}: ${result.body.slice(0, 800)}`);
  return result.body.trim().length === 0 ? null : JSON.parse(result.body);
}

async function prepareGroupStageFixture(page) {
  const detail = await apiGet(page, `/competitions/${competitionFixtureId}`);
  assert(detail !== null && typeof detail.revision === 'number', 'Competition fixture must expose a revision.');

  const prepared = await apiPost(page, `/competitions/${competitionFixtureId}/draw-workspace/prepare`, { expectedRevision: detail.revision });
  const configuration = prepared?.configuration;
  assert(configuration !== null && configuration !== undefined, 'Prepared group draw must expose a configuration.');

  const executed = await apiPost(page, `/draw-configurations/${configuration.id}/execute`, { expectedRevision: configuration.revision });
  const execution = executed?.execution;
  assert(execution !== null && execution !== undefined, 'Executed group draw must expose an execution.');

  await apiPost(page, `/official-draws/${execution.id}/confirm`, { expectedRevision: execution.revision });
  let results = await apiGet(page, `/competitions/${competitionFixtureId}/results-workspace`);
  assert(results !== null && Array.isArray(results.groups) && results.groups.length === 2, 'Confirmed group draw must expose exactly two groups.');

  for (const group of results.groups) {
    const match = results.matches.find((candidate) => candidate.group?.id === group.id);
    assert(match !== undefined, `Group ${group.label} must expose at least one match.`);
    results = await apiPost(page, `/matches/${match.id}/results`, { profile: 'SCORE_BASED', scoreA: 2, scoreB: 0 });
    const recorded = results.matches.find((candidate) => candidate.id === match.id)?.result;
    assert(recorded !== null && recorded !== undefined, `Group ${group.label} result must be recorded.`);
    results = await apiPost(page, `/results/${recorded.id}/confirm`, { expectedRevision: recorded.revision });
  }
}

async function assertGroupStageGeometry(page) {
  const tables = [
    page.getByRole('table', { name: 'Tabla del grupo A' }),
    page.getByRole('table', { name: 'Tabla del grupo B' }),
  ];
  await Promise.all(tables.map((table) => table.waitFor()));
  const groupGeometry = await page.getByLabel('Fase de grupos', { exact: true }).evaluate((stage) => {
    const cards = [...stage.children].filter((child) => child instanceof HTMLElement);
    return cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { bottom: rect.bottom, left: rect.left, top: rect.top, width: rect.width };
    });
  });
  assert(groupGeometry.length === 2, `Group stage must render two vertical group cards, received ${groupGeometry.length}.`);
  assert(groupGeometry[1].top > groupGeometry[0].bottom, 'Group B must render below Group A without horizontal/carousel layout.');
  assert(Math.abs(groupGeometry[1].left - groupGeometry[0].left) <= 2, 'Group cards must share the same left alignment.');

  for (const table of tables) {
    const metrics = await table.evaluate((element) => {
      const wrapper = element.parentElement;
      if (!(wrapper instanceof HTMLElement)) return null;
      return {
        clientWidth: wrapper.clientWidth,
        scrollWidth: wrapper.scrollWidth,
        tableWidth: element.getBoundingClientRect().width,
        wrapperWidth: wrapper.getBoundingClientRect().width,
      };
    });
    assert(metrics !== null, 'Group standings wrapper must be measurable.');
    assert(metrics.scrollWidth <= metrics.clientWidth + 1, `Group table must not require horizontal scroll: ${metrics.scrollWidth}px > ${metrics.clientWidth}px.`);
    assert(metrics.tableWidth <= metrics.wrapperWidth + 1, `Group table must fit its container: ${metrics.tableWidth}px > ${metrics.wrapperWidth}px.`);
  }
}

async function assertSportsOperationsGeometry(page, label) {
  const scoreboards = page.locator('[aria-label*=" contra "]');
  const scoreboardCount = await scoreboards.count();
  assert(scoreboardCount >= 4, `Sports workspace must expose multiple match scoreboards, received ${scoreboardCount}.`);

  const scoreboardMetrics = await scoreboards.first().evaluate((scoreboard) => {
    const rect = scoreboard.getBoundingClientRect();
    const parent = scoreboard.parentElement;
    return {
      clientWidth: scoreboard.clientWidth,
      parentWidth: parent instanceof HTMLElement ? parent.getBoundingClientRect().width : 0,
      scrollWidth: scoreboard.scrollWidth,
      width: rect.width,
    };
  });
  assert(scoreboardMetrics.scrollWidth <= scoreboardMetrics.clientWidth + 1, `${label} scoreboard must not overflow horizontally.`);
  assert(scoreboardMetrics.width <= scoreboardMetrics.parentWidth + 1, `${label} scoreboard must fit inside its match card.`);

  const loadButton = page.getByRole('button', { name: 'Cargar resultado' }).first();
  await loadButton.waitFor();
  await loadButton.click();
  const editor = page.getByLabel('Marcador reglamentario');
  await editor.waitFor();
  const inputMetrics = await editor.locator('input[type="number"]').evaluateAll((inputs) => inputs.map((input) => {
    const rect = input.getBoundingClientRect();
    return { height: rect.height, width: rect.width };
  }));
  assert(inputMetrics.length === 2, `${label} score editor must expose exactly two numeric score inputs.`);
  for (const metrics of inputMetrics) {
    assert(metrics.height >= 50, `${label} score input height is too small: ${metrics.height}px.`);
    assert(metrics.width >= 44, `${label} score input width is too small: ${metrics.width}px.`);
  }
  await assertNoHorizontalOverflow(page, `${label} result entry`);
}

async function closeResultEntry(page) {
  const cancel = page.getByRole('button', { name: 'Cancelar' }).first();
  await cancel.waitFor();
  await cancel.click();
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

  await prepareGroupStageFixture(page);
  await assertCompetitionReadModels(page);
  await page.goto(`${baseUrl}/competitions/${competitionFixtureId}`, { waitUntil: 'networkidle' });
  await screenshot(page, 'competition-detail-before-assertions');
  await page.getByRole('heading', { name: 'Puntuación y desempates' }).waitFor();
  await page.getByRole('heading', { name: 'Perfil de puntuación' }).waitFor();
  await page.getByRole('heading', { name: 'Orden de desempate' }).waitFor();
  await page.getByText('Plantilla inmutable').waitFor();
  await page.getByRole('heading', { name: 'Recorrido completo' }).waitFor();
  await page.getByText('Resultados y fase de grupos').waitFor();
  await assertNoHorizontalOverflow(page, 'desktop competition detail');
  await assertDesktopShellGeometry(page);
  await assertCompetitionRulesGeometry(page);
  await assertGroupStageGeometry(page);
  await screenshot(page, 'desktop-group-stage-results');
  await assertSportsOperationsGeometry(page, 'desktop');
  await screenshot(page, 'desktop-result-entry');
  await closeResultEntry(page);
  await screenshot(page, 'desktop-competition-detail');

  await page.setViewportSize({ height: 844, width: 390 });
  await assertNoHorizontalOverflow(page, 'mobile competition detail');
  await page.getByRole('heading', { name: 'Perfil de puntuación' }).waitFor();
  await page.getByRole('heading', { name: 'Orden de desempate' }).waitFor();
  await assertGroupStageGeometry(page);
  await assertSportsOperationsGeometry(page, 'mobile');
  await screenshot(page, 'mobile-result-entry');
  await closeResultEntry(page);
  await screenshot(page, 'mobile-group-stage-results');
  await screenshot(page, 'mobile-competition-detail');
} finally {
  await context.close();
  await browser.close();
}
