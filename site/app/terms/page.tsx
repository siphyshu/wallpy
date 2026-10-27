import Link from 'next/link';
import Footer from '@/components/footer';
import { Page, PageHeader } from '@/components/ui/page';
import { CONTACT, LegalSection, UPDATED } from '@/components/legal';

export const metadata = {
  title: 'Terms | Wallpy',
  description: 'The rules for using Wallpy and sharing packs on it.',
  alternates: { canonical: '/terms' },
};

const ISSUES = 'https://github.com/siphyshu/wallpy/issues';

export default function TermsPage() {
  return (
    <div className="min-h-screen text-white bg-background">
      <Page width="reading">
        <PageHeader title="Terms" description={`The rules for using Wallpy and sharing packs on it. Last updated ${UPDATED}.`} />

        <div className="flex flex-col gap-12">
          <LegalSection id="agreement" title="Using Wallpy">
            <p>
              Wallpy is a free website for sharing wallpaper packs and a free app that sets them on your desktop. By
              using either, you agree to these terms. If you don&apos;t, please don&apos;t use them.
            </p>
          </LegalSection>

          <LegalSection id="accounts" title="Accounts">
            <ul>
              <li>You need to be at least 13 to create an account.</li>
              <li>One account per person. Keep your password to yourself; you&apos;re responsible for what happens on your account.</li>
              <li>Don&apos;t pick a username or profile that pretends to be someone else.</li>
              <li>You can delete your account at any time from your profile.</li>
            </ul>
          </LegalSection>

          <LegalSection id="your-packs" title="Packs you upload">
            <ul>
              <li><strong>They stay yours.</strong> Uploading doesn&apos;t transfer ownership of your images.</li>
              <li><strong>You need the right to share them.</strong> Either you made the images, or you have the artist&apos;s permission or a licence that allows sharing them. Credit the artist when it isn&apos;t you.</li>
              <li><strong>Be accurate.</strong> The licence you choose and your answer about AI use must be true.</li>
              <li>
                <strong>What you let Wallpy do:</strong> store your pack, show it on the site, make smaller previews of its
                images, and let people download and use it under the licence you chose. This lasts while the pack is on
                Wallpy and is free of charge. When you delete a pack, its page and downloads stop; people who already
                installed it keep their copy.
              </li>
            </ul>
          </LegalSection>

          <LegalSection id="using-packs" title="Packs you install">
            <p>
              Each pack shows its licence on its page. &ldquo;Personal use only&rdquo; means on your own devices, not
              re-shared or sold. Creative Commons packs follow their licence. The images belong to their artists, not to
              Wallpy.
            </p>
          </LegalSection>

          <LegalSection id="not-allowed" title="What isn't allowed">
            <ul>
              <li>Images you don&apos;t have the right to share, or that leave out the artist&apos;s credit.</li>
              <li>Sexually explicit content, graphic violence, or content that harasses or demeans people.</li>
              <li>Anything illegal, or that helps someone break the law.</li>
              <li>Spam, misleading packs, or packs made to promote something.</li>
              <li>Trying to break, overload or get around the protections of the site or the app.</li>
            </ul>
          </LegalSection>

          <LegalSection id="moderation" title="Moderation">
            <p>
              Every pack and every new version is checked by a moderator before it becomes public. Moderators can ask for
              changes, decline a pack, or take down a published one, and say why. Takedowns are final; you can still ask
              about one by <a href={ISSUES} target="_blank" rel="noopener noreferrer">opening an issue</a> or emailing{' '}
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Accounts that keep breaking these terms may be removed.
            </p>
            <p>
              Anyone can report a pack from its page. If a pack uses your work without permission, report it or email{' '}
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a> with a link to the pack and to your original, and it will be
              taken down.
            </p>
          </LegalSection>

          <LegalSection id="app" title="The app">
            <p>
              The Wallpy app is open source under the{' '}
              <a href="https://github.com/siphyshu/wallpy/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT licence</a>,
              which covers its code. These terms cover the website and the packs on it.
            </p>
          </LegalSection>

          <LegalSection id="warranty" title="No guarantees">
            <p>
              Wallpy is free and provided as it is, without any warranty. It may change, pause or stop, and packs may be
              removed. As far as the law allows, Wallpy and its maintainers aren&apos;t liable for any loss or damage from
              using the site, the app or any pack.
            </p>
          </LegalSection>

          <LegalSection id="changes" title="Changes and contact">
            <p>
              These terms may change as Wallpy does; the date at the top shows the latest version, and a change that
              matters will also be announced on the site. Using Wallpy after a change means you accept it. Questions:{' '}
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also the <Link href="/privacy">privacy page</Link>.
            </p>
          </LegalSection>
        </div>
      </Page>
      <Footer />
    </div>
  );
}
