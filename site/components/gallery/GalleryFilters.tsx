import { CATEGORIES } from '@/lib/packs/categories';

// Category chips. `selected` is a category id or 'all'.
export default function GalleryFilters({ selectedCategory, onCategoryChange }: { selectedCategory: string; onCategoryChange: (category: string) => void }) {
  const chips = [{ id: 'all', name: 'All' }, ...CATEGORIES];

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {chips.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          aria-pressed={selectedCategory === category.id}
          className={`px-4 py-2 rounded-full text-sm transition-all duration-200
            ${selectedCategory === category.id
              ? 'bg-white/10 text-white'
              : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
