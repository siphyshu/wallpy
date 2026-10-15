import Image from 'next/image';
import Link from 'next/link';

export default function PacksSection({ type, packs = [] }) {
  const title = type === 'uploaded' ? 'Uploaded Packs' : 'Favourited Packs';
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-serif text-white">{title}</h2>
        <span className="px-3 py-1 bg-white/10 rounded-full text-sm text-white/70 border border-white/20">
          {packs.length}
        </span>
      </div>
      
      {packs.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          {type === 'uploaded' ? (
            <p className="text-white/70 text-sm">No uploaded packs to display.{' '}
              <Link href="/upload" className="text-blue-400 hover:underline">Upload your first pack</Link>.
            </p>
          ) : (
            <p className="text-white/70 text-sm">No favourited packs yet.{' '}
              <Link href="/gallery" className="text-blue-400 hover:underline">Explore the gallery</Link>.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map(pack => (
            <div 
              key={pack.id} 
              className="group bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-4 hover:bg-white/10 transition-all duration-300 hover:shadow-lg hover:shadow-white/5 hover:-translate-y-1"
            >
              <div className="relative aspect-video mb-4 rounded-lg overflow-hidden bg-white/5">
                {pack.preview_url ? (
                  <Image
                    src={pack.preview_url}
                    alt={pack.name || pack.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-white text-sm truncate">
                    {pack.name || pack.title}
                  </h3>
                  {pack.description && (
                    <p className="text-white/70 text-xs mt-1 line-clamp-2">
                      {pack.description}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  {type === 'uploaded' && pack.status && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      pack.status === 'under review' 
                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' 
                        : pack.status === 'uploaded' 
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}>
                      {pack.status}
                    </span>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    {pack.downloads && (
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span>{pack.downloads}</span>
                      </div>
                    )}
                    {pack.rating && (
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span>{pack.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 