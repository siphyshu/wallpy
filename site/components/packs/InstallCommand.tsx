import CopyCommand from '@/components/CopyCommand';

/** `wallpy use` installs the pack if needed, sets it now and keeps it changing. */
export default function InstallCommand({ slug }: { slug: string }) {
  return <CopyCommand command={`wallpy use ${slug}`} variant="primary" label="install command" />;
}
