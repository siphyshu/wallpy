// The whole journey across roles (creator, moderator, visitor), moving between
// pages only by clicking what a person would click: upload by zip, changes
// requested, notice, resubmit, approve, find in the gallery, report, take down.
// Run on purpose only:  npm run test:e2e:journey   (SHOTS=dir for screenshots)
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { BASE, COOKIE_NAME, cleanup, makeUser, runId } from './helpers.mjs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const JSZip = require('jszip');
const OUT = process.env.SHOTS;
if (OUT) mkdirSync(OUT, { recursive: true });

const log = [];
let n = 0;
async function step(page, label, fn) {
  n++;
  try {
    await fn();
    log.push(`ok   ${n}. ${label}`);
  } catch (e) {
    log.push(`FAIL ${n}. ${label}: ${String(e.message).split('\n')[0]}`);
    if (OUT) await page.screenshot({ path: `${OUT}/fail-${n}.png`, scale: 'css' }).catch(() => {});
    throw e;
  }
}
const shot = (page, name) => (OUT ? page.screenshot({ path: `${OUT}/${String(n).padStart(2, '0')}-${name}.png`, scale: 'css' }) : null);

// Open the avatar menu and click an item.
async function menu(page, item) {
  const avatar = page.locator('a[href^="/profile/"]:has(img)').first();
  await avatar.hover();
  let link = page.getByRole('link', { name: item, exact: true }).or(page.getByRole('button', { name: item, exact: true }));
  await link.first().click();
  await page.waitForLoadState('networkidle');
  await page.mouse.move(5, 600);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const as = async (user) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: COOKIE_NAME, value: user.cookieValue, url: BASE }]);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log.push(`page error: ${e.message}`));
  return p;
};

