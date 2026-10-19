import { CATEGORIES } from '@/lib/packs/categories';

// Category chips. `selected` is a category id or 'all'.
export default function GalleryFilters({ selectedCategory, onCategoryChange }: { selectedCategory: string; onCategoryChange: (category: string) => void }) {
  const chips = [{ id: 'all', name: 'All' }, ...CATEGORIES];

  return (
    // One row: wraps on wide screens, scrolls sideways on phones.
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto no-scrollbar sm:flex-wrap">
      {chips.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          aria-pressed={selectedCategory === category.id}
          className={`shrink-0 px-4 py-2 rounded-full text-sm transition-colors
            ${selectedCategory === category.id
              ? 'bg-white text-black'
              : 'text-white/70 bg-white/5 hover:bg-white/10 hover:text-white'
            }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
