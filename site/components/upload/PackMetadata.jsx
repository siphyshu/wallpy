export default function PackMetadata({ metadata, onMetadataChange, isOriginal }) {
  const handleChange = (field, value) => {
    onMetadataChange({
      ...metadata,
      [field]: value
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif font-bold mb-4">Pack Information</h2>
        <p className="text-white/80 text-lg">
          Add metadata to help others discover and understand your wallpack.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Basic Information */}
        <div className="space-y-6">
          <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6">
            <h3 className="text-xl font-bold mb-4">Basic Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={metadata.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter a descriptive title for your wallpack"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={metadata.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  placeholder="Describe your wallpack's theme, style, and what makes it special..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Tags <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={metadata.tags}
                  onChange={(e) => handleChange('tags', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="nature, landscape, anime, gaming (comma separated)"
                />
                <p className="text-xs text-white/60 mt-1">
                  Use relevant tags to help others find your wallpack
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Originality & Attribution */}
        <div className="space-y-6">
          <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6">
            <h3 className="text-xl font-bold mb-4">Originality & Attribution</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Content Type</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="isOriginal"
                      checked={metadata.isOriginal}
                      onChange={() => handleChange('isOriginal', true)}
                      className="w-4 h-4 text-blue-500 bg-white/10 border-white/20 focus:ring-blue-500"
                    />
                    <span className="text-sm">I created this content</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="isOriginal"
                      checked={!metadata.isOriginal}
                      onChange={() => handleChange('isOriginal', false)}
                      className="w-4 h-4 text-blue-500 bg-white/10 border-white/20 focus:ring-blue-500"
                    />
                    <span className="text-sm">This is someone else's content</span>
                  </label>
                </div>
              </div>

              {!metadata.isOriginal && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Original Author <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required={!metadata.isOriginal}
                      value={metadata.authorName}
                      onChange={(e) => handleChange('authorName', e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Name of the original creator"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Author URL</label>
                    <input
                      type="url"
                      value={metadata.authorUrl}
                      onChange={(e) => handleChange('authorUrl', e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="https://example.com/artist-profile"
                    />
                    <p className="text-xs text-white/60 mt-1">
                      Link to the original creator's website or social media
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Guidelines */}
          <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6">
            <h3 className="text-lg font-bold mb-3">Upload Guidelines</h3>
            <ul className="space-y-2 text-sm text-white/80">
              <li>• Ensure you have permission to share the content</li>
              <li>• Credit original artists when applicable</li>
              <li>• Use descriptive titles and tags</li>
              <li>• Provide accurate descriptions</li>
              <li>• Follow community guidelines</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="mt-8 bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-bold mb-4">Preview</h3>
        <div className="bg-black/20 rounded-lg p-4">
          <h4 className="text-xl font-bold mb-2">{metadata.title || 'Your Wallpack Title'}</h4>
          <p className="text-white/80 mb-3">
            {metadata.description || 'Description will appear here...'}
          </p>
          <div className="flex flex-wrap gap-2">
            {metadata.tags ? (
              metadata.tags.split(',').map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded"
                >
                  {tag.trim()}
                </span>
              ))
            ) : (
              <span className="text-white/40 text-sm">Tags will appear here...</span>
            )}
          </div>
          {!metadata.isOriginal && metadata.authorName && (
            <div className="mt-3 text-sm text-white/60">
              <span>By: {metadata.authorName}</span>
              {metadata.authorUrl && (
                <a
                  href={metadata.authorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-400 hover:text-blue-300"
                >
                  (View Profile)
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 