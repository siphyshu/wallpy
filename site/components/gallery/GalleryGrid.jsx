"use client"

import { useState, useEffect } from 'react';
import GalleryCard from '@/components/gallery/GalleryCard';

export default function GalleryGrid({ searchQuery, category, sortBy, page = 1, itemsPerPage = 9, onPageChange }) {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchPacks = async () => {
      setLoading(true);
      setError(null);

      try {
        // Build query params
        const params = new URLSearchParams({
          limit: itemsPerPage.toString(),
          offset: ((page - 1) * itemsPerPage).toString(),
          published: 'true',
        });

        // Add search
        if (searchQuery) {
          params.append('search', searchQuery);
        }

        // Add pack_type filter (map category to pack_type)
        if (category && category !== 'all') {
          // Map category to pack_type if needed
          // For now, assuming category could be pack_type
          if (['daypack', 'weekpack', 'album'].includes(category)) {
            params.append('pack_type', category);
          }
        }

        const response = await fetch(`/api/packs?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch packs');
        }

        const data = await response.json();
        
        // Map database fields to GalleryCard expected format
        const mappedPacks = data.packs.map(pack => {
          const authorName = pack.is_original
            ? (pack.uploaded_by_user?.name || pack.uploaded_by_user?.username || 'Unknown')
            : (pack.author_name || 'Unknown');
          const authorUrl = pack.is_original
            ? (pack.uploaded_by_user?.username ? `/profile/${pack.uploaded_by_user.username}` : '#')
            : (pack.author_url || '#');
          const authorProfile = pack.is_original
            ? (pack.uploaded_by_user?.avatar_url || '/artists/anon.png')
            : '/artists/anon.png';

          return {
            id: pack.id,
            name: pack.title,
            url: `/packs/${pack.slug}`,
            preview: pack.preview_image_url || '/wallpapers/default.jpg',
            blurhash: pack.blurhash || null,
            author: authorName,
            author_url: authorUrl,
            author_profile: authorProfile,
            rating: 0, // Not in database yet
            downloads: pack.download_count || 0,
            createdAt: pack.created_at,
            category: pack.pack_type,
          };
        });

        // Sort client-side (API already sorts by created_at, but we need to handle other sorts)
        let sortedPacks = [...mappedPacks];
        switch (sortBy) {
          case 'newest':
            sortedPacks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
          case 'popular':
          case 'downloads':
            sortedPacks.sort((a, b) => b.downloads - a.downloads);
            break;
          case 'rating':
            sortedPacks.sort((a, b) => b.rating - a.rating);
            break;
          default:
            // Keep API order
            break;
        }

        setPacks(sortedPacks);
        
        // Calculate total pages (for now, assume we have more if we got a full page)
        // In a real implementation, API should return total count
        setTotalPages(Math.max(1, Math.ceil(sortedPacks.length / itemsPerPage)));

      } catch (err) {
        console.error('Error fetching packs:', err);
        setError(err.message);
        setPacks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPacks();
  }, [searchQuery, category, sortBy, page, itemsPerPage]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/70">Loading packs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <p className="text-red-400 mb-4">Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (packs.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-white/70 text-lg">No packs found</p>
        <p className="text-white/50 text-sm mt-2">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {packs.map((pack) => (
          <GalleryCard key={pack.id} wallpaper={pack} />
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
