export default function PackMetadata({ metadata, onMetadataChange }) {
  const handleChange = (field, value) => {
    onMetadataChange({
      ...metadata,
      [field]: value
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif font-bold mb-4">Pack Information</h2>
        <p className="text-white/70 text-lg">
          Add details to help others discover your wallpack
        </p>
      </div>

      <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-8">
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
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
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={metadata.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 transition-all resize-none"
              placeholder="Describe the theme, style, and what makes it special..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Tags <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={metadata.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 transition-all"
              placeholder="nature, landscape, anime (comma separated)"
            />
            {metadata.tags && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {metadata.tags.split(',').filter(t => t.trim()).map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-white/10 text-white/70 text-xs rounded-full border border-white/20"
                  >
                    {tag.trim()}
                  </span>
                ))}
              </div>
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
                Someone else's work
              </button>
            </div>
          </div>

          {/* Attribution Fields */}
          {!metadata.isOriginal && (
            <div className="space-y-4 p-4 bg-white/5 rounded-lg border border-white/10">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Original Creator <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required={!metadata.isOriginal}
                  value={metadata.authorName}
                  onChange={(e) => handleChange('authorName', e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 transition-all"
                  placeholder="Name of the original creator"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Source URL</label>
                <input
                  type="url"
                  value={metadata.authorUrl}
                  onChange={(e) => handleChange('authorUrl', e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 transition-all"
                  placeholder="https://example.com/artist"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subtle guidelines */}
      <p className="text-center text-xs text-white/40 mt-6 max-w-lg mx-auto">
        By uploading, you confirm you have rights to share this content and agree to credit original creators.
      </p>
    </div>
  );
}
