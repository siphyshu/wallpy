import { notFound } from 'next/navigation';
import ProfileCard from '@/components/profile/ProfileCard';
import PacksSection from '@/components/profile/PacksSection';
import Footer from '@/components/footer';
import { getProfileByUsername, getCurrentProfile } from '@/lib/data/profiles';
import { listPacksByOwner, listMyFavourites } from '@/lib/data/packs';

export async function generateMetadata({ params }) {
  const profile = await getProfileByUsername((await params).username);
  if (!profile) return { title: 'Profile not found | Wallpy' };
  return { title: `${profile.name || profile.username} (@${profile.username}) | Wallpy` };
}

export default async function ProfilePage({ params }) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const current = await getCurrentProfile();
  const isCurrentUser = current?.id === profile.id;
  const [packs, favourites] = await Promise.all([
    listPacksByOwner(profile.id),
    // Favourites are private: only the owner sees theirs.
    isCurrentUser ? listMyFavourites() : Promise.resolve([]),
  ]);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background/80">
      <section className="relative mt-20 pt-24 px-6 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:w-1/3">
              <ProfileCard user={profile} isCurrentUser={isCurrentUser} />
            </div>
            <div className="w-full lg:w-2/3 flex flex-col gap-8">
              <PacksSection type="uploaded" packs={packs} />
              {isCurrentUser && <PacksSection type="favourited" packs={favourites} />}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
