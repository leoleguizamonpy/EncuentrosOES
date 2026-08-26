import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001/api/v1';
const email = process.env.E2E_SUPERADMIN_EMAIL;
const password = process.env.E2E_SUPERADMIN_PASSWORD;
const outputDir = process.env.E2E_SCREENSHOT_DIR ?? 'artifacts/visual-e2e';
const competitionId = '96000000-0000-4000-8000-000000000001';

if (!email || !password) throw new Error('E2E superadmin credentials are required.');

await mkdir(outputDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Correo institucional').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
  await page.waitForURL('**/dashboard');
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

async function ensurePublished(page) {
  let workspace = await apiGet(page, `/competitions/${competitionId}/draw-workspace`);
  assert(workspace?.execution?.status === 'CONFIRMED', 'Print fixture requires a confirmed official draw.');
  if (workspace.publication === null) {
    workspace = await apiPost(page, `/official-draws/${workspace.execution.id}/publish`, { expectedRevision: workspace.execution.revision });
  }
  assert(workspace?.publication?.id, 'Published draw must expose a publication id.');
  assert(workspace.publication.verificationCode, 'Published draw must expose a verification code.');
  return workspace.publication;
}

async function assertPrintSurface(page, expectedId, expectedVerificationCode, pathLabel) {
  await page.emulateMedia({ media: 'print' });
  const footer = page.getByRole('contentinfo', { name: 'Identidad documental de impresión' });
  await footer.waitFor();
  await page.getByRole('img', { name: 'QR de verificación del origen público' }).waitFor();
  await page.getByText(`ID ${expectedId}`, { exact: true }).waitFor();
  if (expectedVerificationCode !== null) {
    await page.getByText(`SHA-256 ${expectedVerificationCode}`, { exact: true }).waitFor();
  }

  const metrics = await page.evaluate(() => {
    const action = document.querySelector('.print-action');
    const footerElement = document.querySelector('.print-document-footer');
    const qr = document.querySelector('.verification-qr');
    const root = document.documentElement;
    if (!(action instanceof HTMLElement) || !(footerElement instanceof HTMLElement) || !(qr instanceof SVGElement)) return null;
    const footerRect = footerElement.getBoundingClientRect();
    const qrRect = qr.getBoundingClientRect();
    return {
      actionDisplay: getComputedStyle(action).display,
      clientWidth: root.clientWidth,
      footerWidth: footerRect.width,
      qrHeight: qrRect.height,
      qrWidth: qrRect.width,
      scrollWidth: root.scrollWidth,
      sourceText: footerElement.textContent ?? '',
    };
  });

  assert(metrics !== null, `${pathLabel}: print metrics must be measurable.`);
  assert(metrics.actionDisplay === 'none', `${pathLabel}: print action must be hidden under print media.`);
  assert(metrics.scrollWidth <= metrics.clientWidth + 1, `${pathLabel}: print layout has horizontal overflow.`);
  assert(metrics.footerWidth <= metrics.clientWidth + 1, `${pathLabel}: document footer exceeds printable width.`);
  assert(metrics.qrWidth >= 80 && metrics.qrHeight >= 80, `${pathLabel}: verification QR is too small to be operational.`);
  assert(metrics.sourceText.includes(page.url()), `${pathLabel}: printed footer must preserve the canonical source URL.`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { height: 1123, width: 794 } });
const page = await context.newPage();

try {
  await login(page);
  const publication = await ensurePublished(page);

  await page.goto(`${baseUrl}/draws/${publication.id}`, { waitUntil: 'networkidle' });
  await assertPrintSurface(page, publication.id, publication.verificationCode, 'public draw');
  await page.screenshot({ fullPage: true, path: `${outputDir}/print-public-draw.png` });
  await page.pdf({
    format: 'A4',
    path: `${outputDir}/print-public-draw.pdf`,
    preferCSSPageSize: true,
    printBackground: true,
  });

  await page.goto(`${baseUrl}/competitions/${competitionId}/public`, { waitUntil: 'networkidle' });
  await assertPrintSurface(page, competitionId, publication.verificationCode, 'public competition');
  await page.screenshot({ fullPage: true, path: `${outputDir}/print-public-competition.png` });
  await page.pdf({
    format: 'A4',
    path: `${outputDir}/print-public-competition.pdf`,
    preferCSSPageSize: true,
    printBackground: true,
  });
} finally {
  await context.close();
  await browser.close();
}
