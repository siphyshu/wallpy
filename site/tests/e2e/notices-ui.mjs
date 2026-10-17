// End-to-end test of in-site notices: an owner submits two packs, a test
// moderator approves one and requests changes on the other (via RPC -- the
// moderation UI itself is covered by moderation-ui.mjs), then in a real
// (headless) Chrome: the owner sees a dot on the navbar avatar, visits
// /notices and sees both outcomes (with the moderator's note), and the dot
// is gone afterwards. A bystander with no packs sees the empty state.
// Only touches its own packs. Run on purpose only: npm run test:e2e:notices
// (SHOTS=dir for screenshots)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { BASE, COOKIE_NAME, api, check, cleanup, makeImage, makeUser, runId, summary, uploadImages } from './helpers.mjs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const { createClient } = require('@supabase/supabase-js');

const asClient = (user) => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${JSON.parse(Buffer.from(user.cookieValue.slice(7), 'base64url')).access_token}` } },
  auth: { persistSession: false },
});

let browser;
try {
  const uploader = await makeUser('up');
  const moderator = await makeUser('mod', { role: 'moderator' });
  const bystander = await makeUser('by');

  const submit = async (name) => {
    const day = await makeImage(`${name} day`, '230,160,70');
    const night = await makeImage(`${name} night`, '20,30,80');
    await uploadImages(uploader, [day, night]);
    const res = await api(uploader, '/api/packs', {
      title: `${name} ${runId}`, tags: ['e2e'], categories: ['abstract'], ai_use: 'none', uploader_is_artist: true,
      schedule: { spec: 2, name, slot: [{ at: 'sunrise', images: ['day.jpg'] }, { at: 'sunset', images: ['night.jpg'] }] },
      files: [{ path: 'day.jpg', sha256: day.sha256 }, { path: 'night.jpg', sha256: night.sha256 }],
    });
    if (res.status !== 201) throw new Error(`submit failed: ${JSON.stringify(res.body)}`);
    return res.body; // { slug, version_id, ... }
  };

  const approved = await submit('Notice Approve');
  const changed = await submit('Notice Changes');

  const NOTE = `Please add a brighter night image. ${runId}`;
  const { error: approveError } = await asClient(moderator).rpc('moderate', { p_version: approved.version_id, p_action: 'approve' });
  if (approveError) throw approveError;
  const { error: rejectError } = await asClient(moderator).rpc('moderate', { p_version: changed.version_id, p_action: 'reject', p_notes: NOTE });
  if (rejectError) throw rejectError;

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const as = async (user) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await context.addCookies([{ name: COOKIE_NAME, value: user.cookieValue, url: BASE }]);
    return context.newPage();
  };
  const shot = async (page, name) => {
    if (!process.env.SHOTS) return;
    mkdirSync(process.env.SHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true, scale: 'css' });
  };

  // The owner sees a dot on their avatar as soon as the navbar loads.
  const owner = await as(uploader);
  await owner.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const dot = owner.getByTestId('notices-dot');
  check('the owner sees a dot on their avatar', await dot.isVisible().catch(() => false));

  // /notices lists both outcomes, newest first, with the moderator's note.
  await owner.goto(`${BASE}/notices`, { waitUntil: 'networkidle' });
  const list = owner.getByTestId('notices-list');
  check('the notices list shows up', await list.isVisible());
  const approvedItem = list.locator('li', { hasText: `Notice Approve ${runId}` });
  const changedItem = list.locator('li', { hasText: `Notice Changes ${runId}` });
  check('the approved pack shows "Approved"', await approvedItem.getByText('Approved', { exact: true }).isVisible());
  check('the pack title links to its page', await approvedItem.getByRole('link', { name: `Notice Approve ${runId}` }).getAttribute('href') === `/packs/${approved.slug}`);
  check('the changed pack shows "Changes requested"', await changedItem.getByText('Changes requested', { exact: true }).isVisible());
  check('and the moderator\'s note', await changedItem.getByText(NOTE).isVisible());
  await shot(owner, 'notices-1-list');

  // Visiting marked everything read: the dot is gone on the next page.
  await owner.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  check('the dot is gone after visiting /notices', !(await owner.getByTestId('notices-dot').isVisible().catch(() => false)));

  // A bystander with no packs gets the empty state.
  const by = await as(bystander);
  await by.goto(`${BASE}/notices`, { waitUntil: 'networkidle' });
  check('someone with no notices sees the empty state', await by.getByTestId('notices-empty').isVisible());
  check('and no dot', !(await by.getByTestId('notices-dot').isVisible().catch(() => false)));
} catch (e) {
  check('unexpected error', false, e.stack);
} finally {
  await browser?.close();
  await cleanup();
  process.exit(summary() ? 1 : 0);
}
