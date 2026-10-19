import { useEffect, useState } from 'react';
import { CATEGORIES, MAX_CATEGORIES } from '@/lib/packs/categories';
import { PACK_LIMITS, normalizeTag, parseTagList } from '@/lib/packs/limits';

const AI_OPTIONS = [
  { id: 'none', label: 'No AI', help: 'Made without AI image tools.' },
  { id: 'assisted', label: 'AI-assisted', help: 'AI tools helped, e.g. upscaling, touch-ups or parts of the image.' },
  { id: 'generated', label: 'AI-generated', help: 'The images were generated with AI tools.' },
];

const LICENSE_OPTIONS = [
  { id: 'personal-use', label: 'Personal use only' },
  { id: 'cc-by-4.0', label: 'CC BY 4.0 (credit required)' },
  { id: 'cc-by-nc-4.0', label: 'CC BY-NC 4.0 (credit, non-commercial)' },
  { id: 'cc0', label: 'CC0 (public domain)' },
  { id: 'other', label: 'Other' },
];

export default function PackMetadata({ metadata, onMetadataChange }) {
  const handleChange = (field, value) => {
    onMetadataChange({
      ...metadata,
      [field]: value
    });
  };

  const categories = metadata.categories ?? [];
  const toggleCategory = (id) => {
    if (categories.includes(id)) handleChange('categories', categories.filter((c) => c !== id));
    else if (categories.length < MAX_CATEGORIES) handleChange('categories', [...categories, id]);
  };

  // Tags as they'll be saved, and suggestions from tags already used on public packs.
  const tags = parseTagList(metadata.tags);
  const tagsOverLimit = new Set(metadata.tags.split(',').map(normalizeTag).filter(Boolean)).size > PACK_LIMITS.maxTags;
  const [knownTags, setKnownTags] = useState([]);
  useEffect(() => {
    let live = true;
    fetch('/api/tags')
      .then((r) => (r.ok ? r.json() : { tags: [] }))
      .then((d) => { if (live) setKnownTags(d.tags ?? []); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  const parts = metadata.tags.split(',');
  const fragment = normalizeTag(parts[parts.length - 1] ?? '');
  const suggestions = tags.length >= PACK_LIMITS.maxTags ? [] : knownTags
    .filter((t) => !tags.includes(t))
    .filter((t) => !fragment || t.startsWith(fragment))
    .slice(0, 8);
  const pickSuggestion = (tag) => {
    const kept = parts.slice(0, -1).map((t) => t.trim()).filter(Boolean);
    handleChange('tags', [...kept, tag].join(', ') + ', ');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="sr-only">Pack Information</h2>
        <p className="text-white/70">
          Add details to help others discover your wallpack
        </p>
      </div>

      <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-8">
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="pack-title" className="block text-sm font-medium mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input id="pack-title"
              type="text"
              required
              value={metadata.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 transition-all"
              placeholder="Enter a descriptive title"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="pack-description" className="block text-sm font-medium mb-2">Description</label>
            <textarea id="pack-description"
              value={metadata.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 transition-all resize-none"
              placeholder="Describe the theme, style, and what makes it special..."
            />
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium mb-1" id="categories-label">
              Categories <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-white/50 mb-3">Pick one or two. They decide where the pack shows up in the gallery.</p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="categories-label">
              {CATEGORIES.map((c) => {
                const on = categories.includes(c.id);
                const full = !on && categories.length >= MAX_CATEGORIES;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    disabled={full}
                    onClick={() => toggleCategory(c.id)}
                    className={`px-4 py-1.5 rounded-full border text-sm transition-all ${
                      on
                        ? 'bg-white text-black border-white'
                        : 'bg-white/5 text-white/70 border-white/20 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 disabled:cursor-not-allowed'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="pack-tags">
              Tags <span className="text-white/40 font-normal">(optional)</span>
            </label>
            <input
              id="pack-tags"
              type="text"
              autoComplete="off"
              value={metadata.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 transition-all"
              placeholder="sunset, pixel-art, studio-ghibli (comma separated)"
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2" aria-label="Tags already in use">
                <span className="text-xs text-white/40">In use:</span>
                {suggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => pickSuggestion(tag)}
                    className="px-2 py-0.5 bg-white/5 text-white/70 text-xs rounded-full border border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-white/10 text-white/70 text-xs rounded-full border border-white/20"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            {tagsOverLimit && (
              <p className="text-xs text-amber-300 mt-2">Only the first {PACK_LIMITS.maxTags} tags are kept.</p>
            )}
          </div>

          <hr className="border-white/10" />

          {/* Content Type */}
          <div>
            <label className="block text-sm font-medium mb-3">Content Attribution</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleChange('isOriginal', true)}
                className={`px-4 py-3 rounded-lg border transition-all text-sm font-medium ${
                  metadata.isOriginal 
                    ? 'bg-white text-black border-white' 
                    : 'bg-white/5 text-white/70 border-white/20 hover:bg-white/10'
                }`}
              >
                Original content
              </button>
              <button
                type="button"
                onClick={() => handleChange('isOriginal', false)}
                className={`px-4 py-3 rounded-lg border transition-all text-sm font-medium ${
                  !metadata.isOriginal 
                    ? 'bg-white text-black border-white' 
                    : 'bg-white/5 text-white/70 border-white/20 hover:bg-white/10'
                }`}
              >
                Someone else&apos;s work
              </button>
            </div>
          </div>

          {/* Attribution Fields */}
          {!metadata.isOriginal && (
            <div className="space-y-4 p-4 bg-white/5 rounded-lg border border-white/10">
              <div>
                <label htmlFor="pack-artist" className="block text-sm font-medium mb-2">
                  Original Creator <span className="text-red-400">*</span>
                </label>
                <input id="pack-artist"
                  type="text"
                  required={!metadata.isOriginal}
                  value={metadata.authorName}
                  onChange={(e) => handleChange('authorName', e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 transition-all"
                  placeholder="Name of the original creator"
                />
              </div>

              <div>
                <label htmlFor="pack-source-url" className="block text-sm font-medium mb-2">Source URL</label>
                <input id="pack-source-url"
                  type="url"
                  value={metadata.authorUrl}
                  onChange={(e) => handleChange('authorUrl', e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 transition-all"
                  placeholder="https://example.com/artist"
                />
              </div>
            </div>
          )}

          <hr className="border-white/10" />

          {/* AI use (required) */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Was AI used to make these images? <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {AI_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={metadata.aiUse === option.id}
                  onClick={() => handleChange('aiUse', option.id)}
                  className={`px-4 py-3 rounded-lg border transition-all text-sm font-medium ${
                    metadata.aiUse === option.id
                      ? 'bg-white text-black border-white'
                      : 'bg-white/5 text-white/70 border-white/20 hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/50 mt-2">
              {AI_OPTIONS.find((o) => o.id === metadata.aiUse)?.help ??
                'Shown as a label on the pack. The credit stays yours either way.'}
            </p>
          </div>

          {/* License */}
          <div>
            <label htmlFor="pack-license" className="block text-sm font-medium mb-2">License</label>
            <select id="pack-license"
              value={metadata.license}
              onChange={(e) => handleChange('license', e.target.value)}
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white transition-all"
            >
              {LICENSE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id} className="bg-[#1d1d1d]">{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Subtle guidelines */}
      <p className="text-center text-xs text-white/40 mt-6 max-w-lg mx-auto">
        By uploading, you confirm you have rights to share this content and agree to credit original creators.
      </p>
    </div>
  );
}
