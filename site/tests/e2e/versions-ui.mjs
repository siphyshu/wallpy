// End-to-end test of new versions, in a real (headless) Chrome:
//  1. Changes requested: a moderator sends a pack back; the uploader opens
//     "Make changes", adds an image to a block, resubmits; it's approved as v2.
//  2. Update: the uploader sends a new version of a published pack (images
//     reused, nothing re-uploaded); v1 stays live until v2 is approved.
// Only touches its own packs.  npm run test:e2e:versions   (SHOTS=dir for screenshots)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { BASE, COOKIE_NAME, admin, api, check, cleanup, makeImage, makeUser, runId, summary, uploadImages } from './helpers.mjs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright-core');

const manifest = (slug) => fetch(`${BASE}/api/packs/${slug}/manifest`).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

let browser;
try {
  const uploader = await makeUser('up');
  const moderator = await makeUser('mod', { role: 'moderator' });
  const stranger = await makeUser('st');

  const slugs = {};
  for (const name of ['Fix Me', 'Update Me']) {
    const day = await makeImage(`${name} day`, '230,160,70');
    const night = await makeImage(`${name} night`, '20,30,80');
    await uploadImages(uploader, [day, night]);
    const res = await api(uploader, '/api/packs', {
      title: `${name} ${runId}`, tags: ['e2e'], ai_use: 'none', uploader_is_artist: true,
      schedule: { spec: 2, name, slot: [{ at: 'sunrise', images: ['day.jpg'] }, { at: 'sunset', images: ['night.jpg'] }] },
      files: [{ path: 'day.jpg', sha256: day.sha256 }, { path: 'night.jpg', sha256: night.sha256 }],
      // The wizard always sends renditions of the cover; stand in with the image itself.
      cover: 'day.jpg', thumb_sha256: day.sha256, preview_sha256: day.sha256,
    });
    if (res.status !== 201) throw new Error(`submit failed: ${JSON.stringify(res.body)}`);
    slugs[name] = res.body.slug;
  }
  // Moderator decisions on v1 (the moderation UI has its own test).
  const v1 = async (slug) => {
    const { data: pack } = await admin.from('packs').select('id').eq('slug', slug).single();
    return (await admin.from('pack_versions').select('id').eq('pack_id', pack.id).eq('number', 1).single()).data.id;
  };
  // moderate() needs a moderator as auth.uid(): call it through the API as one.
  const moderate = async (versionId, action, notes = null) => {
    const { createClient } = require('@supabase/supabase-js');
    const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${JSON.parse(Buffer.from(moderator.cookieValue.slice(7), 'base64url')).access_token}` } },
      auth: { persistSession: false },
    });
    const { error } = await c.rpc('moderate', { p_version: versionId, p_action: action, p_notes: notes });
    if (error) throw error;
  };
  await moderate(await v1(slugs['Fix Me']), 'reject', 'Please add a starry night image.');
  await moderate(await v1(slugs['Update Me']), 'approve');

  // API rules.
  const body = {
    title: 'Hijack', tags: ['e2e'], ai_use: 'none', uploader_is_artist: true,
    schedule: { spec: 2, name: 'x', slot: [{ images: ['day.jpg'] }] }, files: [{ path: 'day.jpg', sha256: '0'.repeat(64) }],
  };
  check('strangers cannot add versions to someone else\'s pack',
    (await api(stranger, `/api/packs/${slugs['Update Me']}/versions`, body)).status === 404);
  check('signed-out users cannot add versions', (await api(null, `/api/packs/${slugs['Update Me']}/versions`, body)).status === 401);

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const as = async (user) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await context.addCookies([{ name: COOKIE_NAME, value: user.cookieValue, url: BASE }]);
    return context.newPage();
  };
  const shot = async (page, name) => {
    if (!process.env.SHOTS) return;
    mkdirSync(process.env.SHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true });
  };
  const strangerPage = await as(stranger);
  check('strangers get 404 for the edit page',
    (await strangerPage.goto(`${BASE}/packs/${slugs['Update Me']}/edit`)).status() === 404);

  // ---- 1. changes requested -------------------------------------------------
  const up = await as(uploader);
  await up.goto(`${BASE}/packs/${slugs['Fix Me']}`, { waitUntil: 'networkidle' });
  check('pack page shows the note with a way to act on it',
    await up.getByText(/Please add a starry night image/).isVisible() && await up.getByRole('link', { name: 'Make changes' }).isVisible());
  await shot(up, 'v-1-pack-rejected');
  await up.getByRole('link', { name: 'Make changes' }).click();
  await up.waitForURL(`**/packs/${slugs['Fix Me']}/edit`);
  await up.getByText('Update Wallpack').waitFor();
  check('edit page repeats the note', await up.getByText(/Changes requested on version 1/).isVisible());
  check('no false "builder can\'t show this" warning', !(await up.getByText(/options the builder can't show/).isVisible()));
  check('details are filled in from version 1',
    await up.getByPlaceholder('Enter a descriptive title').inputValue() === `Fix Me ${runId}`);
  await shot(up, 'v-2-edit-details');
  const next = up.getByText('Next', { exact: true });
  await next.click();

  check('existing images are listed, marked as already in the pack',
    await up.getByText('Already in the pack', { exact: false }).count() === 2);
  const stars = await makeImage('Stars', '10,10,40');
  await up.locator('input[type=file]').setInputFiles([{ name: 'stars.jpg', mimeType: 'image/jpeg', buffer: stars.bytes }]);
  await up.getByText('Uploaded Files (3)').waitFor();
  await shot(up, 'v-3-edit-files');
  await next.click();

  // Schedule: add stars.jpg to the second block (the builder names unnamed blocks after their start).
  const row = up.locator('div[draggable="true"]', { hasText: 'stars.jpg' }).first();
  await row.locator('input[type=checkbox]').check();
  await up.getByRole('combobox').first().click();
  await up.getByRole('option', { name: 'Sunset' }).click();
  await up.getByRole('button', { name: 'Add', exact: true }).click();
  await up.locator('pre code').filter({ hasText: 'stars.jpg' }).waitFor({ timeout: 10_000 });
  check('schedule preview includes the new image', (await up.locator('pre code').innerText()).includes('"night.jpg", "stars.jpg"'));
  await shot(up, 'v-4-edit-schedule');
  await next.click();

  await up.getByRole('button', { name: 'Submit version 2' }).click();
  await up.waitForURL(`**/packs/${slugs['Fix Me']}`, { timeout: 60_000 }).catch(async (e) => {
    await shot(up, 'v-fail-submit');
    console.log('page says:', (await up.locator('body').innerText()).match(/Upload failed[\s\S]{0,300}/)?.[0]);
    throw e;
  });
  await up.getByText(/Waiting for review/).waitFor({ timeout: 10_000 }).catch(() => {});
  check('after resubmitting, the pack is back in review', await up.getByText(/Waiting for review/).isVisible());
  await shot(up, 'v-5-resubmitted');

  const mod = await as(moderator);
  await mod.goto(`${BASE}/moderation`, { waitUntil: 'networkidle' });
  const fixCard = mod.locator('article', { hasText: `Fix Me ${runId}` });
  check('version 2 is in the queue with 3 images', await fixCard.getByText(/3 images/).isVisible());
  await fixCard.getByRole('button', { name: 'Approve & publish' }).click();
  await fixCard.waitFor({ state: 'detached', timeout: 30_000 });
  const fixed = await manifest(slugs['Fix Me']);
  check('approved v2 is public with the new image',
    fixed.status === 200 && fixed.body.version === 2 && fixed.body.files.some((f) => f.path === 'stars.jpg'));

  // ---- 2. update to a published pack ---------------------------------------
  await up.goto(`${BASE}/packs/${slugs['Update Me']}`, { waitUntil: 'networkidle' });
  await up.getByRole('link', { name: 'Upload a new version' }).click();
  await up.waitForURL(`**/packs/${slugs['Update Me']}/edit`);
  check('edit page explains v1 stays live', await up.getByText(/Version 1 stays live until it's approved/).isVisible());
  await up.getByPlaceholder('Enter a descriptive title').fill(`Updated Pack ${runId}`);
  await next.click();
  await next.click();
  await next.click();
  const presigns = [];
  up.on('request', (r) => { if (r.url().includes('/api/uploads/')) presigns.push(r.url()); });
  await up.getByRole('button', { name: 'Submit version 2' }).click();
  await up.waitForURL(`**/packs/${slugs['Update Me']}`, { timeout: 60_000 });
  check('unchanged images (and cover) are not uploaded again', presigns.length === 0, presigns.join(', '));
  await up.getByText(/Version 2 is waiting for review/).waitFor({ timeout: 10_000 }).catch(() => {});
  check('pack page says v2 is in review and v1 is live', await up.getByText(/Version 2 is waiting for review/).isVisible());
  check('no second update while one is in review', !(await up.getByRole('link', { name: 'Upload a new version' }).isVisible()));
  await shot(up, 'v-6-update-pending');
  const during = await manifest(slugs['Update Me']);
  check('v1 is still what people download', during.body.version === 1 && during.body.title === `Update Me ${runId}`);
  check('a second version while one is pending is refused (409)',
    (await api(uploader, `/api/packs/${slugs['Update Me']}/versions`, { ...body, files: during.body.files.map((f) => ({ path: f.path, sha256: f.sha256 })), schedule: during.body.schedule })).status === 409);

  await up.goto(`${BASE}/profile/${uploader.username}`, { waitUntil: 'networkidle' });
  check('profile shows the update is in review', await up.getByText('Update in review').first().isVisible());

  await mod.goto(`${BASE}/moderation`, { waitUntil: 'networkidle' });
  const updCard = mod.locator('article', { hasText: `Updated Pack ${runId}` });
  check('the queue marks it as an update', await updCard.getByText('Update · v2').isVisible());
  await updCard.getByRole('button', { name: 'Approve & publish' }).click();
  await updCard.waitFor({ state: 'detached', timeout: 30_000 });
  const after = await manifest(slugs['Update Me']);
  check('once approved, v2 replaces v1', after.body.version === 2 && after.body.title === `Updated Pack ${runId}`);
} catch (e) {
  check('unexpected error', false, e.stack);
} finally {
  await browser?.close();
  await cleanup();
  process.exit(summary() ? 1 : 0);
}
