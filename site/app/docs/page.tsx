import { Page, PageHeader } from '@/components/ui/page';
import Link from 'next/link';
import Footer from '@/components/footer';
import CopyCommand from '@/components/CopyCommand';
import InstallOptions from '@/components/install/InstallOptions';

export const metadata = {
  title: 'Docs | Wallpy',
  description: 'Install the Wallpy CLI, use a pack, and how it keeps your wallpaper changing.',
};

// Content follows cli/README.md; keep the two in step.

const SECTIONS = [
  { id: 'install', title: 'Install' },
  { id: 'start', title: 'Get started' },
  { id: 'commands', title: 'Commands' },
  { id: 'how-it-works', title: 'How it works' },
  { id: 'uninstall', title: 'Uninstall' },
  { id: 'make-a-pack', title: 'Make a pack' },
];

const COMMANDS: { command: string; what: string }[] = [
  { command: 'wallpy', what: "What's showing, today's schedule on the sky, and the next change." },
  { command: 'wallpy use <pack>', what: 'Make a pack your wallpaper: a name from the gallery, a gallery link or a folder. Installs it if needed.' },
  { command: 'wallpy browse [search]', what: 'The gallery in your terminal, with previews. Enter uses a pack, o opens its page on this site, / searches.' },
  { command: 'wallpy show <pack> [--at 18:45]', what: "A pack's credit, schedule and a preview, now or at another time. Works before you install it; --web opens its page here." },
  { command: 'wallpy list', what: 'Your installed packs.' },
  { command: 'wallpy get <pack>', what: 'Download a pack without switching to it.' },
  { command: 'wallpy update [pack...]', what: 'Get new versions of your packs; unchanged images are kept.' },
  { command: 'wallpy remove <pack>', what: 'Delete an installed pack.' },
  { command: 'wallpy location [city | auto | lat,lon]', what: 'Where you are, for real sunrise and sunset times.' },
  { command: 'wallpy pause / resume', what: 'Hold the current wallpaper for a while, then carry on.' },
  { command: 'wallpy doctor', what: 'Check everything, with a fix for anything wrong.' },
  { command: 'wallpy check <folder>', what: "Check a pack you're making against the pack format." },
  { command: 'wallpy uninstall [--all | --keep]', what: 'Remove Wallpy from this computer.' },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 flex flex-col gap-4">
      <h2 className="text-3xl font-serif">{title}</h2>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white/5 border border-white/10 rounded-lg p-6 flex flex-col gap-4">{children}</div>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[0.9em] text-white bg-white/10 rounded px-1.5 py-0.5">{children}</code>;
}

