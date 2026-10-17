// End-to-end test of accounts and profiles in a real (headless) Chrome:
// - sign-up checks the username as you type and keeps ?redirect= (the form is
//   never submitted: that would send a real email);
// - a new user's profile nudges them to fill it in; they edit every field,
//   upload an avatar and a cover, save, reload, and a signed-out visitor sees it;
// - review status badges show to the owner only.
// Run on purpose only:  npm run test:e2e:profile   (SHOTS=dir for screenshots at 1440 and 390 wide)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { BASE, COOKIE_NAME, E, admin, api, check, cleanup, makeImage, makeUser, runId, summary, uploadImages } from './helpers.mjs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const { createClient } = require('@supabase/supabase-js');

// R2's CORS rules allow only http://localhost:3000 and the real site. On any
// other dev port, answer the browser's upload PUTs from here instead.
const corsAllowed = ['http://localhost:3000', 'https://wallpy.siphyshu.me'].includes(new URL(BASE).origin);

let browser;
try {
  const owner = await makeUser('prof');
  const moderator = await makeUser('profmod', { role: 'moderator' });

  // One published pack, so we can check who sees its status badge.
  const day = await makeImage('Profile day', '230,160,70');
  const night = await makeImage('Profile night', '20,30,80');
  await uploadImages(owner, [day, night]);
  const res = await api(owner, '/api/packs', {
    title: `Profile Pack ${runId}`, tags: ['e2e'], ai_use: 'none', uploader_is_artist: true,
    schedule: { spec: 2, name: 'Profile Pack', slot: [{ at: 'sunrise', images: ['day.jpg'] }, { at: 'sunset', images: ['night.jpg'] }] },
    files: [{ path: 'day.jpg', sha256: day.sha256 }, { path: 'night.jpg', sha256: night.sha256 }],
  });
  if (res.status !== 201) throw new Error(`submit failed: ${JSON.stringify(res.body)}`);
  const { data: packRow } = await admin.from('packs').select('id').eq('slug', res.body.slug).single();
  const { data: version } = await admin.from('pack_versions').select('id').eq('pack_id', packRow.id).single();
  const session = JSON.parse(Buffer.from(moderator.cookieValue.slice('base64-'.length), 'base64url').toString());
  const asMod = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const { error: modErr } = await asMod.rpc('moderate', { p_version: version.id, p_action: 'approve' });
  if (modErr) throw modErr;

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const open = async (user, width = 1440) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    if (user) await context.addCookies([{ name: COOKIE_NAME, value: user.cookieValue, url: BASE }]);
    const page = await context.newPage();
    if (!corsAllowed) {
      await page.route(/\.r2\.cloudflarestorage\.com\//, async (route) => {
        const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-methods': 'PUT', 'access-control-allow-headers': '*' };
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        const response = await route.fetch();
        return route.fulfill({ response, headers: { ...response.headers(), ...cors } });
      });
    }
    return page;
  };
  const shot = async (page, name) => {
    if (!process.env.SHOTS) return;
    mkdirSync(process.env.SHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true });
  };

  // --- Sign-up: username checks and redirect (never submitted) ---
  for (const width of [1440, 390]) {
    const page = await open(null, width);
    await page.goto(`${BASE}/auth/sign-up?redirect=/upload`, { waitUntil: 'networkidle' });
    if (width === 1440) check('sign-up has its own title', (await page.title()) === 'Sign up | Wallpy', await page.title());
    const status = page.locator('#username-status');
    const submit = page.getByRole('button', { name: 'Sign Up' });
    const username = page.getByLabel('Username');
    await username.fill('John Doe');
    if (width === 1440) {
      check('username is lowercased as typed', (await username.inputValue()) === 'john doe');
      check('spaces are explained', /No spaces/.test(await status.textContent()));
      check('sign up is disabled for a bad username', await submit.isDisabled());
      await username.fill('jd');
      check('too short is explained', /At least 3/.test(await status.textContent()));
      await username.fill(owner.username);
      await page.waitForFunction(() => /taken/.test(document.querySelector('#username-status')?.textContent ?? ''), null, { timeout: 10_000 });
      check('a taken username is caught', await submit.isDisabled());
      await shot(page, 'profile-0-signup-taken');
      await username.fill(`free_${runId}`);
      await page.waitForFunction(() => /Available/.test(document.querySelector('#username-status')?.textContent ?? ''), null, { timeout: 10_000 });
      check('a free username is available', !(await submit.isDisabled()));
      const loginHref = await page.getByRole('link', { name: 'Sign in', exact: true }).getAttribute('href');
      check('sign-up -> login keeps the redirect', loginHref === '/auth/login?redirect=%2Fupload', loginHref);
    }
    await shot(page, `profile-0-signup-${width}`);
    await page.context().close();
  }
  {
    const page = await open(null);
    await page.goto(`${BASE}/auth/login?redirect=/upload`, { waitUntil: 'networkidle' });
    check('login has its own title', (await page.title()) === 'Sign in | Wallpy', await page.title());
    const href = await page.getByRole('link', { name: 'Create one' }).getAttribute('href');
    check('login -> sign-up keeps the redirect', href === '/auth/sign-up?redirect=%2Fupload', href);
    for (const [path, title] of [['forgot-password', 'Reset your password'], ['update-password', 'Choose a new password'], ['sign-up-success', 'Check your email']]) {
      await page.goto(`${BASE}/auth/${path}`);
      check(`/auth/${path} has its own title`, (await page.title()) === `${title} | Wallpy`, await page.title());
    }
    await page.context().close();
  }

  // --- Owner: nudge, edit everything, save, reload ---
  const me = await open(owner);
  const profileUrl = `${BASE}/profile/${owner.username}`;
  await me.goto(profileUrl, { waitUntil: 'networkidle' });
  const nudge = me.getByText('Add a photo and a short bio');
  check('a new profile shows the fill-in nudge', await nudge.isVisible());
  check('the owner sees their pack\'s status badge', await me.getByText('Published', { exact: true }).isVisible());
  await shot(me, 'profile-1-new-1440');
  if (process.env.SHOTS) {
    const phone = await open(owner, 390);
    await phone.goto(profileUrl, { waitUntil: 'networkidle' });
    await shot(phone, 'profile-1-new-390');
    await phone.context().close();
  }

  await me.getByRole('button', { name: 'Fill in your profile' }).click();
  check('the nudge opens the edit form', await me.getByPlaceholder('Enter your full name').isVisible());
  check('contact email says it is public', await me.getByText('Shown publicly on your profile.').isVisible());
  await me.getByPlaceholder('Enter your full name').fill(`Profile Tester ${runId}`);
  await me.getByPlaceholder('Tell us about yourself...').fill('I make e2e wallpapers.');
  await me.getByRole('button', { name: 'Add Link' }).click();
  await me.getByPlaceholder('Link name (e.g., Twitter, Portfolio)').fill('Portfolio');
  await me.getByPlaceholder('https://example.com').fill('example.com/e2e');
  await me.getByRole('button', { name: 'Add Link' }).click();
  await me.getByPlaceholder('Link name (e.g., Twitter, Portfolio)').nth(1).fill('GitHub');
  await me.getByPlaceholder('https://example.com').nth(1).fill('https://github.com/e2e');
  await me.getByPlaceholder('your@email.com').fill('not-an-email');
  const avatar = await makeImage('avatar', '200,60,120');
  const cover = await makeImage('cover', '40,140,160');
  await me.locator('input[type=file]').nth(0).setInputFiles({ name: 'cover.jpg', mimeType: 'image/jpeg', buffer: cover.bytes });
  await me.locator('input[type=file]').nth(1).setInputFiles({ name: 'avatar.jpg', mimeType: 'image/jpeg', buffer: avatar.bytes });
  await me.getByRole('button', { name: 'Save' }).click();
  check('a bad contact email is explained before saving', await me.getByText('“not-an-email” isn\'t an email address.').isVisible());
  await me.getByPlaceholder('your@email.com').fill(`e2e-${runId}@example.com`);
  await shot(me, 'profile-2-editing-1440');
  await me.getByRole('button', { name: 'Save' }).click();
  await me.getByRole('button', { name: 'Edit Profile' }).waitFor({ timeout: 30_000 });

  await me.reload({ waitUntil: 'networkidle' });
  const { data: row } = await admin.from('profiles').select('*').eq('id', owner.id).single();
  check('saved: name, bio', row.display_name === `Profile Tester ${runId}` && row.bio === 'I make e2e wallpapers.');
  check('saved: links (scheme added)', row.links.map((l) => `${l.name} ${l.url}`).join('|') === 'Portfolio https://example.com/e2e|GitHub https://github.com/e2e', JSON.stringify(row.links));
  check('saved: contact email', row.contact_email === `e2e-${runId}@example.com`);
  check('saved: avatar and cover in the user\'s folder', row.avatar_key === `profiles/${owner.id}/${avatar.sha256}.jpg` && row.cover_key === `profiles/${owner.id}/${cover.sha256}.jpg`, `${row.avatar_key} ${row.cover_key}`);
  check('after saving, the nudge is gone', !(await nudge.isVisible()));
  const imgLoaded = (alt) => me.waitForFunction((a) => [...document.images].some((img) => img.alt === a && img.complete && img.naturalWidth > 0), alt, { timeout: 15_000 }).then(() => true, () => false);
  check('avatar and cover load after reload', (await imgLoaded(`Profile Tester ${runId}`)) && (await imgLoaded('Cover')));
  await shot(me, 'profile-3-saved-1440');

  // --- A signed-out visitor ---
  for (const width of [1440, 390]) {
    const visitor = await open(null, width);
    await visitor.goto(profileUrl, { waitUntil: 'networkidle' });
    if (width === 1440) {
      check('visitor sees name, bio, links and email',
        await visitor.getByText(`Profile Tester ${runId}`).first().isVisible()
        && await visitor.getByText('I make e2e wallpapers.').isVisible()
        && (await visitor.getByRole('link', { name: 'Portfolio' }).getAttribute('href')) === 'https://example.com/e2e'
        && await visitor.getByRole('link', { name: `e2e-${runId}@example.com` }).isVisible());
      check('visitor gets no edit button or nudge', !(await visitor.getByRole('button', { name: 'Edit Profile' }).isVisible()) && !(await visitor.getByText('Add a photo').isVisible()));
      check('visitor sees the pack but no status badge', await visitor.getByText(`Profile Pack ${runId}`).isVisible() && !(await visitor.getByText('Published', { exact: true }).isVisible()));
      check('visitor sees the avatar and cover', await visitor.locator(`img[alt="Profile Tester ${runId}"]`).evaluate((img) => img.naturalWidth > 0)
        && await visitor.locator('img[alt="Cover"]').evaluate((img) => img.naturalWidth > 0));
    }
    await shot(visitor, `profile-4-visitor-${width}`);
    await visitor.context().close();
  }
} catch (e) {
  check('unexpected error', false, e.stack);
} finally {
  await browser?.close();
  await cleanup();
  process.exit(summary() ? 1 : 0);
}
