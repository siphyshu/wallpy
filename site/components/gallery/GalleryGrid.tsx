"use client"

import { useState, useEffect, useRef } from 'react';
import GalleryCard from '@/components/gallery/GalleryCard';
import type { PackSort } from '@/lib/data/packs';
import type { PackCard } from '@/lib/types';
import { isCategory } from '@/lib/packs/categories';
import { errorMessage } from '@/lib/utils';
import { GALLERY_PAGE_SIZE, galleryApiParams, type GalleryInitial } from '@/lib/gallery';

export default function GalleryGrid({ searchQuery, category, tag = '', sortBy, hideAi = false, page = 1, onPageChange, initial = null }: {
  searchQuery: string;
  hideAi?: boolean;
  category: string;
  tag?: string;
  sortBy: PackSort;
  page?: number;
  onPageChange: (page: number) => void;
  /** The first page, rendered on the server; used while the view still matches it. */
  initial?: GalleryInitial | null;
}) {
  // Filtering, sorting and pagination all happen on the server.
  const query = galleryApiParams({
    search: searchQuery,
    category: isCategory(category) ? category : null,
    tag,
    sort: sortBy,
    hideAi,
    page,
  }).toString();
  const fromServer = initial?.key === query ? initial : null;

  const [packs, setPacks] = useState<PackCard[]>(fromServer?.packs ?? []);
  const [loading, setLoading] = useState(!fromServer);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(Math.max(1, Math.ceil((fromServer?.total ?? 0) / GALLERY_PAGE_SIZE)));
  // The server already answered the first view; don't fetch it again on mount.
  const skip = useRef(fromServer?.key);

  useEffect(() => {
    if (skip.current === query) {
      skip.current = undefined;
      return;
    }
    skip.current = undefined;
    const fetchPacks = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/packs?${query}`);
        if (!response.ok) {
          throw new Error('Failed to fetch packs');
        }
        const data = await response.json();
        setPacks(data.packs);
        setTotalPages(Math.max(1, Math.ceil(data.total / GALLERY_PAGE_SIZE)));

      } catch (err) {
        console.error('Error fetching packs:', err);
        setError(errorMessage(err));
        setPacks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPacks();
  }, [query]);

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
