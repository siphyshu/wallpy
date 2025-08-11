"use client"

import Image from "next/image";
import HeroSection from '@/components/homepage/HeroSection';
import GallerySection from '@/components/homepage/GallerySection';
import Footer from '@/components/footer';
import InstallSection from '@/components/homepage/InstallSection';

export default function Home() {
  return (
    <div classame="relative min-h-screen overflow-x-hidden text-white bg-black">
      <div className="fixed inset-0 z-[-10]">
        <div className="w-full h-full bg-cover bg-center animate-daycycle bg-[url('/wallpapers/day.jpg')] priority" />
      </div>
      
      <HeroSection />
      {/* <InstallSection /> */}
      <GallerySection />
      <Footer isHome={true} />
    </div>
  );
}
