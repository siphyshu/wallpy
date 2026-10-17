// End-to-end test of reports, takedowns and the update diff, in a real
// (headless) Chrome: a visitor reports a pack; a moderator sees the report,
// takes the pack down with a reason; the owner sees the reason; the moderator
// restores it from the Published tab; the history shows both. An update in the
// queue shows what changed against the live version.
// Only touches its own packs.  npm run test:e2e:reports   (SHOTS=dir for screenshots)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { BASE, COOKIE_NAME, E, admin, api, check, cleanup, makeImage, makeUser, runId, summary, uploadImages } from './helpers.mjs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const { createClient } = require('@supabase/supabase-js');

let browser;
try {
  const uploader = await makeUser('up');
  const moderator = await makeUser('mod', { role: 'moderator' });
  const reporter = await makeUser('rep');
  const bystander = await makeUser('by');

  // An API client acting as a user (RPCs need them as auth.uid()).
  const clientFor = (user) => createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${JSON.parse(Buffer.from(user.cookieValue.slice(7), 'base64url')).access_token}` } },
    auth: { persistSession: false },
  });
  const modClient = clientFor(moderator);

  const imgs = {
    day: await makeImage('day', '230,160,70'),
    night: await makeImage('night', '20,30,80'),
    stars: await makeImage('stars', '10,10,40'),
  };
  await uploadImages(uploader, Object.values(imgs));
  const packBody = (name, extra = {}) => ({
    title: `${name} ${runId}`, tags: ['e2e'], categories: ['abstract'], ai_use: 'none', uploader_is_artist: true,
    schedule: { spec: 2, name, slot: [{ at: 'sunrise', images: ['day.jpg'] }, { at: 'sunset', images: ['night.jpg'] }] },
    files: [{ path: 'day.jpg', sha256: imgs.day.sha256 }, { path: 'night.jpg', sha256: imgs.night.sha256 }],
    cover: 'day.jpg', thumb_sha256: imgs.day.sha256, preview_sha256: imgs.day.sha256,
    ...extra,
  });
  const slugs = {};
  for (const name of ['Report Me', 'Diff Me']) {
    const res = await api(uploader, '/api/packs', packBody(name));
    if (res.status !== 201) throw new Error(`submit failed: ${JSON.stringify(res.body)}`);
    slugs[name] = res.body.slug;
    const { data: pack } = await admin.from('packs').select('id').eq('slug', res.body.slug).single();
    const { data: v } = await admin.from('pack_versions').select('id').eq('pack_id', pack.id).eq('number', 1).single();
    const { error } = await modClient.rpc('moderate', { p_version: v.id, p_action: 'approve' });
    if (error) throw error;
  }
  const { data: reportPack } = await admin.from('packs').select('id').eq('slug', slugs['Report Me']).single();

  // An update to "Diff Me": night.jpg swapped for stars.jpg, new title and tag.
  const upd = await api(uploader, `/api/packs/${slugs['Diff Me']}/versions`, packBody('Diff Me', {
    title: `Diff Me at night ${runId}`, tags: ['e2e', 'stars'],
    schedule: { spec: 2, name: 'Diff Me', slot: [{ at: 'sunrise', images: ['day.jpg'] }, { at: 'sunset', images: ['stars.jpg'] }] },
    files: [{ path: 'day.jpg', sha256: imgs.day.sha256 }, { path: 'stars.jpg', sha256: imgs.stars.sha256 }],
  }));
  if (upd.status !== 201 && upd.status !== 200) throw new Error(`update failed: ${upd.status} ${JSON.stringify(upd.body)}`);

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const as = async (user) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    if (user) await context.addCookies([{ name: COOKIE_NAME, value: user.cookieValue, url: BASE }]);
    return context.newPage();
  };
  const shot = async (target, name) => {
    if (!process.env.SHOTS) return;
    mkdirSync(process.env.SHOTS, { recursive: true });
    await target.screenshot({ path: `${process.env.SHOTS}/${name}.png`, ...(target.url ? { fullPage: true } : {}) });
  };
  const packUrl = `${BASE}/packs/${slugs['Report Me']}`;

  // Signed out: no report button. Anon RPC is refused too.
  const anonPage = await as(null);
  await anonPage.goto(packUrl, { waitUntil: 'networkidle' });
  check('signed-out visitors see no report button', !(await anonPage.getByRole('button', { name: 'Report this pack' }).isVisible()));
  const anonClient = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  check('anon cannot report through the API',
    Boolean((await anonClient.rpc('report_pack', { p_pack: reportPack.id, p_reason: 'other' })).error));

  // The owner can't report their own pack.
  const up = await as(uploader);
  await up.goto(packUrl, { waitUntil: 'networkidle' });
  check('owners see no report button', !(await up.getByRole('button', { name: 'Report this pack' }).isVisible()));

  // A visitor reports it.
  const rep = await as(reporter);
  await rep.goto(packUrl, { waitUntil: 'networkidle' });
  await rep.getByRole('button', { name: 'Report this pack' }).click();
  const form = rep.getByTestId('report-form');
  await form.getByRole('button', { name: 'Send report' }).click();
  check('a report needs a reason', await form.getByText('Pick a reason.').isVisible());
  await form.getByRole('radio', { name: 'Stolen or uncredited' }).click();
  await form.getByPlaceholder(/Anything moderators should know/).fill(`This is my artwork ${runId}, not credited.`);
  await shot(form, 'rep-1-form');
  await form.getByRole('button', { name: 'Send report' }).click();
  await rep.getByText('You reported this pack.').waitFor({ timeout: 15_000 });
  check('the reporter is thanked', true);
  await rep.reload({ waitUntil: 'networkidle' });
  check('the pack remembers the open report', await rep.getByText('You reported this pack.').isVisible());
  const again = await clientFor(reporter).rpc('report_pack', { p_pack: reportPack.id, p_reason: 'offensive' });
  check('one open report per person per pack', again.error?.code === '23505');
  const peek = await clientFor(bystander).from('pack_reports').select('id').eq('pack_id', reportPack.id);
  check('others cannot read the report', !peek.error && peek.data.length === 0);

  // Non-moderators can't see moderation tabs.
  const by = await as(bystander);
  check('non-moderators get 404 for the reports tab', (await by.goto(`${BASE}/moderation?tab=reports`)).status() === 404);

  // Moderator: the report is there; take the pack down.
  const mod = await as(moderator);
  await mod.goto(`${BASE}/moderation?tab=reports`, { waitUntil: 'networkidle' });
  const card = mod.getByTestId('report-card').filter({ hasText: `Report Me ${runId}` });
  check('the moderator sees the report', await card.isVisible()
    && await card.getByText('Stolen or uncredited').isVisible()
    && await card.getByText(`This is my artwork ${runId}, not credited.`).isVisible());
  await shot(mod, 'rep-2-reports-tab');
  await card.getByRole('button', { name: 'Take down', exact: true }).click();
  await card.getByRole('button', { name: 'Take down pack' }).click();
  check('a takedown needs a reason', await card.getByText('Say why the pack is taken down.').isVisible());
  await card.getByPlaceholder(/Why is this pack taken down/).fill('Uploaded without the artist\'s permission.');
  await card.getByRole('button', { name: 'Take down pack' }).click();
  await card.waitFor({ state: 'detached', timeout: 30_000 });
  check('taking down closes the reports', true);
  check('a taken-down pack is no longer installable',
    (await fetch(`${BASE}/api/packs/${slugs['Report Me']}/manifest`)).status === 404);

  // The owner sees why.
  await up.goto(packUrl, { waitUntil: 'networkidle' });
  check('the owner sees the takedown reason',
    await up.getByText(/Taken down by a moderator: Uploaded without the artist's permission/).isVisible());
  await shot(up, 'rep-3-owner-takedown');

  // Restore from the Published tab.
  await mod.goto(`${BASE}/moderation?tab=published&q=${encodeURIComponent(`Report Me ${runId}`)}`, { waitUntil: 'networkidle' });
  const pub = mod.getByTestId('published-card').filter({ hasText: `Report Me ${runId}` });
  check('the Published tab finds the taken-down pack', await pub.getByText('Taken down', { exact: true }).isVisible());
  await pub.getByRole('button', { name: 'Restore', exact: true }).click();
  await pub.getByPlaceholder(/Why is this pack restored/).fill('Artist confirmed permission.');
  await pub.getByRole('button', { name: 'Restore pack' }).click();
  await pub.getByText('Taken down', { exact: true }).waitFor({ state: 'detached', timeout: 30_000 });
  check('restoring makes it installable again', (await fetch(`${BASE}/api/packs/${slugs['Report Me']}/manifest`)).status === 200);

  // History on the pack page, for moderators only.
  await mod.goto(packUrl, { waitUntil: 'networkidle' });
  const hist = mod.getByTestId('moderation-history');
  await hist.locator('summary').click();
  check('moderators see the pack history',
    await hist.getByText(/took the pack down/).isVisible() && await hist.getByText(/restored the pack/).isVisible()
    && await hist.getByText(/Artist confirmed permission/).isVisible());
  await shot(mod, 'rep-4-pack-history');
  await rep.goto(packUrl, { waitUntil: 'networkidle' });
  check('visitors see no history', !(await rep.getByTestId('moderation-history').isVisible()));

  // The update diff in the queue.
  await mod.goto(`${BASE}/moderation`, { waitUntil: 'networkidle' });
  const qcard = mod.locator('article', { hasText: `Diff Me at night ${runId}` });
  const diff = qcard.getByTestId('update-diff');
  check('an update shows its diff', await diff.isVisible());
  check('the diff lists the title and tag changes',
    await diff.getByText('Title:').isVisible() && await diff.getByText('e2e, stars').isVisible());
  check('the diff shows added and removed images',
    await diff.getByText('Images added or replaced (1)').isVisible() && await diff.getByText('Images removed or replaced (1)').isVisible());
  check('the diff shows both schedules', await diff.getByText('Schedule in this update').isVisible());
  check('every card shows categories and the schedule',
    await qcard.getByText('Abstract', { exact: true }).isVisible() && await qcard.getByTestId('schedule-summary').isVisible());
  const box = await qcard.locator('a').first().boundingBox();
  check('the cover stays 16:9', box && Math.abs(box.width / box.height - 16 / 9) < 0.05, box ? `${box.width}x${box.height}` : '');
  await shot(qcard, 'rep-5-update-diff');
} catch (e) {
  check('unexpected error', false, e.stack);
} finally {
  await browser?.close();
  await cleanup();
  process.exit(summary() ? 1 : 0);
}
