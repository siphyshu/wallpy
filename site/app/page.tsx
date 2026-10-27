import HeroSection from '@/components/homepage/HeroSection';
import PackKindsSection from '@/components/homepage/PackKindsSection';
import GallerySection from '@/components/homepage/GallerySection';
import InstallSection from '@/components/homepage/InstallSection';
import CreateSection from '@/components/homepage/CreateSection';
import FaqSection from '@/components/homepage/FaqSection';
import Footer from '@/components/footer';
import { listPublicPacks } from '@/lib/data/packs';

export const metadata = { alternates: { canonical: '/' } };

// Static, rebuilt at most every ten minutes, so "From the gallery" is in the
// HTML without a database call per visit.
export const revalidate = 600;

export default async function Home() {
  const { packs } = await listPublicPacks({ sort: 'popular', limit: 3 }).catch(() => ({ packs: [] }));
  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background">
      <HeroSection />
      <PackKindsSection />
      <GallerySection packs={packs} />
      <CreateSection />
      <InstallSection />
      <FaqSection />
      <Footer />
    </div>
  );
}
