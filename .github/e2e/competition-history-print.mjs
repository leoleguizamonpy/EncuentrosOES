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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Correo institucional').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await page.waitForURL('**/dashboard');

  await page.goto(`${baseUrl}/competitions/${competitionFixtureId}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Recorrido completo' }).waitFor();
  await page.getByRole('button', { name: 'Imprimir historial' }).waitFor();

  await page.emulateMedia({ media: 'print' });
  await page.getByText('Historial competitivo', { exact: true }).waitFor();

  const printState = await page.evaluate(() => {
    const history = document.querySelector('#competition-history');
    const sidebar = document.querySelector('#workspace-navigation');
    const printHeading = [...document.querySelectorAll('*')].find((element) => element.textContent === 'Historial competitivo');
    if (!(history instanceof HTMLElement) || !(sidebar instanceof HTMLElement) || !(printHeading instanceof HTMLElement)) return null;
    return {
      historyDisplay: getComputedStyle(history).display,
      printHeadingDisplay: getComputedStyle(printHeading).display,
      sidebarDisplay: getComputedStyle(sidebar).display,
    };
  });

  assert(printState !== null, 'Printable history elements must be measurable.');
  assert(printState.historyDisplay !== 'none', 'Competition history must remain in the print layout.');
  assert(printState.sidebarDisplay === 'none', 'Workspace navigation must be removed from the print layout.');
  assert(printState.printHeadingDisplay !== 'none', 'Printable document heading must be visible.');

  await page.pdf({
    format: 'A4',
    landscape: true,
    path: `${outputDir}/competition-history-print.pdf`,
    printBackground: true,
  });
} finally {
  await context.close();
  await browser.close();
}
