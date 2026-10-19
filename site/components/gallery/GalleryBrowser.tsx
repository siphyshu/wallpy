"use client"

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { isCategory } from '@/lib/packs/categories';
import { normalizeTag } from '@/lib/packs/limits';
import type { PackSort } from '@/lib/data/packs';
import GalleryGrid from '@/components/gallery/GalleryGrid';
import GalleryFilters from '@/components/gallery/GalleryFilters';
import { Page, PageHeader } from '@/components/ui/page';
import GallerySearch from '@/components/gallery/GallerySearch';
import Footer from '@/components/footer';

const SORTS: readonly PackSort[] = ['newest', 'popular', 'rating'];

/**
 * The gallery's filters live in the URL (?q=&category=&tag=&sort=&ai=hide&page=)
 * so back/forward and shared links show the same results. Changes push a
 * history entry; typing in search replaces it (debounced).
 */
export default function GalleryBrowser() {
  const params = useSearchParams();
  const urlSearch = params.get('q') ?? '';
  const categoryParam = params.get('category');
  const selectedCategory = isCategory(categoryParam) ? categoryParam : 'all';
  const tag = normalizeTag(params.get('tag') ?? '');
  const sortBy: PackSort = SORTS.find((s) => s === params.get('sort')) ?? 'newest';
  const hideAi = params.get('ai') === 'hide';
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const itemsPerPage = 9;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Back/forward: the box follows the URL (adjusted during render, not in an effect).
  const [syncedSearch, setSyncedSearch] = useState(urlSearch);
  if (syncedSearch !== urlSearch) {
    setSyncedSearch(urlSearch);
    setSearchInput(urlSearch);
  }
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  /** Write changes to the URL. Anything but a page change starts again from page 1. */
  const update = useCallback((changes: Record<string, string | null>, mode: 'push' | 'replace' = 'push') => {
    const next = new URLSearchParams(window.location.search);
    if (!('page' in changes)) next.delete('page');
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  }, []);

  const changeSearch = (query: string) => {
    setSearchInput(query);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => update({ q: query.trim() || null }, 'replace'), 300);
  };
  const changeCategory = (category: string) => update({ category: category === 'all' ? null : category });
  const clearTag = () => update({ tag: null });
  const toggleHideAi = () => update({ ai: hideAi ? null : 'hide' });
  const setPage = (n: number) => update({ page: n > 1 ? String(n) : null });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // // Scroll to grid on page change
  // useEffect(() => {
  //   if (gridRef.current) {
  //     gridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  //   }
  // }, [page]);

  const sortOptions: { id: PackSort; name: string; icon: React.ReactNode }[] = [
    { id: 'newest', name: 'Newest', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
    )},
    { id: 'popular', name: 'Popular', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    )},
    { id: 'rating', name: 'Most Favourited', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    )}
  ];

  const handleSortChange = (optionId: PackSort) => {
    update({ sort: optionId === 'newest' ? null : optionId });
    setIsFilterOpen(false);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background">
      <Page width="browse">
        <div>
          <PageHeader
            title="Gallery"
            description="Discover and install beautiful wallpaper packs created by our community. Browse through our collection and find your perfect desktop background."
          />

          {/* Search and Filter Section */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
              <div className="flex-1 w-full">
                <div className="flex gap-3 items-center max-w-2xl mx-auto">
                  <div className="flex-1">
                    <GallerySearch
                      searchQuery={searchInput}
                      onSearchChange={changeSearch}
                    />
                  </div>
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      aria-expanded={isFilterOpen}
                      className={`relative p-4 rounded-lg border border-white/10 transition-all duration-200 flex items-center gap-2
                        ${isFilterOpen ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'}`}
                    >
                      {hideAi && (
                        <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-white/70" aria-label="Filter on" />
                      )}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/50" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                      </svg>
                      <span className="text-white/70">
                        {sortOptions.find(opt => opt.id === sortBy)?.name}
                      </span>
                    </button>

                    {/* Filter Dropdown */}
                    {isFilterOpen && (
                      <div className="absolute right-0 mt-2 w-56 rounded-lg bg-[#1d1d1d] border border-white/10 shadow-lg backdrop-blur-sm z-40">
                        <div className="py-1">
                          {sortOptions.map((option) => (
                            <button
                              key={option.id}
                              onClick={() => handleSortChange(option.id)}
                              className={`w-full px-4 py-2 text-sm flex items-center gap-2 transition-colors duration-200
                                ${sortBy === option.id
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                              {option.icon}
                              {option.name}
                            </button>
                          ))}
                        </div>
                        <div className="border-t border-white/10 py-1">
                          <button
                            role="menuitemcheckbox"
                            aria-checked={hideAi}
                            onClick={toggleHideAi}
                            className={`w-full px-4 py-2 text-sm flex items-center gap-2 transition-colors duration-200
                              ${hideAi ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                              {hideAi ? (
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              ) : (
                                <path fillRule="evenodd" d="M3 10a7 7 0 1114 0 7 7 0 01-14 0zm7-5a5 5 0 100 10 5 5 0 000-10z" clipRule="evenodd" />
                              )}
                            </svg>
                            Hide AI packs
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Filters */}
          <div className="mb-12">
            <GalleryFilters
              selectedCategory={selectedCategory}
              onCategoryChange={changeCategory}
            />
            {tag && (
              <div className="mt-4 flex justify-center">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 pl-3 pr-1 py-1 text-sm text-white">
                  Tagged #{tag}
                  <button
                    type="button"
                    onClick={clearTag}
                    aria-label={`Remove tag ${tag}`}
                    className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Gallery Grid */}
          <div ref={gridRef}>
            <GalleryGrid
              searchQuery={urlSearch}
              category={selectedCategory}
              tag={tag}
              sortBy={sortBy}
              hideAi={hideAi}
              page={page}
              itemsPerPage={itemsPerPage}
              onPageChange={setPage}
            />
          </div>
        </div>
      </Page>

      <Footer />
    </div>
  );
}