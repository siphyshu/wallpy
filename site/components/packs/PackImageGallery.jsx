"use client"

import { useState } from 'react';
import Image from 'next/image';

export default function PackImageGallery({ images }) {
  const [selectedImage, setSelectedImage] = useState(images[0] || null);

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className="md:w-2/3">
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-white/5">
        {selectedImage && (
          <Image
            src={selectedImage}
            alt="Pack preview"
            fill
            className="object-cover"
            unoptimized={selectedImage.startsWith('http')}
          />
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-4 flex overflow-x-auto gap-2 no-scrollbar">
          {images.map((img, index) => (
            <div
              key={index}
              className={`relative h-40 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer aspect-video bg-white/5 border-2 transition-all ${
                selectedImage === img ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
              onClick={() => setSelectedImage(img)}
            >
              <Image
                src={img}
                alt={`Image ${index + 1}`}
                fill
                className="object-cover"
                unoptimized={img.startsWith('http')}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

