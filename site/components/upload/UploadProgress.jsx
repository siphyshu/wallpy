import { useState } from 'react';
import { categoryName } from '@/lib/packs/categories';
import { parseTagList } from '@/lib/packs/limits';
import { PencilIcon, ClockIcon, CalendarIcon, PhotoIcon, CheckCircleIcon, Square3Stack3DIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function UploadProgress({ 
  progress, 
  status, 
  isUploading, 
  wallpackType, 
  files, 
  scheduleConfig, 
  metadata,
  onEditStep,
  error
}) {
  const imageFiles = files.filter(f => f.type?.startsWith('image/'));
  const [selectedImage, setSelectedImage] = useState(imageFiles[0] || null);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTotalFileSize = () => {
    return files.reduce((total, file) => total + file.size, 0);
  };

  const getWallpackTypeName = () => {
    switch (wallpackType) {
      case 'daypack': return 'Daypack';
      case 'weekpack': return 'Weekpack';
      case 'album': return 'Album';
      default: return 'Wallpack';
    }
  };

  const getWallpackTypeIcon = () => {
    switch (wallpackType) {
      case 'daypack': return <ClockIcon className="w-4 h-4" />;
      case 'weekpack': return <CalendarIcon className="w-4 h-4" />;
      case 'album': return <PhotoIcon className="w-4 h-4" />;
      default: return <PhotoIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="text-left mb-10">
        <h2 className="sr-only">Review & Upload</h2>
        <p className="text-white/70">
          Final check before publishing
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/20 mb-8">
        {/* Preview Image Area */}
        <div className="relative aspect-video bg-black/40 group">
          {selectedImage ? (
            <img
              src={selectedImage.preview}
              alt={selectedImage.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white/40">
              No images
            </div>
          )}
          
          {/* Pack Type Badge (Floating) */}
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-sm font-medium text-white border border-white/10">
            {getWallpackTypeIcon()}
            <span>{getWallpackTypeName()}</span>
          </div>

          {/* Image Count Badge (Floating) */}
          <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-sm font-medium text-white border border-white/10">
            <Square3Stack3DIcon className="w-4 h-4" />
            <span>{files.length}</span>
          </div>

          {/* Thumbnail Overlay (Bottom) */}
          {imageFiles.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex gap-2 overflow-x-auto no-scrollbar justify-center">
                {imageFiles.slice(0, 6).map((file) => (
                  <button
                    key={file.id}
                    onClick={() => setSelectedImage(file)}
                    className={`relative w-12 h-8 flex-shrink-0 rounded overflow-hidden border transition-all ${
                      selectedImage?.id === file.id 
                        ? 'border-white' 
                        : 'border-white/20 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-2xl font-serif font-bold">{metadata.title || 'Untitled Pack'}</h3>
                {onEditStep && (
                  <button
                    onClick={() => onEditStep(2)}
                    aria-label="Edit details"
                    className="p-1 text-white/40 hover:text-white transition-colors"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-white/60 text-sm">
                by {metadata.isOriginal ? 'you' : (metadata.authorName || 'Unknown')}
              </p>
            </div>
            
            <p className="shrink-0 text-white/50 text-sm whitespace-nowrap">
              {formatFileSize(getTotalFileSize())}, {files.length} image{files.length === 1 ? '' : 's'}
            </p>
          </div>

          {metadata.description && (
            <p className="text-white/70 text-sm leading-relaxed mb-6">
              {metadata.description}
            </p>
          )}

          {(metadata.categories?.length > 0 || parseTagList(metadata.tags).length > 0) && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
              {(metadata.categories ?? []).map((c) => (
                <span key={c} className="px-2.5 py-1 bg-white/10 rounded-full text-xs text-white/80 border border-white/20">
                  {categoryName(c)}
                </span>
              ))}
              {parseTagList(metadata.tags).map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 bg-white/5 rounded-md text-xs text-white/60 border border-white/5"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Status */}
      {error ? (
        <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-5 max-w-lg">
          <div className="flex items-center gap-3 text-red-400">
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Upload failed</p>
              <p className="text-sm text-red-400/80 mt-1">{error}</p>
            </div>
          </div>
        </div>
      ) : isUploading ? (
        <div className="bg-white/5 rounded-xl border border-white/10 p-5 max-w-lg">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-white/70">{status}</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : progress === 100 ? (
        <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-medium">
          <CheckCircleIcon className="w-5 h-5" />
          <span>Upload complete! Redirecting...</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-medium">
          <CheckCircleIcon className="w-5 h-5" />
          <span>Ready to upload</span>
        </div>
      )}
    </div>
  );
}
