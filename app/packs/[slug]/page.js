"use client";

import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { wallpapers } from '@/data/wallpapers';
import NavBar from '@/components/navbar';
import Footer from '@/components/footer';
import { useState } from 'react';

export default function WallpackPage() {
  const params = useParams();
  const slug = params.slug;
  const wallpack = wallpapers.find(w => w.url.includes(slug));
  const [selectedImage, setSelectedImage] = useState(wallpack.preview);

  if (!wallpack) {
    return (
      <div className="min-h-screen bg-background/80 text-white">
        <NavBar />
        <div className="max-w-7xl mx-auto px-6 py-24 text-center">
          <h1 className="text-4xl font-serif mb-4">Wallpack Not Found</h1>
          <p className="text-white/80">The wallpack you are looking for does not exist.</p>
          <Link href="/gallery" className="mt-6 inline-block px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
            Back to Gallery
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // Simulate additional images for the wallpack
  const additionalImages = [
    wallpack.preview,
    '/wallpapers/day.jpg',
    '/wallpapers/sunrise.jpg',
    '/wallpapers/sunset.jpg',
    '/wallpapers/night.jpg'
  ];

  return (
    <div className="min-h-screen bg-background/80 text-white mt-20">
      <NavBar />
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Pack wallpapers preview */}
          <div className="md:w-2/3">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden">
              <Image
                src={selectedImage}
                alt={wallpack.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="mt-4 flex overflow-x-auto gap-2 no-scrollbar">
              {additionalImages.map((img, index) => (
                <div
                  key={index}
                  className="relative h-40 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer aspect-video"
                  onClick={() => setSelectedImage(img)}
                >
                  <Image
                    src={img}
                    alt={`${wallpack.name} - Image ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pack Info */}
          <div className="md:w-1/3">
          <div className="flex flex-col items-start">
            <h1 className="text-4xl font-serif mb-2">{wallpack.name}</h1>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-white/80 text-sm">by</span>
              <div className="relative w-6 h-6 rounded-full overflow-hidden border border-white/20">
                <Image
                  src={wallpack.author_profile}
                  alt={wallpack.author}
                  fill
                  className="object-cover"
                />
              </div>
              <a
                href={wallpack.author_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/80 hover:text-white transition-colors text-sm"
              >
                {wallpack.author}
              </a>
            </div>
          </div>
            <p className="prose text-white/80 mb-4">A serene street frozen in a summer haze. Perfect for calm workflows. Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {['#anime', '#cityscape', '#summer', '#slice-of-life'].map((tag) => (
                <span key={tag} className="px-2 py-1 bg-white/10 rounded-full text-sm">{tag}</span>
              ))}
            </div>
            {/* <div className="flex items-center gap-2 mb-4">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/20">
                <Image
                  src={wallpack.author_profile}
                  alt={wallpack.author}
                  fill
                  className="object-cover"
                />
              </div>
              <a
                href={wallpack.author_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/80 hover:text-white transition-colors"
              >
                {wallpack.author}
              </a>
            </div> */}
            {/* <div className="flex items-center gap-4 mb-4 text-sm text-white/60">
              <div className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>{wallpack.rating.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>{wallpack.downloads}</span>
              </div>
            </div> */}
            <div className="flex flex-col mt-8 gap-2">
              <button className="flex-1 px-4 py-2 bg-white text-black rounded-lg hover:bg-white/90 transition-colors">
                Install with Wallpy
              </button>
              <button className="flex-1 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-white/80">
                Download ZIP
              </button>
            </div>
            {/* <div className="mt-8">
              <h2 className="text-2xl font-serif mb-4">Frequently Asked Questions</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">What is a dynamic wallpack?</h3>
                  <p className="text-white/80">A dynamic wallpack changes based on time of day, day of week, or is shuffled.</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">How do I install a wallpack?</h3>
                  <p className="text-white/80">Click the 'Install with Wallpy' button and follow the instructions in the CLI app.</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Can I download individual wallpapers?</h3>
                  <p className="text-white/80">Yes, you can download individual wallpapers by clicking the 'Download ZIP' button and extracting the files.</p>
                </div>
              </div>
            </div> */}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
} 