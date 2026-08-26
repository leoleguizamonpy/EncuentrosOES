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

async function assertGeneralChampionship(page, label) {
  await page.getByText('Campeonato General Universitarios 2026').waitFor();
  await page.getByRole('table', { name: 'Tabla del Campeonato General' }).waitFor();
  await page.getByText('Facultad de Filosofía UNA', { exact: true }).first().waitFor();
  await page.getByText('Mejor Hinchada', { exact: true }).waitFor();
  await page.getByText('Por confirmar', { exact: true }).waitFor();

  const table = page.getByRole('table', { name: 'Tabla del Campeonato General' });
  const tableMetrics = await table.evaluate((element) => {
    const wrapper = element.parentElement;
    const rect = element.getBoundingClientRect();
    const wrapperRect = wrapper?.getBoundingClientRect();
    return {
      tableRight: rect.right,
      tableWidth: rect.width,
      wrapperRight: wrapperRect?.right ?? rect.right,
      wrapperWidth: wrapperRect?.width ?? rect.width,
    };
  });
  assert(tableMetrics.tableRight <= tableMetrics.wrapperRight + 1, `${label} General Championship table must fit its wrapper.`);
  assert(tableMetrics.tableWidth <= tableMetrics.wrapperWidth + 1, `${label} General Championship table must not force horizontal scrolling.`);

  const summary = page.getByLabel('Resumen del Campeonato General');
  await summary.waitFor();
  const summaryBox = await summary.boundingBox();
  assert(summaryBox !== null && summaryBox.width > 0, `${label} General Championship summary must be visible.`);

  await assertNoHorizontalOverflow(page, `${label} General Championship`);
}

async function screenshot(page, name) {
  await page.screenshot({ fullPage: true, path: `${outputDir}/${name}.png` });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Correo institucional').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await page.waitForURL('**/dashboard');

  await page.goto(`${baseUrl}/general-championship`, { waitUntil: 'networkidle' });
  await assertGeneralChampionship(page, 'desktop');
  await screenshot(page, 'desktop-general-championship');

  await page.setViewportSize({ height: 844, width: 390 });
  await assertGeneralChampionship(page, 'mobile');
  await screenshot(page, 'mobile-general-championship');
} finally {
  await context.close();
  await browser.close();
}
