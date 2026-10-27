import { redirect } from 'next/navigation';
import UploadWizard from '@/components/upload/UploadWizard';
import { getCurrentProfile } from '@/lib/data/profiles';

export const metadata = { title: 'Create a wallpack | Wallpy', robots: { index: false } };

// Uploading needs an account: send signed-out visitors to log in and back.
export default async function UploadPage() {
  if (!(await getCurrentProfile())) redirect('/auth/login?redirect=/upload');
  return <UploadWizard />;
}
