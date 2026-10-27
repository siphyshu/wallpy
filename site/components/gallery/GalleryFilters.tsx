import { CATEGORIES, isCategory } from '@/lib/packs/categories';
import { galleryPath } from '@/lib/gallery';

// Category chips. `selected` is a category id or 'all'. Each is a link to the
// category's page (for search engines, new tabs and copying); a plain click
// switches in place.
export default function GalleryFilters({ selectedCategory, onCategoryChange }: { selectedCategory: string; onCategoryChange: (category: string) => void }) {
  const chips = [{ id: 'all', name: 'All' }, ...CATEGORIES];

  return (
    // One row: wraps on wide screens, scrolls sideways on phones.
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto no-scrollbar sm:flex-wrap sm:justify-center">
      {chips.map((category) => (
        <a
          key={category.id}
          href={galleryPath(isCategory(category.id) ? category.id : null)}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onCategoryChange(category.id);
          }}
          aria-current={selectedCategory === category.id ? 'page' : undefined}
          className={`shrink-0 px-4 py-2 rounded-full text-sm transition-colors
            ${selectedCategory === category.id
              ? 'bg-white text-black'
              : 'text-white/70 bg-white/5 hover:bg-white/10 hover:text-white'
            }`}
        >
          {category.name}
        </a>
      ))}
    </div>
  );
}
