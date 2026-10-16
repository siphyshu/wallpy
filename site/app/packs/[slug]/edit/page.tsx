import { notFound, redirect } from 'next/navigation';
import UploadWizard from '@/components/upload/UploadWizard';
import { getCurrentProfile } from '@/lib/data/profiles';
import { getPackForEditing } from '@/lib/data/editing';

export const metadata = { title: 'Update a wallpack | Wallpy' };

/** A new version of one of your packs: changes after review, or an update. */
export default async function EditPackPage({ params }: PageProps<'/packs/[slug]/edit'>) {
  const { slug } = await params;
  if (!(await getCurrentProfile())) redirect(`/auth/login?redirect=/packs/${slug}/edit`);
  const pack = await getPackForEditing(slug);
  // Someone else's pack (or none): not found, same as for private packs.
  if (!pack) notFound();
  // A version in review (or a taken-down pack) can't be changed; the pack page says why.
  if (!pack.canSubmit) redirect(`/packs/${slug}`);
  return <UploadWizard edit={pack} />;
}
