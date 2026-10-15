import React, { useState, useEffect, useCallback } from 'react';
import { PlusIcon, TrashIcon, ArrowPathIcon, EyeIcon, EyeSlashIcon, ClockIcon, PhotoIcon, ArrowsUpDownIcon, SunIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { Shuffle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const WeekpackBuilder = ({ scheduleConfig, imageFiles, onConfigChange, daysOfWeek }) => {
  const [draggedImage, setDraggedImage] = useState(null);
  const [draggedOverDay, setDraggedOverDay] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [addToDay, setAddToDay] = useState('');
  const [draggedImages, setDraggedImages] = useState([]);
  const [reorderPreview, setReorderPreview] = useState({ dayId: null, dropIndex: null });
  const [previewOrder, setPreviewOrder] = useState({});
  const [originalPosition, setOriginalPosition] = useState({ dayId: null, index: null });
  const [isReordering, setIsReordering] = useState(false);

  const updateConfig = (newConfig) => {
    onConfigChange(newConfig);
  };

  const handleDragStart = (e, imageName) => {
    setDraggedImage(imageName);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `available-${imageName}`);
  };

  const handleReorderDragStart = (e, imageName, dayId, currentIndex) => {
    e.stopPropagation();
    setDraggedImage(imageName);
    setOriginalPosition({ dayId, index: currentIndex });
    setIsReordering(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `reorder-${imageName}`);
    
    // Initialize preview order with current order
    const currentImages = [...scheduleConfig.days[dayId].images];
    setPreviewOrder({ [dayId]: currentImages });
  };

  const handleMultiDragStart = (e) => {
    if (selectedImages.length > 0) {
      setDraggedImages(selectedImages);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'multi-select');
    }
  };

  const handleDragOver = (e, dayId) => {
    e.preventDefault();
    // Only set dragged over day if we're not reordering
    if (!isReordering) {
      setDraggedOverDay(dayId);
    }
  };

  const handleDragLeave = () => {
    // Only clear dragged over day if we're not reordering
    if (!isReordering) {
      setDraggedOverDay(null);
    }
  };

  const handleDrop = (e, dayId) => {
    e.preventDefault();
    const dragData = e.dataTransfer.getData('text/plain');
    
    // Only handle drops from available images, not reorder drops
    if (dragData.startsWith('reorder-')) {
      return;
    }
    
    const newConfig = { ...scheduleConfig };
    
    if (dragData === 'multi-select') {
      // Add multiple selected images
      newConfig.days[dayId].images.push(...draggedImages);
      setDraggedImages([]);
    } else if (dragData.startsWith('available-')) {
      // Add single dragged image
      const imageName = dragData.replace('available-', '');
      newConfig.days[dayId].images.push(imageName);
    }
    
    updateConfig(newConfig);
    setDraggedImage(null);
    setDraggedOverDay(null);
  };

  const handleReorderDrop = (e, dayId, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const dragData = e.dataTransfer.getData('text/plain');
    
    // Only handle reorder drops
    if (!dragData.startsWith('reorder-')) {
      return;
    }
    
    const imageName = dragData.replace('reorder-', '');
    if (draggedImage) {
      const newConfig = { ...scheduleConfig };
      const images = [...newConfig.days[dayId].images];
      const currentIndex = images.indexOf(imageName);
      
      if (currentIndex !== -1) {
        images.splice(currentIndex, 1);
        images.splice(dropIndex, 0, imageName);
        newConfig.days[dayId].images = images;
        updateConfig(newConfig);
      }
    }
    
    setDraggedImage(null);
    setReorderPreview({ dayId: null, dropIndex: null });
    setPreviewOrder({});
    setOriginalPosition({ dayId: null, index: null });
    setIsReordering(false);
  };

  const handleReorderDragOver = (e, dayId, index) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isReordering) {
      setReorderPreview({ dayId, dropIndex: index });
      
      // Update preview order
      const currentImages = [...scheduleConfig.days[dayId].images];
      const draggedImageName = draggedImage;
      const currentIndex = currentImages.indexOf(draggedImageName);
      
      if (currentIndex !== -1 && currentIndex !== index) {
        const newOrder = [...currentImages];
        newOrder.splice(currentIndex, 1);
        newOrder.splice(index, 0, draggedImageName);
        setPreviewOrder({ [dayId]: newOrder });
      }
    }
  };

  const handleReorderDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeImageFromDay = (dayId, imageName, imageIndex) => {
    const newConfig = { ...scheduleConfig };
    newConfig.days[dayId].images = newConfig.days[dayId].images.filter(img => img !== imageName);
    updateConfig(newConfig);
  };

  const toggleShuffle = (dayId) => {
    const newConfig = { ...scheduleConfig };
    newConfig.days[dayId].shuffle = !newConfig.days[dayId].shuffle;
    updateConfig(newConfig);
  };

  const autoAssignImages = () => {
    const newConfig = { ...scheduleConfig };
    const imagesPerDay = Math.ceil(imageFiles.length / daysOfWeek.length);
    
    daysOfWeek.forEach((day, dayIndex) => {
      const startIndex = dayIndex * imagesPerDay;
      const endIndex = Math.min(startIndex + imagesPerDay, imageFiles.length);
      newConfig.days[day.id].images = imageFiles
        .slice(startIndex, endIndex)
        .map(f => f.name);
    });
    
    updateConfig(newConfig);
  };

  const toggleSelectImage = (name) => {
    setSelectedImages(prev => 
      prev.includes(name) 
        ? prev.filter(img => img !== name)
        : [...prev, name]
    );
  };

  const selectAllImages = () => setSelectedImages(imageFiles.map(f => f.name));
  const clearSelectedImages = () => setSelectedImages([]);

  const handleAddToDay = () => {
    if (!addToDay || selectedImages.length === 0) return;
    
    const newConfig = { ...scheduleConfig };
    const dayImages = new Set(newConfig.days[addToDay].images);
    
    selectedImages.forEach(imageName => {
      if (!dayImages.has(imageName)) {
        dayImages.add(imageName);
      }
    });
    
    newConfig.days[addToDay].images = Array.from(dayImages);
    updateConfig(newConfig);
    setSelectedImages([]);
    setAddToDay('');
  };

  if (!scheduleConfig.days) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p className="mt-4 text-white/60">Loading weekpack configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Main Title */}
      <div className="text-center">
        <h2 className="text-3xl font-serif font-bold mb-2 tracking-tight">Configure Weekly Schedule</h2>
        <p className="text-white/70 text-lg max-w-2xl mx-auto mb-4">Assign images to different days of the week. You can also preview your weekpack and schedule configuration below.</p>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8 mb-0">
        {/* Available Images */}
        <div className="lg:col-span-1 max-h-[800px] overflow-y-auto">
          <div className="bg-white/5 rounded-xl shadow-lg p-6 border border-white/10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-xl flex items-center gap-2">
                Available Images
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm font-semibold border border-white/20">{imageFiles.length}</span>
              </h4>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={selectAllImages} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors">Select All</button>
              <button onClick={clearSelectedImages} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors">Clear</button>
            </div>
            <hr className="my-4 border-white/10" />
            <div 
              className={`space-y-2 flex-1 overflow-y-auto scrollbar pr-2 ${selectedImages.length > 0 ? 'cursor-move' : ''}`}
              style={{ maxHeight: '100%' }}
              draggable={selectedImages.length > 0}
              onDragStart={handleMultiDragStart}
            >
              {imageFiles.map((file) => (
                <div
                  key={file.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, file.name)}
                  className={`flex items-center space-x-3 p-2 bg-white/10 rounded-lg cursor-move transition-all duration-200 ease-out hover:bg-white/15 hover:scale-[1.01] ${selectedImages.includes(file.name) ? 'ring-1 ring-white/40 m-2 mr-0 bg-white/15' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedImages.includes(file.name)}
                    onChange={() => toggleSelectImage(file.name)}
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
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Select value={addToDay} onValueChange={setAddToDay}>
                <SelectTrigger className="flex-1 bg-[#343434] border-white/20 text-white hover:bg-white/20">
                  <SelectValue placeholder="Add selected to..." className="text-white" />
                </SelectTrigger>
                <SelectContent className="bg-[#343434] border-white/20">
                  {daysOfWeek.map(day => (
                    <SelectItem key={day.id} value={day.id} className="text-white hover:bg-white/20">
                      {day.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={handleAddToDay}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors"
                disabled={!addToDay || selectedImages.length === 0}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Days Section */}
        <div className="lg:col-span-2 max-h-[800px] overflow-y-auto">
          <div className="bg-white/5 rounded-xl shadow-lg p-6 border border-white/10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-xl flex items-center gap-2">
                Days of the Week
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm font-semibold border border-white/20">{daysOfWeek.length}</span>
              </h4>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={autoAssignImages}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors"
                title="Auto-assign images"
              >
                <ArrowPathIcon className="w-4 h-4" /> Auto-assign Images
              </button>
            </div>
            <hr className="my-4 border-white/10" />
            <div className="grid md:grid-cols-2 gap-6 flex-1 overflow-y-auto scrollbar pr-2" style={{ maxHeight: '100%' }}>
              {daysOfWeek.map((day) => {
                // Use preview order if available, otherwise use actual order
                const displayImages = previewOrder[day.id] || scheduleConfig.days[day.id].images;
                
                return (
                  <div
                    key={day.id}
                    className={`bg-white/5 rounded-xl shadow-lg p-5 border-2 transition-all duration-300 ease-out relative group ${draggedOverDay === day.id ? 'border-white/40 bg-white/10 scale-[1.02] shadow-xl' : 'border-white/10 hover:bg-white/[0.07]'}`}
                    onDragOver={e => handleDragOver(e, day.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, day.id)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{day.icon}</span>
                        <h4 className="text-lg font-bold text-white">{day.name}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleShuffle(day.id)}
                          className={`p-2 rounded-full border border-white/20 transition-colors ${scheduleConfig.days[day.id].shuffle ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                          title={scheduleConfig.days[day.id].shuffle ? 'Shuffle enabled' : 'Shuffle disabled'}
                        >
                          <Shuffle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-white/70">Assigned Images <span className="ml-1 text-white/40">({displayImages.length})</span></p>
                      </div>
                      {displayImages.length === 0 ? (
                        <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center transition-all duration-300 ease-out hover:border-white/30 hover:bg-white/5">
                          <p className="text-white/40 text-xs transition-colors duration-200">Drag images here to assign them to {day.name}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {displayImages.map((imageName, index) => {
                            const file = imageFiles.find(f => f.name === imageName);
                            const isReorderPreview = reorderPreview.dayId === day.id && reorderPreview.dropIndex === index;
                            const isDraggedImage = draggedImage === imageName && reorderPreview.dayId === day.id;
                            const isOriginalPosition = originalPosition.dayId === day.id && originalPosition.index === index;
                            const shouldShowDropZone = isDraggedImage && !isOriginalPosition && reorderPreview.dayId === day.id;
                            
                            return (
                              <div
                                key={`${imageName}-${index}-${day.id}`}
                                className="relative group transition-all duration-200 ease-out hover:scale-[1.02] cursor-move"
                                draggable
                                onDragStart={e => handleReorderDragStart(e, imageName, day.id, index)}
                                onDragOver={e => handleReorderDragOver(e, day.id, index)}
                                onDragLeave={handleReorderDragLeave}
                                onDrop={e => {
                                  e.preventDefault();
                                  e.currentTarget.style.borderLeft = 'none';
                                  e.currentTarget.style.borderRight = 'none';
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const midX = rect.left + rect.width / 2;
                                  const mouseX = e.clientX;
                                  const dropIndex = mouseX < midX ? index : index + 1;
                                  handleReorderDrop(e, day.id, dropIndex);
                                }} 
                              >
                                {shouldShowDropZone ? (
                                  // Empty drop zone for dragged image (only when not at original position)
                                  <div className="w-full aspect-[16/9] bg-white/5 border-2 border-dashed border-white/40 rounded flex items-center justify-center transition-all duration-200 ease-out animate-pulse">
                                    <div className="text-white/60 text-xs"></div>
                                  </div>
                                ) : (
                                  // Normal image display
                                  <>
                                    <div className={`w-full aspect-[16/9] bg-black/10 rounded overflow-hidden flex items-center justify-center transition-all duration-200 ease-out ${isDraggedImage ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                                      <img
                                        src={file?.preview}
                                        alt={imageName}
                                        className="w-full h-full object-cover rounded transition-transform duration-200 ease-out"
                                      />
                                    </div>
                                    <div className={`absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded transition-all duration-200 ease-out ${isDraggedImage ? 'opacity-0' : 'opacity-100'}`}>
                                      {index + 1}
                                    </div>
                                    <div className={`absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] px-1 py-0.5 truncate transition-all duration-200 ease-out ${isDraggedImage ? 'opacity-0' : 'opacity-100'}`}>
                                      {file?.name || imageName}
                                    </div>
                                    <button
                                      onClick={() => removeImageFromDay(day.id, imageName, index)}
                                      className={`absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white text-xs w-5 h-5 rounded-full transition-all duration-200 ease-out flex items-center justify-center ${isDraggedImage ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}
                                      title="Remove image"
                                    >
                                      ×
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeekpackBuilder; 