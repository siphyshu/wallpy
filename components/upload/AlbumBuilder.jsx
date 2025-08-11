export default function AlbumBuilder({ 
  scheduleConfig, 
  imageFiles, 
  onConfigChange 
}) {
  const updateConfig = (newConfig) => {
    onConfigChange(newConfig);
  };

  const toggleShuffle = () => {
    const newConfig = { ...scheduleConfig };
    newConfig.album.shuffle = !newConfig.album.shuffle;
    updateConfig(newConfig);
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-serif font-bold mb-4">Configure Album</h2>
        <p className="text-white/80 text-lg">Set up your image collection rotation settings</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Settings */}
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h4 className="font-bold mb-4">Album Settings</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Rotation Mode</label>
              <select
                value={scheduleConfig.album?.rotation || 'sequential'}
                onChange={(e) => {
                  const newConfig = { ...scheduleConfig };
                  newConfig.album.rotation = e.target.value;
                  updateConfig(newConfig);
                }}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sequential">Sequential (in order)</option>
                <option value="shuffle">Random Shuffle</option>
              </select>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="shuffle"
                checked={scheduleConfig.album?.shuffle || false}
                onChange={() => toggleShuffle()}
                className="w-4 h-4 text-blue-500 bg-white/10 border-white/20 rounded focus:ring-blue-500"
              />
              <label htmlFor="shuffle" className="text-sm">Enable shuffle mode</label>
            </div>

            <div className="text-sm text-white/60">
              <p>• Sequential: Images change in the order they appear</p>
              <p>• Shuffle: Images change randomly</p>
              <p>• Total images: {imageFiles.length}</p>
            </div>
          </div>
        </div>

        {/* Image Preview */}
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h4 className="font-bold mb-4">Album Images ({imageFiles.length})</h4>
          <div className="grid grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {imageFiles.map((file, index) => (
              <div key={file.id} className="relative">
                <img
                  src={file.preview}
                  alt={file.name}
                  className="w-full h-20 object-cover rounded"
                />
                <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 