import { useState, useRef } from 'react';
import { CloudArrowUpIcon, DocumentTextIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import toml from '@iarna/toml';
import { scheduleToConfig } from '@/lib/spec/builder';

const TYPE_NAMES = { daypack: 'Daypack', weekpack: 'Weekpack', album: 'Album' };

/** Load a spec 2 schedule.toml into the builder (or as text, if the builder can't show it). */
export default function ScheduleUploader({ onConfigChange, wallpackType = 'daypack' }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const fileInputRef = useRef(null);

  const getTypeName = () => TYPE_NAMES[wallpackType] ?? 'wallpack';

  const parseScheduleFile = async (file) => {
    const parsed = toml.parse(await file.text());
    if (parsed.meta || parsed.timeblocks || parsed.days || parsed.album) {
      throw new Error('This is an old (spec 1) schedule. Wallpy now uses spec 2: start the file with spec = 2 and list [[slot]]s. See the configuration guide below.');
    }
    if (parsed.spec !== 2 || !Array.isArray(parsed.slot)) {
      throw new Error('Not a Wallpy schedule: expected spec = 2 and at least one [[slot]].');
    }
    return scheduleToConfig(wallpackType, parsed);
  };

  const handleFileUpload = async (file) => {
    setUploadError(null);
    setUploadSuccess(null);
    
    // Validate file type
    if (file.type !== 'text/plain' && !file.name.endsWith('.toml')) {
      setUploadError('Please upload a .toml file');
      return;
    }
    
    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      setUploadError('File size must be less than 1MB');
      return;
    }
    
    try {
      const parsedConfig = await parseScheduleFile(file);
      onConfigChange(parsedConfig);
      setUploadSuccess(parsedConfig.mode === 'builder'
        ? 'Loaded into the builder.'
        : `This schedule uses options the ${getTypeName()} builder can't show, so it's open as text in the Schedule Preview.`);
      setTimeout(() => setUploadSuccess(null), 6000);
      
    } catch (error) {
      setUploadError(error.message);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset the input
    e.target.value = '';
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-white/5 rounded-xl shadow-lg p-6 border border-white/10">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold mb-2">Upload Schedule File</h3>
        <p className="text-white/70 text-sm">
          Upload an existing <span className="font-mono">schedule.toml</span> file (spec 2) to load it into the {getTypeName()} builder
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ease-out cursor-pointer ${
          isDragOver
            ? 'border-white/60 bg-white/10'
            : 'border-white/20 hover:border-white/40 hover:bg-white/5'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".toml,text/plain"
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 bg-white/10 rounded-full">
            <CloudArrowUpIcon className="w-8 h-8 text-white/60" />
          </div>
          
          <div>
            <p className="text-white/90 font-medium mb-1">
              Drop your schedule.toml file here
            </p>
            <p className="text-white/50 text-sm">
              or <span className="text-white/70 underline">browse files</span>
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <DocumentTextIcon className="w-4 h-4" />
            <span>Supports .toml files up to 1MB</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {uploadError && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-red-400">
            <ExclamationTriangleIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Upload Error</span>
          </div>
          <p className="text-red-300 text-sm mt-1">{uploadError}</p>
        </div>
      )}

      {/* Success Message */}
      {uploadSuccess && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-green-400">
            <DocumentTextIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Upload Successful</span>
          </div>
          <p className="text-green-300 text-sm mt-1">{uploadSuccess}</p>
        </div>
      )}
    </div>
  );
}
