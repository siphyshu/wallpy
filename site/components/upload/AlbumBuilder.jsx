import { useState } from 'react';
import { ArrowsUpDownIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Shuffle } from 'lucide-react';

export default function AlbumBuilder({ 
  scheduleConfig, 
  imageFiles, 
  onConfigChange 
}) {
  const [selectedImages, setSelectedImages] = useState([]);
  const [draggedImage, setDraggedImage] = useState(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState(null);

  const albumImages = scheduleConfig?.album?.images || [];

  const updateConfig = (newConfig) => {
    onConfigChange(newConfig);
  };

  const toggleShuffle = () => {
    const newConfig = { ...scheduleConfig };
    newConfig.album.shuffle = !newConfig.album.shuffle;
    updateConfig(newConfig);
  };

  // Add image to album
  const addImageToAlbum = (imageName) => {
    const newConfig = { ...scheduleConfig };
    if (!newConfig.album.images.includes(imageName)) {
      newConfig.album.images.push(imageName);
      updateConfig(newConfig);
    }
  };

  // Remove image from album
  const removeImageFromAlbum = (imageName) => {
    const newConfig = { ...scheduleConfig };
    newConfig.album.images = newConfig.album.images.filter(img => img !== imageName);
    updateConfig(newConfig);
  };

  // Add all images
  const addAllImages = () => {
    const newConfig = { ...scheduleConfig };
    newConfig.album.images = imageFiles.map(f => f.name);
    updateConfig(newConfig);
  };

  // Clear all images
  const clearAllImages = () => {
    const newConfig = { ...scheduleConfig };
    newConfig.album.images = [];
    updateConfig(newConfig);
  };

  // Drag and drop for reordering
  const handleDragStart = (e, imageName) => {
    setDraggedImage(imageName);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDraggedOverIndex(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedImage) {
      const newConfig = { ...scheduleConfig };
      const images = [...newConfig.album.images];
      const draggedIndex = images.indexOf(draggedImage);
      
      if (draggedIndex !== -1 && draggedIndex !== dropIndex) {
        images.splice(draggedIndex, 1);
        images.splice(dropIndex, 0, draggedImage);
        newConfig.album.images = images;
        updateConfig(newConfig);
      }
    }
    setDraggedImage(null);
    setDraggedOverIndex(null);
  };

  // Multi-select
  const toggleSelectImage = (name) => {
    setSelectedImages(prev => 
      prev.includes(name) 
        ? prev.filter(img => img !== name)
        : [...prev, name]
    );
  };

  const addSelectedImages = () => {
    const newConfig = { ...scheduleConfig };
    selectedImages.forEach(name => {
      if (!newConfig.album.images.includes(name)) {
        newConfig.album.images.push(name);
      }
    });
    updateConfig(newConfig);
    setSelectedImages([]);
  };

  // Get unassigned images
  const unassignedImages = imageFiles.filter(f => !albumImages.includes(f.name));

  if (!scheduleConfig?.album) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p className="mt-4 text-white/60">Loading album configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Main Title */}
      <div className="text-center">
        <h2 className="text-3xl font-serif font-bold mb-2 tracking-tight">Configure Album</h2>
        <p className="text-white/70 text-lg max-w-2xl mx-auto">
          Organize your image collection and set rotation preferences
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8">
        {/* Available Images */}
        <div className="lg:col-span-1 max-h-[700px] overflow-y-auto">
          <div className="bg-white/5 rounded-xl shadow-lg p-6 border border-white/10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-xl flex items-center gap-2">
                Available Images
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm font-semibold border border-white/20">
                  {unassignedImages.length}
                </span>
              </h4>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <button 
                onClick={addAllImages} 
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors"
              >
                Add All
              </button>
              <button 
                onClick={() => setSelectedImages(unassignedImages.map(f => f.name))} 
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors"
              >
                Select All
              </button>
            </div>
            <hr className="my-4 border-white/10" />
            <div className="space-y-2 flex-1 overflow-y-auto scrollbar pr-2">
              {unassignedImages.map((file) => (
                <div
                  key={file.id}
                  onClick={() => addImageToAlbum(file.name)}
                  className={`flex items-center space-x-3 p-2 bg-white/10 rounded-lg cursor-pointer transition-all duration-200 ease-out hover:bg-white/15 hover:scale-[1.01] ${
                    selectedImages.includes(file.name) ? 'ring-1 ring-white/40 bg-white/15' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedImages.includes(file.name)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelectImage(file.name);
                    }}
                    className="accent-white/80 w-4 h-4"
                  />
                  <div className="w-24 aspect-[16/9] bg-black/10 rounded overflow-hidden flex items-center justify-center">
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-full h-full object-cover rounded"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-white/90">{file.name}</p>
                    <p className="text-xs text-white/40">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                </div>
              ))}
              {unassignedImages.length === 0 && (
                <div className="text-center py-8 text-white/40">
                  <p className="text-sm">All images added to album</p>
                </div>
              )}
            </div>
            {selectedImages.length > 0 && (
              <button
                onClick={addSelectedImages}
                className="mt-4 w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors"
              >
                Add Selected ({selectedImages.length})
              </button>
            )}
          </div>
        </div>

        {/* Album Images */}
        <div className="lg:col-span-2 max-h-[800px] overflow-y-auto">
          <div className="bg-white/5 rounded-xl shadow-lg p-6 border border-white/10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-xl flex items-center gap-2">
                Album Images
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm font-semibold border border-white/20">
                  {albumImages.length}
                </span>
              </h4>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={toggleShuffle}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm font-medium ${
                  scheduleConfig.album.shuffle 
                    ? 'bg-white text-black border-white' 
                    : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                }`}
                title={scheduleConfig.album.shuffle ? 'Shuffle enabled' : 'Shuffle disabled'}
              >
                <Shuffle className="w-4 h-4" />
                Shuffle
              </button>
              <button
                onClick={clearAllImages}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                Clear All
              </button>
              <div className="ml-auto flex items-center gap-2 text-xs text-white/50">
                <ArrowsUpDownIcon className="w-4 h-4" />
                <span>Drag to reorder</span>
              </div>
            </div>
            <hr className="my-4 border-white/10" />
            <div className="flex-1 overflow-y-auto scrollbar pr-2">
              {albumImages.length === 0 ? (
                <div className="border-2 border-dashed border-white/20 rounded-lg p-12 text-center">
                  <p className="text-white/40">Click images on the left to add them to your album</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {albumImages.map((imageName, index) => {
                    const file = imageFiles.find(f => f.name === imageName);
                    const isDraggedOver = draggedOverIndex === index;
                    
                    return (
                      <div
                        key={`${imageName}-${index}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, imageName)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`relative group cursor-move transition-all ${
                          isDraggedOver ? 'scale-105' : ''
                        }`}
                      >
                        <div className="w-full aspect-[16/9] bg-black/10 rounded-lg overflow-hidden">
                          <img
                            src={file?.preview}
                            alt={imageName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                          {index + 1}
                        </div>
                        <button
                          onClick={() => removeImageFromAlbum(imageName)}
                          className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          ×
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate">
                          {imageName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
