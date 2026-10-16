import { useState, useEffect, useRef } from 'react';
import { PlusIcon, TrashIcon, ArrowPathIcon, EyeIcon, EyeSlashIcon, ClockIcon, PhotoIcon, ArrowsUpDownIcon, SunIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { Shuffle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TIME_PATTERN, fallbackMinutes } from '@/lib/spec/time';

const solarEvents = [
  { value: 'midnight', label: 'Midnight' },
  { value: 'dawn', label: 'Dawn' },
  { value: 'sunrise', label: 'Sunrise' },
  { value: 'noon', label: 'Noon' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'dusk', label: 'Dusk' }
];

const validSolarEvents = ['midnight', 'dawn', 'sunrise', 'noon', 'sunset', 'dusk'];

export default function DaypackBuilder({ 
  scheduleConfig, 
  imageFiles, 
  onConfigChange 
}) {
  const [draggedImage, setDraggedImage] = useState(null);
  const [draggedOverBlock, setDraggedOverBlock] = useState(null);
  const [newBlockName, setNewBlockName] = useState('');
  const [editingBlock, setEditingBlock] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [addToBlock, setAddToBlock] = useState('');
  const [draggedImages, setDraggedImages] = useState([]);
  const [timeErrors, setTimeErrors] = useState({});
  const [timeInputs, setTimeInputs] = useState({});
  const [reorderPreview, setReorderPreview] = useState({ blockId: null, dropIndex: null });
  const [previewOrder, setPreviewOrder] = useState({});
  const [originalPosition, setOriginalPosition] = useState({ blockId: null, index: null });
  const [isReordering, setIsReordering] = useState(false);

  const updateConfig = (newConfig) => {
    onConfigChange(newConfig);
  };

  // Same rule as the pack spec (lib/spec/time.ts, from spec/schedule.schema.json).
  const validateTimeInput = (value) => {
    if (!value) return { isValid: false, error: 'Time is required' };
    if (TIME_PATTERN.test(value)) return { isValid: true, error: null };
    return {
      isValid: false,
      error: 'Use a solar event (dawn, sunrise, noon, sunset, dusk, midnight), optionally with an offset (dawn+15m, sunset-1h, dusk+1h30m), or a 24h time (06:30, 14:00)',
    };
  };

  // In the pack format a block runs until the next block starts.
  const startMinutes = (at) => {
    try { return fallbackMinutes(at); } catch { return Number.POSITIVE_INFINITY; }
  };
  const blocksInTimeOrder = Object.entries(scheduleConfig.timeblocks)
    .sort(([, a], [, b]) => startMinutes(a.start) - startMinutes(b.start));
  const nextStartOf = (blockName) => {
    const i = blocksInTimeOrder.findIndex(([name]) => name === blockName);
    if (blocksInTimeOrder.length < 2) return 'the same time tomorrow';
    const [nextName, next] = blocksInTimeOrder[(i + 1) % blocksInTimeOrder.length];
    return `${next.start} (${nextName})`;
  };

  // Debounced validation
  const validationTimer = useRef(null);
  const debouncedValidation = (blockName, field, value) => {
    clearTimeout(validationTimer.current);
    validationTimer.current = setTimeout(() => {
      const validation = validateTimeInput(value);
      setTimeErrors(prev => ({ ...prev, [`${blockName}-${field}`]: validation.error }));
    }, 500);
  };

  const addTimeBlock = () => {
    const name = newBlockName.trim() || `Block ${Object.keys(scheduleConfig.timeblocks).length + 1}`;
    const safeName = name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
    const newConfig = { ...scheduleConfig };
    newConfig.timeblocks[safeName] = {
      start: 'sunrise',
      images: [],
      shuffle: false
    };
    updateConfig(newConfig);
    setNewBlockName('');
  };

  const removeTimeBlock = (blockName) => {
    const newConfig = { ...scheduleConfig };
    delete newConfig.timeblocks[blockName];
    updateConfig(newConfig);
  };

  const updateTimeBlock = (blockName, field, value) => {
    const newConfig = { ...scheduleConfig };
    newConfig.timeblocks[blockName][field] = value;
    
    // Update the input value immediately
    setTimeInputs(prev => ({
      ...prev,
      [`${blockName}-${field}`]: value
    }));
    
    // Debounced validation
    debouncedValidation(blockName, field, value);
    
    updateConfig(newConfig);
  };

  const handleDragStart = (e, imageName) => {
    setDraggedImage(imageName);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `available-${imageName}`);
  };

  const handleReorderDragStart = (e, imageName, blockId, currentIndex) => {
    e.stopPropagation();
    setDraggedImage(imageName);
    setOriginalPosition({ blockId, index: currentIndex });
    setIsReordering(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `reorder-${imageName}`);
    
    // Initialize preview order with current order
    const currentImages = [...scheduleConfig.timeblocks[blockId].images];
    setPreviewOrder({ [blockId]: currentImages });
  };

  const handleMultiDragStart = (e) => {
    if (selectedImages.length > 0) {
      setDraggedImages(selectedImages);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'multi-select');
    }
  };

  const handleDragOver = (e, blockId) => {
    e.preventDefault();
    // Only set dragged over block if we're not reordering
    if (!isReordering) {
      setDraggedOverBlock(blockId);
    }
  };

  const handleDragLeave = () => {
    // Only clear dragged over block if we're not reordering
    if (!isReordering) {
      setDraggedOverBlock(null);
    }
  };

  const handleDrop = (e, blockId) => {
    e.preventDefault();
    const dragData = e.dataTransfer.getData('text/plain');
    
    // Only handle drops from available images, not reorder drops
    if (dragData.startsWith('reorder-')) {
      return;
    }
    
    const newConfig = { ...scheduleConfig };
    
    if (dragData === 'multi-select') {
      // Add multiple selected images
      newConfig.timeblocks[blockId].images.push(...draggedImages);
      setDraggedImages([]);
    } else if (dragData.startsWith('available-')) {
      // Add single dragged image
      const imageName = dragData.replace('available-', '');
      newConfig.timeblocks[blockId].images.push(imageName);
    }
    
    updateConfig(newConfig);
    setDraggedImage(null);
    setDraggedOverBlock(null);
  };

  const handleReorderDrop = (e, blockId, dropIndex) => {
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
      const images = [...newConfig.timeblocks[blockId].images];
      const draggedIndex = images.indexOf(imageName);
      
      if (draggedIndex !== -1 && draggedIndex !== dropIndex) {
        // Remove from original position and insert at new position
        images.splice(draggedIndex, 1);
        const actualDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
        images.splice(actualDropIndex, 0, imageName);
        newConfig.timeblocks[blockId].images = images;
        updateConfig(newConfig);
      }
    }
    setDraggedImage(null);
    setReorderPreview({ blockId: null, dropIndex: null });
    setPreviewOrder({});
    setOriginalPosition({ blockId: null, index: null });
    setIsReordering(false);
  };

  const handleReorderDragOver = (e, blockId, index) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const mouseX = e.clientX;
    const dropIndex = mouseX < midX ? index : index + 1;
    setReorderPreview({ blockId, dropIndex });
    
    // Update preview order in real-time
    if (draggedImage && previewOrder[blockId]) {
      const currentImages = [...scheduleConfig.timeblocks[blockId].images];
      const draggedIndex = currentImages.indexOf(draggedImage);
      
      if (draggedIndex !== -1 && draggedIndex !== dropIndex) {
        const newOrder = [...currentImages];
        newOrder.splice(draggedIndex, 1);
        const actualDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
        newOrder.splice(actualDropIndex, 0, draggedImage);
        setPreviewOrder({ [blockId]: newOrder });
      }
    }
  };

  const handleReorderDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setReorderPreview({ blockId: null, dropIndex: null });
  };

  const removeImageFromBlock = (blockId, imageName, imageIndex) => {
    const newConfig = { ...scheduleConfig };
    // Remove only the specific instance at the given index
    newConfig.timeblocks[blockId].images.splice(imageIndex, 1);
    updateConfig(newConfig);
  };

  const toggleShuffle = (blockId) => {
    const newConfig = { ...scheduleConfig };
    newConfig.timeblocks[blockId].shuffle = !newConfig.timeblocks[blockId].shuffle;
    updateConfig(newConfig);
  };

  const autoAssignImages = () => {
    const newConfig = { ...scheduleConfig };
    const timeBlockNames = Object.keys(newConfig.timeblocks);
    const imagesPerBlock = Math.ceil(imageFiles.length / timeBlockNames.length);
    timeBlockNames.forEach((blockName, blockIndex) => {
      const startIndex = blockIndex * imagesPerBlock;
      const endIndex = Math.min(startIndex + imagesPerBlock, imageFiles.length);
      newConfig.timeblocks[blockName].images = imageFiles
        .slice(startIndex, endIndex)
        .map(f => f.name);
    });
    updateConfig(newConfig);
  };

  // Multi-select logic
  const toggleSelectImage = (name) => {
    setSelectedImages((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };
  const selectAllImages = () => setSelectedImages(imageFiles.map(f => f.name));
  const clearSelectedImages = () => setSelectedImages([]);

  // Add selected images to block
  const handleAddToBlock = () => {
    if (!addToBlock || selectedImages.length === 0) return;
    const newConfig = { ...scheduleConfig };
    newConfig.timeblocks[addToBlock].images.push(...selectedImages);
    updateConfig(newConfig);
    setSelectedImages([]);
  };

  if (!scheduleConfig.timeblocks) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p className="mt-4 text-white/60">Loading daypack configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Main Title */}
      <div className="text-center">
        <h2 className="text-3xl font-serif font-bold mb-2 tracking-tight">Configure Daypack Schedule</h2>
        <p className="text-white/70 text-lg max-w-2xl mx-auto mb-4">Create and configure time blocks for your daypack. You can also preview your daypack and schedule configuration below.
        <a href="#configuration-guide" className="underline text-blue-300 hover:text-blue-200 ml-1">See the configuration guide for tips.</a>
        </p>
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
              <Select value={addToBlock} onValueChange={setAddToBlock}>
                <SelectTrigger className="flex-1 bg-[#343434] border-white/20 text-white hover:bg-white/20">
                  <SelectValue placeholder="Add selected to..." className="text-white" />
                </SelectTrigger>
                <SelectContent className="bg-[#343434] border-white/20">
                  {Object.keys(scheduleConfig.timeblocks).map(blockName => (
                    <SelectItem key={blockName} value={blockName} className="text-white hover:bg-white/20">
                      {blockName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={handleAddToBlock}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors"
                disabled={!addToBlock || selectedImages.length === 0}
              >
                Add
              </button>
            </div>
          </div>
        </div>
        {/* Time Blocks Section */}
        <div className="lg:col-span-2 max-h-[800px] overflow-y-auto">
          <div className="bg-white/5 rounded-xl shadow-lg p-6 border border-white/10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-xl flex items-center gap-2">
                Time Blocks
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm font-semibold border border-white/20">{Object.keys(scheduleConfig.timeblocks).length}</span>
              </h4>
            </div>
            <div className="flex flex-col md:flex-row md:items-center md:space-x-2 space-y-2 md:space-y-0 mb-4">
              <input
                type="text"
                value={newBlockName}
                onChange={e => setNewBlockName(e.target.value)}
                placeholder="New block name (e.g. Morning)"
                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white/30 text-white placeholder-white/40 text-sm"
                onKeyDown={e => { if (e.key === 'Enter') addTimeBlock(); }}
              />
              <button
                onClick={addTimeBlock}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium border border-white/20 shadow transition-colors"
                title="Add time block"
              >
                <PlusIcon className="w-4 h-4" /> Add Time Block
              </button>
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
              {Object.entries(scheduleConfig.timeblocks).map(([blockName, block]) => {
                // Use preview order if available, otherwise use actual order
                const displayImages = previewOrder[blockName] || block.images;
                
                return (
                  <div
                    key={blockName}
                    className={`bg-white/5 rounded-xl shadow-lg p-5 border-2 transition-all duration-300 ease-out relative group ${draggedOverBlock === blockName ? 'border-white/40 bg-white/10 scale-[1.02] shadow-xl' : 'border-white/10 hover:bg-white/[0.07]'}`}
                    onDragOver={e => handleDragOver(e, blockName)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, blockName)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {editingBlock === blockName ? (
                          <input
                            type="text"
                            value={blockName}
                            autoFocus
                            onBlur={() => setEditingBlock(null)}
                            onChange={e => {
                              const newConfig = { ...scheduleConfig };
                              const newBlockName = e.target.value.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
                              newConfig.timeblocks[newBlockName] = newConfig.timeblocks[blockName];
                              delete newConfig.timeblocks[blockName];
                              updateConfig(newConfig);
                              setEditingBlock(newBlockName);
                            }}
                            className="text-lg font-bold bg-transparent border-b border-white/20 outline-none text-white px-1 py-0.5 w-32"
                            placeholder="Block name"
                            onKeyDown={e => { if (e.key === 'Enter') setEditingBlock(null); }}
                          />
                        ) : (
                          <button
                            className="text-lg font-bold bg-transparent border-none outline-none text-white hover:underline"
                            onClick={() => setEditingBlock(blockName)}
                            title="Rename block"
                          >
                            {blockName}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleShuffle(blockName)}
                          className={`p-2 rounded-full border border-white/20 transition-colors ${block.shuffle ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                          title={block.shuffle ? 'Shuffle enabled' : 'Shuffle disabled'}
                        >
                          <Shuffle className="w-4 h-4" />
                        </button>
                        {Object.keys(scheduleConfig.timeblocks).length > 1 && (
                          <button
                            onClick={() => removeTimeBlock(blockName)}
                            className="p-2 rounded-full bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white transition-colors border border-white/20"
                            title="Remove block"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-white/60">Start Time</label>
                        <input
                          type="text"
                          value={timeInputs[`${blockName}-start`] !== undefined ? timeInputs[`${blockName}-start`] : block.start}
                          onChange={e => updateTimeBlock(blockName, 'start', e.target.value)}
                          placeholder="e.g., sunrise, dawn+15m, 12:00"
                          className={`w-full px-2 py-1.5 bg-white/10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 text-white text-xs ${timeErrors[`${blockName}-start`] ? 'border-red-400' : 'border-white/20'}`}
                        />
                        {timeErrors[`${blockName}-start`] && (
                          <p className="text-xs text-red-400 mt-1">{timeErrors[`${blockName}-start`]}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-white/60">Until</label>
                        <div
                          className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/60 text-xs truncate"
                          title="A block runs until the next block starts"
                        >
                          {nextStartOf(blockName)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-white/70">Assigned Images <span className="ml-1 text-white/40">({displayImages.length})</span></p>
                      </div>
                      {displayImages.length === 0 ? (
                        <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center transition-all duration-300 ease-out hover:border-white/30 hover:bg-white/5">
                          <p className="text-white/40 text-xs transition-colors duration-200">Drag images here to assign them to this block</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {displayImages.map((imageName, index) => {
                            const file = imageFiles.find(f => f.name === imageName);
                            const isReorderPreview = reorderPreview.blockId === blockName && reorderPreview.dropIndex === index;
                            const isDraggedImage = draggedImage === imageName && reorderPreview.blockId === blockName;
                            const isOriginalPosition = originalPosition.blockId === blockName && originalPosition.index === index;
                            const shouldShowDropZone = isDraggedImage && !isOriginalPosition && reorderPreview.blockId === blockName;
                            
                            return (
                              <div
                                key={`${imageName}-${index}-${blockName}`}
                                className="relative group transition-all duration-200 ease-out hover:scale-[1.02] cursor-move"
                                draggable
                                onDragStart={e => handleReorderDragStart(e, imageName, blockName, index)}
                                onDragOver={e => handleReorderDragOver(e, blockName, index)}
                                onDragLeave={handleReorderDragLeave}
                                onDrop={e => {
                                  e.preventDefault();
                                  e.currentTarget.style.borderLeft = 'none';
                                  e.currentTarget.style.borderRight = 'none';
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const midX = rect.left + rect.width / 2;
                                  const mouseX = e.clientX;
                                  const dropIndex = mouseX < midX ? index : index + 1;
                                  handleReorderDrop(e, blockName, dropIndex);
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
                                      onClick={() => removeImageFromBlock(blockName, imageName, index)}
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
} 