import Link from 'next/link';
import Footer from '@/components/footer';
import { Page, PageHeader } from '@/components/ui/page';
import { Code, CONTACT, LegalSection, UPDATED } from '@/components/legal';

export const metadata = {
  title: 'Privacy | Wallpy',
  description: 'What Wallpy collects, why, who can see it, and how to delete it.',
};

// Every statement here describes what the code does today (site/lib, supabase/migrations,
// cli/internal). When that changes, change this page in the same commit.

export default function PrivacyPage() {
  return (
    <div className="min-h-screen text-white bg-background">
      <Page width="reading">
        <PageHeader title="Privacy" description={`What Wallpy collects, why, and how to delete it. Last updated ${UPDATED}.`} />

        <div className="flex flex-col gap-12">
          <LegalSection id="short" title="The short version">
            <ul>
              <li>You can browse the gallery and install packs without an account.</li>
              <li>An account stores your email, your profile and the packs you upload. Your profile and published packs are public.</li>
              <li>No analytics, no ads, no tracking cookies, and nothing is sold.</li>
              <li>The Wallpy app keeps your location on your computer.</li>
              <li>You can delete your account, and everything private with it, from your profile.</li>
            </ul>
          </LegalSection>

          <LegalSection id="collect" title="What the website stores">
            <ul>
              <li><strong>Your account:</strong> your email address, a password (stored hashed, never readable) and your username.</li>
              <li><strong>Your profile:</strong> the name, bio, links, contact email, avatar and cover you add. All of it is public.</li>
              <li><strong>Your packs:</strong> the images, schedule and details you upload. A pack is public once a moderator approves it; until then only you and moderators can see it.</li>
              <li><strong>Favourites:</strong> the packs you favourite. Only you can see them; packs only show a total count.</li>
              <li><strong>Reports:</strong> when you report a pack, the reason, your note and that it was you. Only moderators can see reports.</li>
              <li><strong>Moderation:</strong> moderators&apos; decisions and notes on your packs, and the notices that tell you about them.</li>
              <li><strong>Downloads:</strong> when a pack is installed or downloaded, which pack and version, the day, whether it came from the app or the website, your account if you were signed in, and a scrambled form of your IP address that changes every day. That last part only stops one person counting twice in a day; it can&apos;t be turned back into your IP address or linked across days.</li>
            </ul>
          </LegalSection>

          <LegalSection id="cookies" title="Cookies and browser storage">
            <p>
              Signing in sets a cookie that keeps you signed in. Wallpy sets no other cookies. While you build a pack, the
              upload wizard saves a draft in your browser so a refresh doesn&apos;t lose it; it never leaves your
              browser and is cleared when you submit or start over.
            </p>
          </LegalSection>

          <LegalSection id="app" title="The Wallpy app">
            <ul>
              <li><strong>Your location</strong> is only used to work out sunrise and sunset, and it is saved on your computer. It is never sent to Wallpy. Cities are looked up in a list built into the app; searching for a small place that isn&apos;t in it sends what you typed to <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>&apos;s place search.</li>
              <li><strong>Packs</strong> are downloaded from this website and its image storage, and counted as downloads as described above.</li>
              <li><strong>Updates:</strong> once a day the app asks GitHub whether there&apos;s a newer version. Set <Code>WALLPY_NO_UPDATE_CHECK=1</Code> to turn that off.</li>
            </ul>
          </LegalSection>

          <LegalSection id="services" title="Services that handle your data">
            <ul>
              <li><a href="https://supabase.com" target="_blank" rel="noopener noreferrer">Supabase</a>: the database, accounts and sign-in emails.</li>
              <li><a href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer">Cloudflare</a>: storing and delivering images.</li>
              <li>The company that hosts this website, which handles every request to it.</li>
            </ul>
            <p>They process data only to run Wallpy. Nothing is shared with anyone else, except where the law requires it.</p>
          </LegalSection>

          <LegalSection id="delete" title="Changing and deleting your data">
            <p>
              Edit your profile at any time from your profile page. To delete your account, open your profile, choose
              Edit Profile and then Delete account. That removes your account, profile, favourites, reports, drafts and
              packs in review straight away. For your published packs you choose: delete them too, or leave them up
              credited to &ldquo;deleted user&rdquo;. Download counts stay, no longer linked to you. Copies may remain in
              our database provider&apos;s backups for a short time until they are replaced.
            </p>
            <p>
              For anything else, such as a copy of your data or a question about it, email{' '}
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </p>
          </LegalSection>

          <LegalSection id="children" title="Children">
            <p>You need to be at least 13 to create an account. Browsing and installing packs don&apos;t need one.</p>
          </LegalSection>

          <LegalSection id="changes" title="Changes and contact">
            <p>
              When this page changes, the date at the top changes too; a change that matters will also be announced on the site.
              Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also the <Link href="/terms">terms</Link>.
            </p>
          </LegalSection>
        </div>
      </Page>
      <Footer />
    </div>
  );
}
