export default function GalleryFilters({ selectedCategory, onCategoryChange }: { selectedCategory: string; onCategoryChange: (category: string) => void }) {
  const categories = [
    { id: 'all', name: 'All' },
    { id: 'nature', name: 'Nature' },
    { id: 'abstract', name: 'Abstract' },
    { id: 'photography', name: 'Photography' },
    { id: 'gaming', name: 'Gaming' },
    { id: 'minimal', name: 'Minimal' },
    { id: 'anime', name: 'Anime' },
    { id: 'digital-art', name: 'Digital Art' },
    { id: 'realistic', name: 'Realistic' },
    { id: 'typography', name: 'Typography' },
    { id: 'seasons', name: 'Seasons' },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
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