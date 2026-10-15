export default function UploadProgress({ 
  progress, 
  status, 
  isUploading, 
  wallpackType, 
  files, 
  scheduleConfig, 
  metadata 
}) {
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif font-bold mb-4">Upload Wallpack</h2>
        <p className="text-white/80 text-lg">Review and upload your wallpack</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Upload Progress */}
        <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6">
          <h3 className="text-xl font-bold mb-4">Upload Progress</h3>
          
          {isUploading ? (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>{status}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3">
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-white/60">Ready to upload</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6">
          <h3 className="text-xl font-bold mb-4">Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Type:</span>
              <span>{wallpackType}</span>
            </div>
            <div className="flex justify-between">
              <span>Files:</span>
              <span>{files.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Title:</span>
              <span>{metadata.title || 'Untitled'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 