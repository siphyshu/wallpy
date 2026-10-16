import { IMAGE_MIMES, PACK_LIMITS, safeImageName } from '@/lib/packs/limits';
import { useState, useRef } from 'react';

export default function FileUploader({ files, onFilesChange, wallpackType }) {
  const [dragActive, setDragActive] = useState(false);
  const [skipped, setSkipped] = useState([]);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (newFiles) => {
    const all = Array.from(newFiles);
    const rejected = [];
    const validFiles = all.filter(file => {
      if (!IMAGE_MIMES.includes(file.type)) { rejected.push(`${file.name}: use JPG, PNG or WebP`); return false; }
      if (file.size > PACK_LIMITS.maxFileBytes) { rejected.push(`${file.name}: larger than 30 MB`); return false; }
      return true;
    });
    const room = PACK_LIMITS.maxFiles - files.length;
    if (validFiles.length > room) rejected.push(`Only ${PACK_LIMITS.maxFiles} images per pack`);
    setSkipped(rejected);

    // Names the pack format accepts (lowercase extension, safe characters),
    // unique ignoring case; schedules refer to images by these names.
    const taken = files.map(f => f.name);
    const processedFiles = validFiles.slice(0, Math.max(room, 0)).map(file => {
      const name = safeImageName(file.name, taken);
      taken.push(name);
      return {
        file,
        id: Math.random().toString(36).substr(2, 9),
        name,
        size: file.size,
        type: file.type,
        preview: URL.createObjectURL(file)
      };
    });

    onFilesChange(prev => [...prev, ...processedFiles]);
  };

  const removeFile = (id) => {
    const fileToRemove = files.find(f => f.id === id);
    if (fileToRemove && fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
    onFilesChange(prev => prev.filter(file => file.id !== id));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getUploadInstructions = () => {
    switch (wallpackType) {
      case 'daypack':
        return {
          title: 'Upload Images for Daypack',
          description: 'Upload images that will be used throughout the day. You can organize them into time blocks later.',
          accept: 'image/jpeg,image/png,image/webp',
          maxFiles: 20
        };
      case 'weekpack':
        return {
          title: 'Upload Images for Weekpack',
          description: 'Upload images for different days of the week. You can assign them to specific days later.',
          accept: 'image/jpeg,image/png,image/webp',
          maxFiles: 35
        };
      case 'album':
        return {
          title: 'Upload Images for Album',
          description: 'Upload a collection of images that will rotate or shuffle.',
          accept: 'image/jpeg,image/png,image/webp',
          maxFiles: 50
        };
      default:
        return {
          title: 'Upload Images',
          description: 'Upload your wallpaper images.',
          accept: 'image/jpeg,image/png,image/webp',
          maxFiles: 20
        };
    }
  };

  const instructions = getUploadInstructions();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif font-bold mb-4">{instructions.title}</h2>
        <p className="text-white/80 text-lg mb-4">{instructions.description}</p>
        <div className="flex items-center justify-center space-x-6 text-sm text-white/60">
          <span>• Max file size: 100MB</span>
          <span>• Supported: JPG, PNG, ZIP</span>
          <span>• Max files: {instructions.maxFiles}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Upload Area */}
        <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6">
          <h3 className="text-xl font-bold mb-4">Upload Files</h3>
          
          {/* Drag & Drop Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
              dragActive 
                ? 'border-blue-400 bg-blue-400/10' 
                : 'border-white/20 hover:border-white/30'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={instructions.accept}
              onChange={handleChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-white/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium mb-2">
                  Drop your files here or click to browse
                </p>
                <p className="text-sm text-white/60">
                  JPG, PNG or WebP · up to 30 MB each · {PACK_LIMITS.maxFiles} images max
                </p>
              </div>
            </div>
          </div>

          {skipped.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-red-400">
              {skipped.map((reason) => <li key={reason}>Skipped {reason}</li>)}
            </ul>
          )}

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full mt-4 px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors font-medium"
          >
            Choose Files
          </button>
        </div>

        {/* File List */}
        <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6">
          <h3 className="text-xl font-bold mb-4">
            Uploaded Files ({files.length})
          </h3>
          
          {files.length === 0 ? (
            <div className="text-center py-8 text-white/50">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No files uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto scrollbar">
              {files.map((file) => (
                <div key={file.id} className="flex items-center space-x-3 bg-white/5 rounded-lg p-3 mr-2">
                  {/* Preview or Icon */}
                  {file.preview ? (
                    <img 
                      src={file.preview} 
                      alt={file.name}
                      className="object-cover rounded aspect-[16/9] w-24"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-white/10 rounded flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                  
                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-white/60">{formatFileSize(file.size)}</p>
                  </div>
                  
                  {/* Remove Button */}
                  <button
                    onClick={() => removeFile(file.id)}
                    className="text-red-400 hover:text-red-300 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Guidelines */}
      <div className="mt-8 bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-bold mb-3">Upload Guidelines</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-white/80">
          <ul className="space-y-2">
            <li>• Use high-quality images (minimum 1920x1080)</li>
            <li>• Ensure you have rights to share the content</li>
            <li>• Use descriptive filenames for better organization</li>
          </ul>
          <ul className="space-y-2">
            <li>• Maximum file size: 100MB per file</li>
            <li>• Supported formats: JPG, PNG, ZIP</li>
            <li>• Images will be automatically optimized</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 