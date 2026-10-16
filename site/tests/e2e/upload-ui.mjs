// End-to-end test of the upload wizard in a real (headless) Chrome: a
// throwaway user builds an Album pack through every step and submits it.
// Runs against a site at BASE (default http://localhost:3000) and the Supabase
// project / R2 bucket in .env.local; deletes everything it created.
// Run on purpose only:  npm run test:e2e:ui   (SHOTS=dir to keep screenshots)
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { chromium } = require('playwright-core');

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
  await page.getByPlaceholder(/nature, landscape/).fill('Test, Gradients');
  check('Next stays disabled until the AI question is answered', await next.isDisabled());
  await page.getByRole('button', { name: 'AI-assisted' }).click();
  check('AI answer enables Next', await next.isEnabled());
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
    .select('status, kind, ai_use, tags, schedule, files:version_files!version_files_version_id_fkey(path)')
    .eq('pack_id', (await admin.from('packs').select('id').eq('slug', slug).single()).data.id)
    .single();
  check('stored: pending album, 30m rotation, AI-assisted, tags', version.status === 'pending' && version.kind === 'album'
    && version.schedule.slot[0].rotate === 'every 30m' && version.ai_use === 'assisted'
    && JSON.stringify(version.tags) === '["test","gradients"]', JSON.stringify({ ...version, schedule: version.schedule.slot }));
  check('stored file names match the schedule', version.files.map((f) => f.path).sort().join() === [...version.schedule.slot[0].images].sort().join());
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
