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
        // Filtering, sorting and pagination all happen on the server.
        const params = new URLSearchParams({
          limit: itemsPerPage.toString(),
          offset: ((page - 1) * itemsPerPage).toString(),
          sort: sortBy,
        });
        if (searchQuery) params.append('search', searchQuery);
        // Categories are themes, stored as tags.
        if (category && category !== 'all') params.append('tag', category);

        const response = await fetch(`/api/packs?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch packs');
        }
        const data = await response.json();
        setPacks(data.packs);
        setTotalPages(Math.max(1, Math.ceil(data.total / itemsPerPage)));

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
