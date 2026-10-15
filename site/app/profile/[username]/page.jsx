import ProfileCard from '@/components/profile/ProfileCard';
import PacksSection from '@/components/profile/PacksSection';
import Footer from '@/components/footer';
import { getUserByUsername, getCurrentUser } from '@/lib/data/users';
import { getPacksByUsername, getFavouritedPacksByUsername } from '@/lib/data/packs';

export default async function ProfilePage({ params }) {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) {
    return (
      <div className="relative min-h-screen overflow-x-hidden text-white bg-background/80">
        <div className="flex min-h-screen items-center justify-center mt-20 pt-24">
          <div className="text-center">
            <h1 className="text-2xl font-serif mb-4">User Not Found</h1>
            <p className="text-white/70">The user you're looking for doesn't exist.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
  const uploadedPacks = await getPacksByUsername(username);
  const favouritedPacks = await getFavouritedPacksByUsername(username);
  const currentUser = await getCurrentUser();
  const isCurrentUser = currentUser && currentUser.id === user.id;

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background/80">
      <section className="relative mt-20 pt-24 px-6 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:w-1/3">
              <ProfileCard user={user} isCurrentUser={isCurrentUser} />
            </div>
            <div className="w-full lg:w-2/3 flex flex-col gap-8">
              <PacksSection type="uploaded" packs={uploadedPacks} />
              <PacksSection type="favourited" packs={favouritedPacks} />
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
} 