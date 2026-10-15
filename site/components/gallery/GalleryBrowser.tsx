"use client"

import { useState, useRef, useEffect } from 'react';
import type { PackSort } from '@/lib/data/packs';
import GalleryGrid from '@/components/gallery/GalleryGrid';
import GalleryFilters from '@/components/gallery/GalleryFilters';
import GallerySearch from '@/components/gallery/GallerySearch';
import Footer from '@/components/footer';

export default function GalleryBrowser({ initialTag = 'all' }: { initialTag?: string }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialTag);
  const [hideAi, setHideAi] = useState(false);
  const [sortBy, setSortBy] = useState<PackSort>('newest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 9;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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

  // Changing what's shown starts again from page 1.
  const changeSearch = (query: string) => { setSearchQuery(query); setPage(1); };
  const changeCategory = (category: string) => { setSelectedCategory(category); setPage(1); };
  const toggleHideAi = () => { setHideAi((v) => !v); setPage(1); };

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
    setSortBy(optionId);
    setPage(1);
    setIsFilterOpen(false);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background/80">
      <section className="relative mt-20 pt-24 px-6 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-serif mb-6">Wallpy Gallery</h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto">
              Discover and install beautiful wallpaper packs created by our community.
              Browse through our collection and find your perfect desktop background.
            </p>
          </div>

          {/* Search and Filter Section */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
              <div className="flex-1 max-w-2xl">
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <GallerySearch 
                      searchQuery={searchQuery} 
                      onSearchChange={changeSearch} 
                    />
                  </div>
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className={`p-4 rounded-lg border border-white/10 transition-all duration-200 flex items-center gap-2
                        ${isFilterOpen ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/50" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                      </svg>
                      <span className="text-white/70">
                        {sortOptions.find(opt => opt.id === sortBy)?.name}
                      </span>
                    </button>
                    
                    {/* Filter Dropdown */}
                    {isFilterOpen && (
                      <div className="absolute right-0 mt-2 w-48 rounded-lg bg-[#1d1d1d] border border-white/10 shadow-lg backdrop-blur-sm">
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
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Filters */}
          <div className="mb-12 flex flex-col items-center gap-4">
            <GalleryFilters 
              selectedCategory={selectedCategory}
              onCategoryChange={changeCategory}
            />
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-white/70 select-none">
              <input type="checkbox" checked={hideAi} onChange={toggleHideAi} className="accent-white" />
              Hide AI-assisted and AI-generated packs
            </label>
          </div>
          
          {/* Gallery Grid */}
          <div ref={gridRef}>
            <GalleryGrid 
              searchQuery={searchQuery}
              category={selectedCategory}
              sortBy={sortBy}
              hideAi={hideAi}
              page={page}
              itemsPerPage={itemsPerPage}
              onPageChange={setPage}
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
} 