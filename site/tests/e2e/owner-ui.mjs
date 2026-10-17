// End-to-end test of owner controls and account deletion, in a real (headless) Chrome:
//  1. Unlist from the pack page: out of the gallery and the public profile, but
//     the page and manifest still work; list it again from the profile card.
//  2. Delete a published pack from its profile card (type the name): page and manifest 404.
//  3. Withdraw a version in review: it's a draft again, and resubmitting replaces it.
//  4. Delete an account keeping published packs (credited to "Deleted user"),
//     and one deleting everything (through the API, with its checks).
// Only touches its own users and packs.  npm run test:e2e:owner   (SHOTS=dir for screenshots)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import {
  BASE, COOKIE_NAME, admin, check, cleanup, makeImage, makeUser, runId, summary, trackBlobs, trackPack, uploadImages,
} from './helpers.mjs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const { createClient } = require('@supabase/supabase-js');

const status = (path, user) => fetch(BASE + path, { headers: user ? { Cookie: user.cookie } : {} }).then((r) => r.status);
const inGallery = (title) => fetch(`${BASE}/api/packs?search=${encodeURIComponent(title)}`)
  .then((r) => r.json()).then((b) => b.packs.some((p) => p.name === title));
const waitFor = async (fn, tries = 20) => {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

let browser;
try {
  const owner = await makeUser('own');
  const moderator = await makeUser('mod', { role: 'moderator' });
  const keeper = await makeUser('keep');
  const leaver = await makeUser('leave');

  const asClient = (user) => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${JSON.parse(Buffer.from(user.cookieValue.slice(7), 'base64url')).access_token}` } },
    auth: { persistSession: false },
  });
  const payload = (name, sha256) => ({
    slug: name.toLowerCase().replace(/\W+/g, '-') + `-${runId}`, title: `${name} ${runId}`, tags: ['e2e'], ai_use: 'none',
    uploader_is_artist: true, submit: false, schedule: { spec: 2, name, slot: [{ images: ['a.jpg'] }] },
    files: [{ path: 'a.jpg', sha256 }], cover: 'a.jpg', thumb_sha256: sha256, preview_sha256: sha256,
  });
  const packs = {};
  const submit = async (user, name, { approve = true, submitIt = true } = {}) => {
    const img = await makeImage(name, '120,90,200');
    await uploadImages(user, [img]);
    trackBlobs([img.sha256]);
    const title = `${name} ${runId}`;
    // Saved as a draft through the RPC (the upload API always submits), given a
    // category (required to submit since the categories migration), then submitted.
    const { data: created, error: createError } = await asClient(user).rpc('create_pack', { p: payload(name, img.sha256) });
    if (createError) throw createError;
    const res = { body: created };
    const { data: pack } = await admin.from('packs').select('id').eq('slug', res.body.slug).single();
    await admin.from('pack_versions').update({ categories: ['art'] }).eq('id', res.body.version_id);
    if (submitIt) {
      const { error } = await asClient(user).rpc('moderate', { p_version: res.body.version_id, p_action: 'submit' });
      if (error) throw error;
    }
    if (approve) {
      const { error } = await asClient(moderator).rpc('moderate', { p_version: res.body.version_id, p_action: 'approve' });
      if (error) throw error;
    }
    packs[name] = { slug: res.body.slug, id: pack.id, title, versionId: res.body.version_id, sha256: img.sha256 };
    return packs[name];
  };
  await submit(owner, 'Hide Me');
  await submit(owner, 'Doomed');
  await submit(owner, 'In Review', { approve: false });
  await submit(keeper, 'Keeper Pub');
  await submit(keeper, 'Keeper Draft', { approve: false, submitIt: false });
  await submit(leaver, 'Leaver Pub');

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const as = async (user, width = 1280) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    if (user) await context.addCookies([{ name: COOKIE_NAME, value: user.cookieValue, url: BASE }]);
    return context.newPage();
  };
  const shot = async (page, name) => {
    if (!process.env.SHOTS) return;
    mkdirSync(process.env.SHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true, scale: 'css' });
  };

  // ---- 1. unlist / list ----------------------------------------------------------
  const hide = packs['Hide Me'];
  check('a published pack is in the gallery', await inGallery(hide.title));
  const me = await as(owner);
  await me.goto(`${BASE}/packs/${hide.slug}`, { waitUntil: 'networkidle' });
  const manage = me.getByTestId('manage-pack');
  await manage.getByRole('button', { name: 'Unlist' }).click();
  check('unlisting asks first', await manage.getByText(/Its link and installs keep working/).isVisible());
  await manage.getByRole('button', { name: 'Unlist' }).click();
  await me.getByText(/^Unlisted: hidden from the gallery/).waitFor({ timeout: 15_000 });
  check('the owner is told the pack is unlisted', true);
  await shot(me, 'owner-1-unlisted-page');
  check('an unlisted pack leaves the gallery', await waitFor(async () => !(await inGallery(hide.title))));
  check('its page still opens for visitors', (await status(`/packs/${hide.slug}`)) === 200);
  check('its manifest still works (CLI installs)', (await status(`/api/packs/${hide.slug}/manifest`)) === 200);
  const visitor = await as(null);
  await visitor.goto(`${BASE}/profile/${owner.username}`, { waitUntil: 'networkidle' });
  check('visitors don\'t see it on the profile', !(await visitor.getByText(hide.title).isVisible()) && await visitor.getByText(packs.Doomed.title).isVisible());
  await me.goto(`${BASE}/profile/${owner.username}`, { waitUntil: 'networkidle' });
  const hideCard = me.locator('div.group', { hasText: hide.title });
  check('the owner sees it, badged Unlisted', await hideCard.getByText('Unlisted', { exact: true }).isVisible());
  await shot(me, 'owner-2-profile-cards');
  await hideCard.getByRole('button', { name: 'List' }).click();
  await hideCard.getByText('Published', { exact: true }).waitFor({ timeout: 15_000 });
  check('listing it again from the profile card', await waitFor(() => inGallery(hide.title)));

  // ---- 2. delete from the profile card ------------------------------------------
  const doomed = packs.Doomed;
  const doomedCard = me.locator('div.group', { hasText: doomed.title });
  await doomedCard.getByRole('button', { name: 'Delete' }).click();
  const confirmDelete = doomedCard.getByRole('button', { name: 'Delete pack' });
  check('deleting needs the pack name typed', await confirmDelete.isDisabled());
  await doomedCard.getByLabel('Pack name').fill(doomed.slug);
  await shot(me, 'owner-3-delete-confirm');
  await confirmDelete.click();
  await doomedCard.waitFor({ state: 'detached', timeout: 15_000 });
  check('a deleted pack leaves the profile', true);
  check('its page is 404', (await status(`/packs/${doomed.slug}`)) === 404);
  check('its manifest is 404 (the CLI says it\'s gone)', (await status(`/api/packs/${doomed.slug}/manifest`)) === 404);

  // ---- 3. withdraw a version in review ------------------------------------------
  const review = packs['In Review'];
  await me.goto(`${BASE}/packs/${review.slug}`, { waitUntil: 'networkidle' });
  await me.getByTestId('manage-pack').getByRole('button', { name: 'Withdraw' }).click();
  await me.getByTestId('manage-pack').getByRole('button', { name: 'Withdraw' }).click();
  await me.getByRole('link', { name: 'Edit and submit' }).waitFor({ timeout: 15_000 });
  const { data: withdrawn } = await admin.from('pack_versions').select('status').eq('id', review.versionId).single();
  check('a withdrawn version is a draft again', withdrawn.status === 'draft');
  await shot(me, 'owner-4-withdrawn');
  // What the versions API calls when the edit page sends the pack again.
  const { error: resendError } = await asClient(owner).rpc('create_version_replacing_draft', { p_slug: review.slug, p: payload('In Review', review.sha256) });
  const { data: versions } = await admin.from('pack_versions').select('id, number, status').eq('pack_id', review.id);
  check('sending it again replaces the draft', !resendError && versions.length === 1 && versions[0].id !== review.versionId && versions[0].number === 1,
    JSON.stringify(resendError ?? versions));

  // ---- 4. delete accounts ------------------------------------------------------
  const kp = packs['Keeper Pub'];
  trackPack(kp.id);
  const k = await as(keeper);
  await k.goto(`${BASE}/profile/${keeper.username}`, { waitUntil: 'networkidle' });
  await k.getByRole('button', { name: /Edit Profile|Fill in your profile/ }).first().click();
  await k.getByRole('button', { name: 'Delete account' }).click();
  const box = k.getByTestId('delete-account');
  check('account deletion waits for a choice and the username', await box.getByRole('button', { name: 'Delete account' }).isDisabled());
  await box.getByText('Keep them up').click();
  await box.getByLabel('Username').fill(keeper.username);
  await shot(k, 'owner-5-delete-account');
  await box.getByRole('button', { name: 'Delete account' }).click();
  await k.waitForURL(`${BASE}/`, { timeout: 30_000 });
  const { data: kUser } = await admin.auth.admin.getUserById(keeper.id);
  check('the account is gone', !kUser?.user);
  check('the profile page is 404', (await status(`/profile/${keeper.username}`)) === 404);
  check('their unpublished pack is deleted', (await status(`/api/packs/${packs['Keeper Draft'].slug}/manifest`)) === 404);
  const kept = await as(null);
  await kept.goto(`${BASE}/packs/${kp.slug}`, { waitUntil: 'networkidle' });
  check('a kept pack stays up, credited to "Deleted user"', await kept.getByText('Deleted user').isVisible());
  check('and stays installable', (await status(`/api/packs/${kp.slug}/manifest`)) === 200 && await inGallery(kp.title));

  const lp = packs['Leaver Pub'];
  const del = (user, body) => fetch(`${BASE}/api/account`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(user ? { Cookie: user.cookie } : {}) }, body: JSON.stringify(body),
  }).then((r) => r.status);
  check('signed-out account deletion is refused', (await del(null, { username: leaver.username, keepPublished: false })) === 401);
  check('the username must match', (await del(leaver, { username: owner.username, keepPublished: false })) === 400);
  check('a choice is required', (await del(leaver, { username: leaver.username })) === 400);
  check('deleting everything', (await del(leaver, { username: leaver.username, keepPublished: false })) === 200);
  check('their published pack is gone too', (await status(`/packs/${lp.slug}`)) === 404);
  const { data: oUser } = await admin.auth.admin.getUserById(owner.id);
  check('other accounts are untouched', Boolean(oUser?.user));
} catch (e) {
  check('unexpected error', false, e.stack);
} finally {
  await browser?.close();
  await cleanup();
  process.exit(summary() ? 1 : 0);
}
