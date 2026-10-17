// End-to-end test of the upload wizard in a real (headless) Chrome: a
// throwaway user builds an Album pack through every step and submits it.
// Runs against a site at BASE (default http://localhost:3000) and the Supabase
// project / R2 bucket in .env.local; deletes everything it created.
// Run on purpose only:  npm run test:e2e:ui   (SHOTS=dir to keep screenshots)
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const JSZip = require('jszip');
const { chromium } = require('playwright-core');

const SAMPLES = new URL('../../../samples/', import.meta.url).pathname;

const E = process.env;
const BASE = E.BASE || 'http://localhost:3000';
const SHOTS = E.SHOTS;
const REF = new URL(E.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const admin = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const results = [];
const check = (label, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`); };

const runId = randomBytes(3).toString('hex');
let userId;
let browser;
try {
  // --- a signed-in throwaway user (session cookie in a fresh browser profile) ---
  const email = `e2e-ui-${runId}@example.com`;
  const password = 'E2e-' + randomBytes(9).toString('hex');
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { username: `e2e_ui_${runId}` },
  });
  if (error) throw error;
  userId = created.user.id;
  const anon = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const cookieValue = 'base64-' + Buffer.from(JSON.stringify(signedIn.session)).toString('base64url');

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ name: `sb-${REF}-auth-token`, value: cookieValue, url: BASE }]);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

  // --- test images: one with a name the pack format doesn't allow as-is ---
  const images = [];
  for (const [name, rgb] of [['Sunset 01 (final).JPG', '240,120,60'], ['night.jpg', '20,30,80'], ['dawn.jpg', '200,170,220']]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="rgb(${rgb})"/><text x="60" y="120" font-size="64" fill="white">${name} ${runId}</text></svg>`;
    images.push({ name, mimeType: 'image/jpeg', buffer: await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer() });
  }

  // 1. type
  await page.goto(`${BASE}/upload`, { waitUntil: 'networkidle' });
  check('signed-in user reaches the wizard', page.url().endsWith('/upload'));
  await page.getByRole('button', { name: 'Album', exact: true }).click();
  await shot('1-type');
  await page.getByText('Next', { exact: true }).click();

  // 2. details
  const next = page.getByText('Next', { exact: true });
  await page.getByPlaceholder('Enter a descriptive title').fill(`E2E Album ${runId}`);
  await page.getByPlaceholder(/comma separated/).fill('Test, Gradients, test');
  check('Next stays disabled until the AI question is answered', await next.isDisabled());
  await page.getByRole('button', { name: 'AI-assisted' }).click();
  check('Next stays disabled until a category is picked', await next.isDisabled());
  await page.getByRole('button', { name: 'Abstract', exact: true }).click();
  await page.getByRole('button', { name: 'Minimal', exact: true }).click();
  check('a third category can\'t be picked', await page.getByRole('button', { name: 'Space', exact: true }).isDisabled());
  check('one or two categories enable Next', await next.isEnabled());
  await shot('2-details');
  await next.click();

  // 3. files
  await page.locator('input[type=file]').setInputFiles(images);
  await page.getByText('Uploaded Files (3)').waitFor();
  check('file names are made spec-safe', await page.getByText('Sunset 01 final.jpg').first().isVisible());
  await shot('3-files');
  await next.click();

  // 4. schedule
  await page.getByRole('button', { name: 'Add All' }).click();
  await page.getByRole('button', { name: '30 min' }).click();
  check('interval preset selects', (await page.getByRole('button', { name: '30 min' }).getAttribute('aria-pressed')) === 'true');
  await shot('4-schedule');
  await next.click();

  // 5. submit
  await shot('5-review');
  await page.getByRole('button', { name: 'Upload Wallpack' }).click();
  await page.waitForURL(/\/packs\//, { timeout: 120_000 });
  await page.waitForLoadState('networkidle');
  const slug = new URL(page.url()).pathname.split('/').pop();
  check('submits and lands on the new pack page', slug.startsWith('e2e-album'), slug);
  check('owner sees the review banner', await page.getByText(/Waiting for review/).isVisible());
  check('AI-assisted label is shown', await page.getByText('AI-assisted', { exact: true }).isVisible());
  await shot('6-pack-page');

  const { data: version } = await admin
    .from('pack_versions')
    .select('status, kind, ai_use, tags, categories, schedule, files:version_files!version_files_version_id_fkey(path)')
    .eq('pack_id', (await admin.from('packs').select('id').eq('slug', slug).single()).data.id)
    .single();
  check('stored: pending album, 30m rotation, AI-assisted, tags', version.status === 'pending' && version.kind === 'album'
    && version.schedule.slot[0].rotate === 'every 30m' && version.ai_use === 'assisted'
    && JSON.stringify(version.tags) === '["test","gradients"]' && JSON.stringify(version.categories) === '["abstract","minimal"]', JSON.stringify({ ...version, schedule: version.schedule.slot }));
  check('stored file names match the schedule', version.files.map((f) => f.path).sort().join() === [...version.schedule.slot[0].images].sort().join());

  // --- disabled-reason text, draft restore after reload, cover choice -------
  // A separate browser context: the draft lives in localStorage, which is
  // shared by every page in the same context, and this scenario needs its own.
  const context2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context2.addCookies([{ name: `sb-${REF}-auth-token`, value: cookieValue, url: BASE }]);
  const page2 = await context2.newPage();
  await page2.goto(`${BASE}/upload`, { waitUntil: 'networkidle' });
  check('step 1 explains why Next is disabled', await page2.getByText('Choose a wallpack type').isVisible());
  await page2.getByRole('button', { name: 'Daypack', exact: true }).click();
  await page2.getByText('Next', { exact: true }).click();

  check('step 2 lists what\'s missing', await page2.getByText('Add a title').isVisible()
    && await page2.getByText('Pick 1–2 categories').isVisible() && await page2.getByText('Answer the AI question').isVisible());
  const draftTitle = `E2E Draft ${runId}`;
  await page2.getByPlaceholder('Enter a descriptive title').fill(draftTitle);
  await page2.getByRole('button', { name: 'Nature', exact: true }).click();
  await page2.getByRole('button', { name: 'No AI' }).click();
  check('reasons clear once the fields are filled in', await page2.getByText('Add a title').count() === 0);
  await page2.getByText('Next', { exact: true }).click();

  await page2.locator('input[type=file]').setInputFiles(images.slice(0, 2));
  await page2.getByText('Uploaded Files (2)').waitFor();
  await page2.getByRole('button', { name: 'Cover', exact: true }).last().click();
  check('chosen cover is marked', await page2.getByRole('button', { name: '★ Cover', exact: true }).count() === 1);

  await page2.reload({ waitUntil: 'networkidle' });
  check('draft restores past step 1', await page2.getByText('Uploaded Files (2)').isVisible());
  check('draft says images need adding again', await page2.getByText(/Your images need adding again/).isVisible());
  check('cover choice is restored from the draft', await page2.getByRole('button', { name: '★ Cover', exact: true }).count() === 1);
  await page2.getByText('Previous', { exact: true }).click();
  check('title restored from the draft', await page2.getByPlaceholder('Enter a descriptive title').inputValue() === draftTitle);
  await page2.getByText('Next', { exact: true }).click();

  await page2.locator('input[type=file]').setInputFiles(images.slice(0, 2));
  check('re-adding the same files clears "needs adding again"', await page2.getByText('Needs adding again').count() === 0);

  // --- zip import (a zip built from samples/colour-week) --------------------
  const zip = new JSZip();
  zip.file('schedule.toml', readFileSync(join(SAMPLES, 'colour-week/schedule.toml')));
  for (const f of readdirSync(join(SAMPLES, 'colour-week/images'))) {
    zip.file(`images/${f}`, readFileSync(join(SAMPLES, 'colour-week/images', f)));
  }
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  const context3 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context3.addCookies([{ name: `sb-${REF}-auth-token`, value: cookieValue, url: BASE }]);
  const page3 = await context3.newPage();
  await page3.goto(`${BASE}/upload`, { waitUntil: 'networkidle' });
  await page3.locator('input[accept=".zip"]').setInputFiles({ name: 'colour-week.zip', mimeType: 'application/zip', buffer: zipBuffer });
  await page3.getByRole('heading', { name: 'Pack Information' }).waitFor({ timeout: 15_000 });
  check('zip import prefills the title and jumps to the details step',
    await page3.getByPlaceholder('Enter a descriptive title').inputValue() === 'Colour Week');
  if (SHOTS) await page3.screenshot({ path: `${SHOTS}/7-zip-import-details.png`, fullPage: true });
  await page3.getByRole('button', { name: 'Seasons', exact: true }).click();
  await page3.getByRole('button', { name: 'No AI' }).click();
  const next3 = page3.getByText('Next', { exact: true });
  await next3.click();
  check('zip import loaded all 7 images', await page3.getByText('Uploaded Files (7)').isVisible());
  await next3.click();
  check('zip import lands in the Weekpack builder (not as text)', await page3.getByText('Configure Weekly Schedule').isVisible());
  if (SHOTS) await page3.screenshot({ path: `${SHOTS}/8-zip-import-schedule.png`, fullPage: true });
  await next3.click();
  await page3.getByRole('button', { name: 'Upload Wallpack' }).click();
  await page3.waitForURL(/\/packs\//, { timeout: 120_000 });
  const zipSlug = new URL(page3.url()).pathname.split('/').pop();
  const { data: zipVersion } = await admin
    .from('pack_versions')
    .select('kind, files:version_files!version_files_version_id_fkey(path)')
    .eq('pack_id', (await admin.from('packs').select('id').eq('slug', zipSlug).single()).data.id)
    .single();
  check('zip import stored as a weekpack with 7 files', zipVersion.kind === 'days' && zipVersion.files.length === 7);

  check('no page errors in the browser', consoleErrors.length === 0, consoleErrors.join(' | '));
} catch (e) {
  check('unexpected error', false, e.stack);
} finally {
  await browser?.close();
  if (userId) {
    const { data: uploads } = await admin.from('blob_uploads').select('sha256').eq('profile_id', userId);
    await admin.auth.admin.deleteUser(userId); // cascades to packs, versions, files, blob_uploads
    const shas = (uploads ?? []).map((u) => u.sha256);
    if (shas.length) {
      await admin.from('blobs').delete().in('sha256', shas);
      const r2 = new S3Client({ region: 'auto', endpoint: E.R2_ENDPOINT, credentials: { accessKeyId: E.R2_ACCESS_KEY_ID, secretAccessKey: E.R2_SECRET_ACCESS_KEY } });
      for (const s of shas) await r2.send(new DeleteObjectCommand({ Bucket: 'wallpy-public', Key: `blobs/${s}` }));
    }
    console.log(`\ncleaned up 1 user, ${shas.length} blobs`);
  }
  const failed = results.filter((ok) => !ok).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}
