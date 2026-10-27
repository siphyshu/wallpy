// End-to-end test of moderation: an uploader submits two packs (via the API),
// a test moderator rejects one with a note and approves the other in a real
// (headless) Chrome; the uploader sees the note; the approved pack goes public.
// Only touches its own packs, never anything else in the queue.
// Run on purpose only:  npm run test:e2e:moderation   (SHOTS=dir for screenshots)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { BASE, COOKIE_NAME, api, check, cleanup, makeImage, makeUser, runId, summary, uploadImages } from './helpers.mjs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright-core');

let browser;
try {
  const uploader = await makeUser('up');
  const moderator = await makeUser('mod', { role: 'moderator' });
  const bystander = await makeUser('by');

  // Two packs from the uploader.
  const slugs = {};
  for (const name of ['Reject Me', 'Approve Me', 'Decline Me']) {
    const day = await makeImage(`${name} day`, '230,160,70');
    const night = await makeImage(`${name} night`, '20,30,80');
    await uploadImages(uploader, [day, night]);
    const res = await api(uploader, '/api/packs', {
      title: `${name} ${runId}`, tags: ['e2e'], categories: ['abstract'], ai_use: 'none', uploader_is_artist: true,
      schedule: { spec: 2, name, slot: [{ at: 'sunrise', images: ['day.jpg'] }, { at: 'sunset', images: ['night.jpg'] }] },
      files: [{ path: 'day.jpg', sha256: day.sha256 }, { path: 'night.jpg', sha256: night.sha256 }],
    });
    if (res.status !== 201) throw new Error(`submit failed: ${JSON.stringify(res.body)}`);
    slugs[name] = res.body.slug;
  }

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

  // Regular users can't see the queue.
  const byPage = await as(bystander);
  const byRes = await byPage.goto(`${BASE}/moderation`);
  check('non-moderators get 404 for /moderation', byRes.status() === 404);

  // Moderator: navbar entry, both packs in the queue.
  const mod = await as(moderator);
  await mod.goto(`${BASE}/moderation`, { waitUntil: 'networkidle' });
  const cardFor = (title) => mod.locator('article', { hasText: title });
  check('both test packs are in the queue', await cardFor(`Reject Me ${runId}`).isVisible() && await cardFor(`Approve Me ${runId}`).isVisible());
  await shot(mod, 'mod-1-queue');
  await mod.locator('article').first().screenshot({ path: `${process.env.SHOTS || '/tmp'}/mod-1-card.png` }).catch(() => {});

  // Reject with a note.
  const rejectCard = cardFor(`Reject Me ${runId}`);
  await rejectCard.getByRole('button', { name: 'Request changes' }).click();
  await rejectCard.getByRole('button', { name: 'Send back with note' }).click();
  await rejectCard.getByText('Say what needs to change.').waitFor({ timeout: 10_000 }).catch(() => {});
  check('rejecting needs a note', await rejectCard.getByText('Say what needs to change.').isVisible());
  await rejectCard.getByPlaceholder(/What should the uploader change/).fill('Please add a night image with more stars.');
  await rejectCard.getByRole('button', { name: 'Send back with note' }).click();
  await rejectCard.waitFor({ state: 'detached', timeout: 30_000 });
  check('rejected pack leaves the queue', true);

  // Approve.
  const approveCard = cardFor(`Approve Me ${runId}`);
  await approveCard.getByRole('button', { name: 'Approve & publish' }).click();
  await approveCard.waitFor({ state: 'detached', timeout: 30_000 });
  check('approved pack leaves the queue', true);
  await shot(mod, 'mod-2-after');

  // Decline (a final no) needs a reason too.
  const declineCard = cardFor(`Decline Me ${runId}`);
  await declineCard.getByRole('button', { name: 'Decline', exact: true }).click();
  await declineCard.getByRole('button', { name: 'Decline pack' }).click();
  await declineCard.getByText('Say why the pack is declined.').waitFor({ timeout: 10_000 }).catch(() => {});
  check('declining needs a reason', await declineCard.getByText('Say why the pack is declined.').isVisible());
  await declineCard.getByPlaceholder(/Why is this pack declined/).fill('Not wallpapers.');
  await declineCard.getByRole('button', { name: 'Decline pack' }).click();
  await declineCard.waitFor({ state: 'detached', timeout: 30_000 });
  check('declined pack leaves the queue', true);

  // Uploader sees the note on the rejected pack.
  const up = await as(uploader);
  await up.goto(`${BASE}/packs/${slugs['Reject Me']}`, { waitUntil: 'networkidle' });
  check('uploader sees the moderator\'s note', await up.getByText(/Please add a night image with more stars/).isVisible());
  await shot(up, 'mod-3-rejected-note');

  // Declined: told why, with no way to resubmit.
  await up.goto(`${BASE}/packs/${slugs['Decline Me']}`, { waitUntil: 'networkidle' });
  check('uploader sees the pack was declined, and why', await up.getByText(/Declined by a moderator: "Not wallpapers\."/).isVisible());
  check('a declined pack offers no "Make changes"', !(await up.getByRole('link', { name: 'Make changes' }).isVisible()));
  await up.goto(`${BASE}/packs/${slugs['Decline Me']}/edit`, { waitUntil: 'networkidle' });
  check('the edit page sends a declined pack back to its page', up.url().endsWith(`/packs/${slugs['Decline Me']}`));
  await shot(up, 'mod-4-declined');

  // The uploader can delete a declined pack from their profile.
  await up.goto(`${BASE}/profile/${uploader.username}`, { waitUntil: 'networkidle' });
  const declinedCard = up.locator('div.group', { hasText: `Decline Me ${runId}` });
  check('profile marks the pack as declined', await declinedCard.getByText('Declined', { exact: true }).isVisible());
  // Every pack its owner can see offers Delete in the card's ⋯ menu; a declined one needs no typed name.
  await declinedCard.getByRole('button', { name: /^Actions for / }).click();
  check('the declined pack offers Delete', await declinedCard.getByRole('menuitem', { name: 'Delete' }).isVisible());
  await declinedCard.getByRole('menuitem', { name: 'Delete' }).click();
  await shot(up, 'mod-5-delete-confirm');
  await declinedCard.getByRole('button', { name: 'Delete pack' }).click();
  await declinedCard.waitFor({ state: 'detached', timeout: 30_000 });
  const gone = await up.goto(`${BASE}/packs/${slugs['Decline Me']}`);
  check('a deleted pack is gone', gone.status() === 404);

  // The approved pack is public.
  const manifest = await fetch(`${BASE}/api/packs/${slugs['Approve Me']}/manifest`);
  check('approved pack is publicly downloadable', manifest.status === 200);
  const gallery = await fetch(`${BASE}/api/packs?search=${encodeURIComponent(`Approve Me ${runId}`)}`).then((r) => r.json());
  check('approved pack appears in the gallery', gallery.total === 1);
  const rejected = await fetch(`${BASE}/api/packs/${slugs['Reject Me']}/manifest`);
  check('rejected pack stays private', rejected.status === 404);
} catch (e) {
  check('unexpected error', false, e.stack);
} finally {
  await browser?.close();
  await cleanup();
  process.exit(summary() ? 1 : 0);
}
