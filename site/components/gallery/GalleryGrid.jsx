import GalleryCard from '@/components/gallery/GalleryCard';
import { wallpapers } from '@/data/wallpapers';

export default function GalleryGrid({ searchQuery, category, sortBy, page = 1, itemsPerPage = 9, onPageChange }) {
  // Filter and sort wallpapers
  const filteredWallpapers = wallpapers
    .filter(wallpaper => {
      const matchesSearch = wallpaper.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = category === 'all' || wallpaper.category === category;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'popular':
          return b.downloads - a.downloads;
        case 'downloads':
          return b.downloads - a.downloads;
        case 'rating':
          return b.rating - a.rating;
        default:
          return 0;
      }
    });

  // Pagination logic
  const totalItems = filteredWallpapers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIdx = (page - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedWallpapers = filteredWallpapers.slice(startIdx, endIdx);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedWallpapers.map((wallpaper) => (
          <GalleryCard key={wallpaper.id} wallpaper={wallpaper} />
        ))}
      </div>
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-12">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="px-3 py-2 rounded-lg text-white/70 border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => onPageChange(i + 1)}
              className={`px-3 py-2 rounded-lg border transition-all duration-200
                ${page === i + 1 ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'}`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-2 rounded-lg text-white/70 border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
} 