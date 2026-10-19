import HeroSection from '@/components/homepage/HeroSection';
import PackKindsSection from '@/components/homepage/PackKindsSection';
import GallerySection from '@/components/homepage/GallerySection';
import InstallSection from '@/components/homepage/InstallSection';
import CreateSection from '@/components/homepage/CreateSection';
import FaqSection from '@/components/homepage/FaqSection';
import Footer from '@/components/footer';

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background">
      <HeroSection />
      <PackKindsSection />
      <GallerySection />
      <InstallSection />
      <CreateSection />
      <FaqSection />
      <Footer />
    </div>
  );
}