export default function DocsPage() {
  return (
    <div className="min-h-screen text-white bg-background">
      <Page width="reading">
        <PageHeader
          title="Docs"
          description="Wallpy is a small command-line program that sets your wallpaper from a pack and keeps it changing through the day, the week or on a schedule of its own."
        />

        <nav aria-label="On this page" className="flex flex-wrap gap-2 mb-14">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="px-3 py-1 rounded-full bg-white/10 text-sm text-white/70 hover:bg-white/20 hover:text-white transition-colors">
              {s.title}
            </a>
          ))}
        </nav>

        <div className="flex flex-col gap-16">
          <Section id="install" title="Install">
            <p className="text-white/70">One binary, no runtime to install first.</p>
            <Card>
              <InstallOptions />
            </Card>
            <p className="text-sm text-white/50">
              Once a day Wallpy asks GitHub whether there&apos;s a newer release and, if so, says so in one
              line with the upgrade command for however you installed it.
              Set <Code>WALLPY_NO_UPDATE_CHECK=1</Code> to turn that off.
            </p>
          </Section>

          <Section id="start" title="Get started">
            <Card>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-white/70">Pick a pack from the gallery, right in your terminal:</p>
                <CopyCommand command="wallpy browse" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-white/70">
                  Or use one by name. Every pack page in the <Link href="/gallery" className="underline underline-offset-4 hover:text-white">gallery</Link> has its command:
                </p>
                <CopyCommand command="wallpy use zelda-wind-waker" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-white/70">Then see what&apos;s showing and when it changes next:</p>
                <CopyCommand command="wallpy" />
              </div>
            </Card>
            <p className="text-sm text-white/50">
              Packs that follow the sun use standard times (sunrise 06:30, sunset 18:30) until Wallpy
              knows roughly where you are. Running <Code>wallpy</Code> on its own before you have a pack
              asks you, then offers the gallery; or set it any time with <Code>wallpy location &lt;city&gt;</Code>{' '}
              (or <Code>auto</Code> to guess from your time zone).
            </p>
          </Section>

          <Section id="commands" title="Commands">
            <dl className="bg-white/5 border border-white/10 rounded-lg divide-y divide-white/10">
              {COMMANDS.map((c) => (
                <div key={c.command} className="px-6 py-4 flex flex-col gap-1">
                  <dt className="font-mono text-sm text-white">{c.command}</dt>
                  <dd className="text-sm text-white/70">{c.what}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-white/50">
              <Code>wallpy --help</Code> and <Code>wallpy &lt;command&gt; --help</Code> show every option.
            </p>
          </Section>

          <Section id="how-it-works" title="How it works">
            <p className="text-white/70">
              When you use a pack, Wallpy starts a small background agent that sleeps until the next
              scheduled change, sets the wallpaper, and goes back to sleep. It starts again when you log in,
              so your wallpaper keeps changing after a restart.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-lg divide-y divide-white/10 text-sm">
              {[
                ['macOS', 'A launchd agent; sets every display (the current Space on each).', '~/Library/Application Support/Wallpy'],
                ['Windows', 'A Task Scheduler task at logon.', '%LOCALAPPDATA%\\Wallpy'],
                ['Linux', 'An XDG autostart entry; GNOME, Cinnamon, MATE, KDE Plasma, Xfce, LXQt, sway, Hyprland (swww or hyprpaper) or feh.', '~/.local/share/wallpy'],
              ].map(([os, agent, home]) => (
                <div key={os} className="px-6 py-4 flex flex-col gap-1">
                  <span className="font-medium text-white">{os}</span>
                  <span className="text-white/70">{agent}</span>
                  <span className="text-white/50">Packs and settings: <Code>{home}</Code></span>
                </div>
              ))}
            </div>
            <p className="text-sm text-white/50">
              Every image is checked against the pack&apos;s checksums when it&apos;s downloaded. If something
              looks wrong, <Code>wallpy doctor</Code> checks the agent, your packs and your location, and says how to fix it.
            </p>
          </Section>

          <Section id="uninstall" title="Uninstall">
            <Card>
              <CopyCommand command="wallpy uninstall" />
              <p className="text-sm text-white/70">
                Stops and removes the background agent, keeps the wallpaper that&apos;s on screen, and asks
                whether to delete your packs and settings too (<Code>--all</Code> deletes them,{' '}
                <Code>--keep</Code> keeps them, without asking). If they go, the current wallpaper is saved
                to your Pictures folder first. It finishes by showing the command that removes Wallpy
                itself, for however you installed it. To stop changes for a while instead, use{' '}
                <Code>wallpy pause</Code>.
              </p>
            </Card>
          </Section>

          <Section id="make-a-pack" title="Make a pack">
            <p className="text-white/70">
              A pack is a folder of images and a <Code>schedule.toml</Code> that says which ones show when:
              blocks through the day (following the sun or the clock), days of the week, or an album that
              rotates. The easiest way to make one is the builder on this site; it writes the schedule for you.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/upload" className="px-5 py-2 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors">
                Create a pack
              </Link>
              <a
                href="https://github.com/siphyshu/wallpy/blob/main/spec/README.md"
                className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                Read the pack format
              </a>
            </div>
            <p className="text-sm text-white/50">
              Making one by hand? <Code>wallpy check ./my-pack</Code> validates it, and{' '}
              <Code>wallpy use ./my-pack</Code> tries it on your desktop.
            </p>
          </Section>
        </div>
      </Page>
      <Footer />
    </div>
  );
}
