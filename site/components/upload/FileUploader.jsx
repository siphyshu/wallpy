import { IMAGE_MIMES, PACK_LIMITS, safeImageName } from '@/lib/packs/limits';
import { useState, useRef } from 'react';

export default function FileUploader({ files, onFilesChange, wallpackType, coverName, onCoverChange }) {
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

    // A restored draft can't keep the actual image bytes: it leaves a
    // placeholder with the old name. Re-adding a file with that same name
    // (after sanitising) slots it back into place instead of adding a new one.
    const pendingByName = new Map(files.filter(f => f.needsReupload).map(f => [f.name.toLowerCase(), f]));
    const namesExcludingPending = files.filter(f => !f.needsReupload).map(f => f.name);
    const refills = new Map();
    const freshFiles = [];
    for (const file of validFiles) {
      const candidate = safeImageName(file.name, namesExcludingPending);
      const pending = pendingByName.get(candidate.toLowerCase());
      if (pending && !refills.has(pending.id)) {
        refills.set(pending.id, file);
      } else {
        freshFiles.push(file);
        namesExcludingPending.push(candidate);
      }
    }

    const room = PACK_LIMITS.maxFiles - files.length;
    if (freshFiles.length > room) rejected.push(`Only ${PACK_LIMITS.maxFiles} images per pack`);
    setSkipped(rejected);

    // Names the pack format accepts (lowercase extension, safe characters),
    // unique ignoring case; schedules refer to images by these names.
    const taken = files.map(f => f.name);
    const processedFiles = freshFiles.slice(0, Math.max(room, 0)).map(file => {
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

    onFilesChange(prev => [
      ...prev.map(f => {
        const refill = refills.get(f.id);
        if (!refill) return f;
        return { ...f, file: refill, size: refill.size, type: refill.type, preview: URL.createObjectURL(refill), needsReupload: false };
      }),
      ...processedFiles,
    ]);
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
          accept: 'image/jpeg,image/png,image/webp'
        };
      case 'weekpack':
        return {
          title: 'Upload Images for Weekpack',
          description: 'Upload images for different days of the week. You can assign them to specific days later.',
          accept: 'image/jpeg,image/png,image/webp'
        };
      case 'album':
        return {
          title: 'Upload Images for Album',
          description: 'Upload a collection of images that will rotate or shuffle.',
          accept: 'image/jpeg,image/png,image/webp'
        };
      default:
        return {
          title: 'Upload Images',
          description: 'Upload your wallpaper images.',
          accept: 'image/jpeg,image/png,image/webp'
        };
    }
  };

  const instructions = getUploadInstructions();

  return (
    <div className="max-w-5xl">
      <div className="text-left mb-8">
        <h2 className="sr-only">{instructions.title}</h2>
        <p className="text-white/80 mb-4">{instructions.description}</p>
        <div className="flex items-center gap-6 flex-wrap text-sm text-white/60">
          <span>• Max file size: 30 MB</span>
          <span>• Supported: JPG, PNG, WebP</span>
          <span>• Max files: {PACK_LIMITS.maxFiles}</span>
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
                ? 'border-white/60 bg-white/10'
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
            className="w-full mt-4 px-4 py-3 bg-white text-black hover:bg-white/90 rounded-lg transition-colors font-medium"
          >
            Choose Files
          </button>
        </div>

        {/* File List */}
        <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6">
          <h3 className="text-xl font-bold mb-4">
            Uploaded Files ({files.length})
          </h3>

          {files.some(f => f.needsReupload) && (
            <p className="mb-3 text-xs text-amber-300">
              {files.filter(f => f.needsReupload).length} image{files.filter(f => f.needsReupload).length === 1 ? '' : 's'} need adding again — drop the same file back in and it slots back into place.
            </p>
          )}

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
                  {/* Preview, placeholder, or icon */}
                  {file.needsReupload ? (
                    <div className="w-24 aspect-[16/9] flex-shrink-0 bg-amber-400/10 border border-amber-400/30 rounded flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                    </div>
                  ) : file.preview ? (
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
                    <p className={`text-xs ${file.needsReupload ? 'text-amber-300' : 'text-white/60'}`}>
                      {file.needsReupload ? 'Needs adding again' : file.existing ? `Already in the pack · ${formatFileSize(file.size)}` : formatFileSize(file.size)}
                    </p>
                  </div>

                  {/* Cover toggle */}
                  {onCoverChange && (
                    <button
                      type="button"
                      onClick={() => onCoverChange(file.name)}
                      aria-pressed={coverName === file.name}
                      title={coverName === file.name ? 'This is the cover image' : 'Use as the cover image'}
                      className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap ${
                        coverName === file.name
                          ? 'bg-white text-black border-white'
                          : 'bg-white/5 text-white/50 border-white/20 hover:bg-white/10 hover:text-white/80'
                      }`}
                    >
                      {coverName === file.name ? '★ Cover' : 'Cover'}
                    </button>
                  )}

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
            <li>• Maximum file size: 30 MB per file</li>
            <li>• Supported formats: JPG, PNG, WebP</li>
            <li>• Originals are kept as uploaded; previews are made for the site</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 