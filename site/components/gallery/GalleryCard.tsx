import Image from "next/image";
import Link from "next/link";
import { Blurhash } from "react-blurhash";
import type { PackCard } from "@/lib/types";
import AiUseLabel from "@/components/packs/AiUseLabel";

export default function GalleryCard({ wallpaper }: { wallpaper: PackCard }) {
  return (
    <div className="group">
      <div className="bg-white/5 p-4 rounded-lg border border-white/10 hover:bg-white/10 transition-all duration-300 hover:shadow-lg hover:shadow-white/5 hover:-translate-y-1">
        <Link href={wallpaper.url} className="block">
          <div className="relative w-full aspect-video mb-4 overflow-hidden rounded-lg">
            {wallpaper.blurhash && (
              <div className="absolute inset-0">
                <Blurhash
                  hash={wallpaper.blurhash}
                  width="100%"
                  height="100%"
                  resolutionX={32}
                  resolutionY={32}
                  punch={1}
                />
              </div>
            )}
            <Image 
              src={wallpaper.preview} 
              alt={wallpaper.name} 
              fill 
              className="object-cover transition-transform duration-300 group-hover:scale-105 relative z-10" 
              unoptimized={wallpaper.preview?.startsWith('http')}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20" />
            {wallpaper.category && (
              <span className="absolute top-2 left-2 z-30 inline-flex items-center rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                {wallpaper.kindLabel}
              </span>
            )}
            <AiUseLabel aiUse={wallpaper.aiUse} className="absolute top-2 right-2 z-30 backdrop-blur-sm" />
          </div>
        </Link>
        
        <div className="flex flex-col gap-3">
          <Link href={wallpaper.url} className="block">
            <h3 className="font-semibold text-lg text-left truncate group-hover:text-white/90 transition-colors duration-200">
              {wallpaper.name}
            </h3>
          </Link>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <div className="relative w-6 h-6 rounded-full overflow-hidden border border-white/20">
                <Image 
                  src={wallpaper.author_profile} 
                  alt={wallpaper.author} 
                  fill 
                  className="object-cover" 
                />
              </div>
              {wallpaper.author_url?.startsWith('/') ? (
                <Link 
                  href={wallpaper.author_url}
                  className="hover:text-white transition-colors duration-200"
                >
                  {wallpaper.author}
                </Link>
              ) : wallpaper.author_url ? (
                <a
                  href={wallpaper.author_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors duration-200"
                >
                  {wallpaper.author}
                </a>
              ) : (
                <span>{wallpaper.author}</span>
              )}
            </div>
            
            {wallpaper.downloads > 0 && (
            <div className="flex items-center gap-4 text-sm text-white/60">
              <div className="flex items-center gap-1" title={`${wallpaper.downloads} downloads`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>{wallpaper.downloads}</span>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 