try {
  const creator = await makeUser('walkc');
  const mod = await makeUser('walkm', { role: 'moderator' });
  const visitor = await makeUser('walkv');
  const c = await as(creator);
  const title = `Walk Harbour ${runId}`;

  // --- Creator: upload via zip import -------------------------------------
  await step(c, 'creator: home → avatar menu → Upload', async () => {
    await c.goto(BASE, { waitUntil: 'networkidle' });
    await menu(c, 'Upload');
    await c.getByText('Already have a pack ready?').first().waitFor();
  });
  await step(c, 'creator: import a zip of samples/harbour-lights', async () => {
    const zip = new JSZip();
    const dir = new URL('../../../samples/harbour-lights', import.meta.url).pathname;
    zip.file('schedule.toml', readFileSync(`${dir}/schedule.toml`));
    for (const f of readdirSync(`${dir}/images`)) zip.file(`images/${f}`, readFileSync(`${dir}/images/${f}`));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await c.locator('input[type=file][accept*="zip"]').setInputFiles({ name: 'harbour.zip', mimeType: 'application/zip', buffer });
    await c.getByText('Pack Information').first().waitFor({ timeout: 20_000 });
    await shot(c, 'details-after-import');
  });
  await step(c, 'creator: fill details (title, category, AI) → Next through to review', async () => {
    const t = c.getByLabel(/Title/);
    await t.fill(title);
    await c.getByRole('button', { name: 'Cities', exact: true }).click();
    await c.getByRole('button', { name: 'No AI', exact: true }).click();
    // Import lands on details (step 3): Next → schedule → review.
    for (let i = 0; i < 2; i++) {
      await c.getByRole('button', { name: 'Next', exact: true }).click();
      await c.waitForTimeout(500);
    }
    await shot(c, 'review');
  });
  await step(c, 'creator: upload → lands on pack page "waiting for review"', async () => {
    await c.getByRole('button', { name: /Upload Wallpack/ }).click();
    await c.waitForURL(/\/packs\//, { timeout: 90_000 });
    await c.getByText(/Waiting for review/i).first().waitFor();
    await shot(c, 'pending-pack');
  });
  const packUrl = c.url();
  await step(c, 'creator: avatar menu → Profile shows "In review"', async () => {
    await menu(c, 'Profile');
    await c.getByText('In review', { exact: true }).first().waitFor();
  });

  // --- Moderator: request changes -----------------------------------------
  const m = await as(mod);
  await step(m, 'moderator: avatar menu → Review queue → card for the pack', async () => {
    await m.goto(BASE, { waitUntil: 'networkidle' });
    await menu(m, 'Moderation');
    await m.getByRole('link', { name: title }).first().waitFor();
    await shot(m, 'queue');
  });
  await step(m, 'moderator: request changes with a note', async () => {
    const card = m.locator('article', { hasText: title });
    await card.getByRole('button', { name: 'Request changes' }).click();
    await card.locator('textarea').fill('Walk test: please add a dawn image.');
    await card.getByRole('button', { name: 'Send back with note' }).click();
    await card.waitFor({ state: 'detached', timeout: 20_000 });
  });

  // --- Creator: notice → make changes → resubmit ---------------------------
  await step(c, 'creator: dot on avatar → Notices shows the note', async () => {
    await c.goto(BASE, { waitUntil: 'networkidle' });
    await c.getByTestId('notices-dot').waitFor({ timeout: 10_000 });
    await menu(c, 'Notices');
    await c.getByText(/please add a dawn image/).first().waitFor();
    await shot(c, 'notices');
  });
  await step(c, 'creator: notice → pack → "Make changes" → resubmit v2', async () => {
    await c.getByRole('link', { name: title }).first().click();
    await c.waitForURL(/\/packs\//);
    await c.getByRole('link', { name: 'Make changes' }).click();
    await c.waitForURL(/\/edit/);
    for (let i = 0; i < 3; i++) {
      await c.getByRole('button', { name: 'Next', exact: true }).click();
      await c.waitForTimeout(500);
    }
    await c.getByRole('button', { name: /Submit version 2/ }).click();
    await c.waitForURL((u) => !u.pathname.endsWith('/edit'), { timeout: 60_000 });
    await c.getByText(/Waiting for review/i).first().waitFor();
  });

  // --- Moderator: approve ---------------------------------------------------
  await step(m, 'moderator: queue → approve', async () => {
    await m.goto(BASE, { waitUntil: 'networkidle' });
    await menu(m, 'Moderation');
    const card = m.locator('article', { hasText: title });
    await card.getByRole('button', { name: 'Approve & publish' }).click();
    await card.waitFor({ state: 'detached', timeout: 20_000 });
  });

  // --- Visitor: find in gallery → report ----------------------------------
  const v = await as(visitor);
  await step(v, 'visitor: gallery → Cities → search → open pack → install command', async () => {
    await v.goto(`${BASE}/gallery`, { waitUntil: 'networkidle' });
    await v.getByRole('button', { name: 'Cities', exact: true }).click();
    await v.getByPlaceholder(/Search/).fill(title);
    await v.waitForTimeout(1500); await v.waitForLoadState('networkidle');
    await v.getByRole('link', { name: title }).first().click();
    await v.waitForURL(/\/packs\//);
    await v.getByText(/wallpy use /).first().waitFor();
    await shot(v, 'public-pack');
  });
  await step(v, 'visitor: report the pack', async () => {
    await v.getByRole('button', { name: 'Report this pack' }).click();
    const form = v.getByTestId('report-form');
    await form.locator('input[type=radio], button').filter({ hasText: /stolen|uncredited/i }).first().click().catch(async () => {
      await form.locator('select').selectOption({ index: 2 });
    });
    await form.getByRole('button', { name: 'Send report' }).click();
    await v.getByText(/You reported this pack/).first().waitFor();
  });

  // --- Moderator: reports tab → take down ---------------------------------
  await step(m, 'moderator: Reports tab → take down with a reason', async () => {
    await m.goto(BASE, { waitUntil: 'networkidle' });
    await menu(m, 'Moderation');
    await m.getByRole('link', { name: 'Reports' }).or(m.getByRole('tab', { name: 'Reports' })).first().click();
    const card = m.locator('article', { hasText: title });
    await card.getByRole('button', { name: 'Take down' }).click();
    await card.locator('textarea, input[type=text]').first().fill('Walk test takedown.');
    await card.getByRole('button', { name: /Take down/ }).last().click();
    await m.waitForTimeout(1500);
    await shot(m, 'reports-after');
  });

  // --- Creator: sees the takedown ------------------------------------------
  await step(c, 'creator: Notices shows the takedown; pack page shows the reason', async () => {
    await c.goto(BASE, { waitUntil: 'networkidle' });
    await menu(c, 'Notices');
    await c.getByText(/Walk test takedown/).first().waitFor();
    await c.goto(packUrl, { waitUntil: 'networkidle' });
    await c.getByText(/Taken down by a moderator/).first().waitFor();
    await shot(c, 'taken-down');
  });
  await step(v, 'visitor: the pack is gone for others', async () => {
    const res = await v.goto(packUrl);
    if (res.status() !== 404) throw new Error(`status ${res.status()}`);
  });
} catch {
  // logged in step()
} finally {
  await browser.close();
  await cleanup();
  console.log(log.join('\n'));
  const failed = log.some((l) => !l.startsWith('ok '));
  console.log(`\n${log.filter((l) => l.startsWith('ok ')).length}/${n} passed`);
  process.exit(failed ? 1 : 0);
}
