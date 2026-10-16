// End-to-end test of the Daypack and Weekpack builders (spec 2 slots) in a real
// (headless) Chrome, using the sample packs in samples/. A throwaway user
// builds each pack through the wizard and submits it; the stored schedules are
// checked. Deletes everything it created.
// Run on purpose only:  npm run test:e2e:builders   (SHOTS=dir for screenshots)
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, COOKIE_NAME, admin, check, cleanup, makeUser, runId, summary } from './helpers.mjs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = require('playwright-core');

const SAMPLES = new URL('../../../samples/', import.meta.url).pathname;
const imagesOf = (pack, order) => {
  const dir = join(SAMPLES, pack, 'images');
  const files = readdirSync(dir);
  return (order ?? files).filter((f) => files.includes(f)).map((f) => join(dir, f));
};

let browser;
try {
  const user = await makeUser('builders');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addCookies([{ name: COOKIE_NAME, value: user.cookieValue, url: BASE }]);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const shot = async (name) => {
    if (!process.env.SHOTS) return;
    mkdirSync(process.env.SHOTS, { recursive: true });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600); // let button transitions finish
    await page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true });
  };
  const next = page.getByText('Next', { exact: true });
  const toml = () => page.locator('pre code').innerText();
  const block = (name) => page.getByRole('region', { name, exact: true });

  async function start(type, title, files) {
    await page.goto(`${BASE}/upload`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: type, exact: true }).click();
    await next.click();
    await page.getByPlaceholder('Enter a descriptive title').fill(title);
    await page.getByPlaceholder(/nature, landscape/).fill('e2e');
    await page.getByRole('button', { name: 'No AI' }).click();
    await next.click();
    await page.locator('input[type=file]').setInputFiles(files);
    await page.getByText(`Uploaded Files (${files.length})`).waitFor();
    await next.click();
  }
  async function submitAndLoad(buttonName = 'Upload Wallpack') {
    await next.click();
    await page.getByRole('button', { name: buttonName }).click();
    await page.waitForURL(/\/packs\//, { timeout: 120_000 });
    const slug = new URL(page.url()).pathname.split('/').pop();
    const { data: pack } = await admin.from('packs').select('id').eq('slug', slug).single();
    const { data: v } = await admin.from('pack_versions').select('status, kind, schedule').eq('pack_id', pack.id).single();
    return v;
  }

  // ---- Daypack --------------------------------------------------------------
  await start('Daypack', `Harbour ${runId}`, imagesOf('harbour-lights', ['dawn.jpg', 'morning.jpg', 'afternoon.jpg', 'sunset.jpg', 'night.jpg']));
  check('daypack starts with Dawn, Day, Sunset, Night blocks',
    await block('Dawn').isVisible() && await block('Day').isVisible() && await block('Sunset').isVisible() && await block('Night').isVisible());
  check('Next is disabled while blocks have no images', await next.isDisabled());
  await page.getByRole('button', { name: /Auto-assign Images/ }).click();
  check('an empty block keeps Next disabled', await next.isDisabled());
  check('the pool marks images that are used', await page.getByText('Used once').count() === 5);

  // Add night.jpg to Night through the pool.
  await page.getByLabel('Select night.jpg').check();
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Night' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  check('with every block filled, Next is enabled', await next.isEnabled());

  // Start times: an event, an offset, a clock time.
  await block('Day').getByRole('combobox').click();
  await page.getByRole('option', { name: 'Noon' }).click();
  await block('Sunset').getByLabel('Offset').fill('-45m');
  await block('Sunset').getByLabel('Offset').press('Enter');
  await block('Night').getByRole('combobox').click();
  await page.getByRole('option', { name: 'Clock time' }).click();
  await block('Night').getByLabel('Start time').fill('21:30');
  // Two images in Dawn: change every 30 minutes.
  await block('Dawn').getByRole('button', { name: 'Every…' }).click();
  await block('Dawn').getByRole('button', { name: '30 min' }).click();
  const dayToml = await toml();
  check('schedule.toml has the new start times and rotation',
    dayToml.includes('at = "noon"') && dayToml.includes('at = "sunset-45m"') && dayToml.includes('at = "21:30"') && dayToml.includes('rotate = "every 30m"'), dayToml);
  check('blocks are written in time order',
    dayToml.indexOf('"dawn"') < dayToml.indexOf('"noon"') && dayToml.indexOf('"noon"') < dayToml.indexOf('"sunset-45m"') && dayToml.indexOf('"sunset-45m"') < dayToml.indexOf('"21:30"'));
  await shot('b-1-daypack');

  // Edit as text and come back.
  await page.getByRole('button', { name: 'Edit as text' }).click();
  check('Edit as text shows the editor', await page.getByLabel('schedule.toml').isVisible());
  check('a schedule the builder can show can go back', await page.getByRole('button', { name: 'Back to builder' }).isEnabled());
  await page.getByRole('button', { name: 'Back to builder' }).click();
  check('back in the builder', await block('Dawn').isVisible());

  const day = await submitAndLoad();
  check('daypack stored as a pending timeblocks pack', day.status === 'pending' && day.kind === 'timeblocks');
  check('stored slots match what was built', JSON.stringify(day.schedule.slot.map((s) => s.at)) === '["dawn","noon","sunset-45m","21:30"]'
    && day.schedule.slot[0].rotate === 'every 30m' && day.schedule.slot[0].images.length === 2, JSON.stringify(day.schedule.slot));

  // ---- Weekpack -------------------------------------------------------------
  await start('Weekpack', `Colours ${runId}`, imagesOf('colour-week', ['mon.jpg', 'tue.jpg', 'wed.jpg', 'thu.jpg', 'fri.jpg', 'sat.jpg', 'sun.jpg']));
  check('weekpack starts with one group per day', await block('Monday').isVisible() && await block('Sunday').isVisible());
  await page.getByRole('button', { name: /Auto-assign Images/ }).click();
  check('one image per day is valid', await next.isEnabled());

  await page.getByRole('button', { name: 'Weekdays + weekend' }).click();
  check('preset makes two groups', await block('Weekdays').isVisible() && await block('Weekend').isVisible() && !(await block('Monday').isVisible()));
  check('images the new groups dropped are flagged', await page.getByText(/5 images aren’t used yet/).isVisible());
  await page.getByRole('button', { name: /Auto-assign Images/ }).click();
  check('after auto-assign, Next is enabled', await next.isEnabled());

  await block('Weekend').getByRole('button', { name: 'Saturday' }).click();
  check('a day in no group is called out', await page.getByText(/Saturday isn’t in any group yet/).isVisible());
  check('…and blocks Next', await next.isDisabled());
  check('the freed day can be picked by the other group', await block('Weekdays').getByRole('button', { name: 'Saturday' }).isEnabled());
  await block('Weekend').getByRole('button', { name: 'Saturday' }).click();
  check('back to every day covered', await next.isEnabled());

  await block('Weekdays').getByRole('button', { name: 'Every…' }).click();
  await block('Weekdays').getByLabel('Custom interval').fill('3 hours');
  await block('Weekdays').getByLabel('Custom interval').press('Enter');
  await block('Weekend').getByRole('button', { name: 'Every…' }).click();
  await block('Weekend').getByLabel('Custom interval').fill('10d');
  await block('Weekend').getByLabel('Custom interval').press('Enter');
  check('intervals over 7 days are refused', await block('Weekend').getByText('Between 5 minutes and 7 days').isVisible());
  const weekToml = await toml();
  check('custom interval is written in spec form', weekToml.includes('rotate = "every 3h"'), weekToml);
  await shot('b-2-weekpack');

  const week = await submitAndLoad();
  check('weekpack stored as a pending days pack', week.status === 'pending' && week.kind === 'days');
  check('stored day groups', JSON.stringify(week.schedule.slot.map((s) => s.days)) === '[["mon","tue","wed","thu","fri"],["sat","sun"]]'
    && week.schedule.slot[0].rotate === 'every 3h', JSON.stringify(week.schedule.slot));
  check('no page errors in the browser', pageErrors.length === 0, pageErrors.join(' | '));
} catch (e) {
  check('unexpected error', false, e.stack);
} finally {
  await browser?.close();
  await cleanup();
  process.exit(summary() ? 1 : 0);
}
