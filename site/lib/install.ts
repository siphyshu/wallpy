// How to install the CLI, per OS. The homepage and /docs both read this, so it
// stays in one place; keep it in step with cli/README.md and cli/.goreleaser.yaml.

export type Os = 'macos' | 'windows' | 'linux';

export type InstallMethod = {
  label: string;
  command?: string;
  /** For methods that are a download rather than a command. */
  link?: { href: string; text: string };
};

export const RELEASES_URL = 'https://github.com/siphyshu/wallpy/releases/latest';

export const INSTALL: Record<Os, { name: string; methods: InstallMethod[] }> = {
  macos: {
    name: 'macOS',
    methods: [{ label: 'Homebrew', command: 'brew install siphyshu/tap/wallpy' }],
  },
  windows: {
    name: 'Windows',
    methods: [
      { label: 'winget', command: 'winget install siphyshu.Wallpy' },
      { label: 'Scoop', command: 'scoop bucket add siphyshu https://github.com/siphyshu/scoop-bucket; scoop install wallpy' },
    ],
  },
  linux: {
    name: 'Linux',
    methods: [
      { label: 'Homebrew', command: 'brew install siphyshu/tap/wallpy' },
      // Arch (AUR) `yay -S wallpy-bin` comes back once the AUR account exists (cli/.goreleaser.yaml).
      { label: 'Debian, Fedora, Alpine', link: { href: RELEASES_URL, text: 'Download the .deb, .rpm or .apk' } },
    ],
  },
};

/** Best guess at the visitor's OS, for picking the first tab. */
export function detectOs(userAgent: string): Os {
  if (/windows/i.test(userAgent)) return 'windows';
  if (/mac os|macintosh/i.test(userAgent)) return 'macos';
  if (/linux|x11|cros/i.test(userAgent) && !/android/i.test(userAgent)) return 'linux';
  return 'macos';
}
