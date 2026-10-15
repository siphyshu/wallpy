"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/footer';
import WallpackTypeSelector from '@/components/upload/WallpackTypeSelector';
import FileUploader from '@/components/upload/FileUploader';
import ScheduleBuilder from '@/components/upload/ScheduleBuilder';
import PackMetadata from '@/components/upload/PackMetadata';
import UploadProgress from '@/components/upload/UploadProgress';
import { generateThumbnail, generateBlurhash, generateSlug, getPreviewImage } from '@/lib/upload/preview-utils';
import { createPackZip } from '@/lib/upload/zip-utils';
import { createClient } from '@/lib/supabase/client';
import toml from '@iarna/toml';

export default function UploadPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [wallpackType, setWallpackType] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [scheduleConfig, setScheduleConfig] = useState(null);
  const [packMetadata, setPackMetadata] = useState({
    title: '',
    description: '',
    isOriginal: true,
    authorName: '',
    authorUrl: '',
    tags: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState(null);

  const steps = [
    { id: 1, title: 'Choose Type', description: 'Select wallpack type' },
    { id: 2, title: 'Metadata', description: 'Add pack information' },
    { id: 3, title: 'Upload Files', description: 'Upload your images' },
    { id: 4, title: 'Configure Schedule', description: 'Set up display schedule' },
    { id: 5, title: 'Upload', description: 'Upload to Wallpy' }
  ];

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return wallpackType !== null;
      case 2:
        return packMetadata.title.trim() !== '' && packMetadata.tags.trim() !== '';
      case 3:
        return uploadedFiles.length > 0;
      case 4:
        return scheduleConfig !== null;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceedToNext() && currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!canProceedToNext()) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Preparing files...');
    setUploadError(null);

    try {
      // Step 1: Generate slug from title and check for duplicates
      let baseSlug = generateSlug(packMetadata.title);
      let uniqueSlug = baseSlug;
      let attempt = 1;
      
      // Check if slug exists
      while (true) {
        const checkResponse = await fetch(`/api/packs?slug=${uniqueSlug}`);
        if (checkResponse.ok) {
          const data = await checkResponse.json();
          // If packs array is empty or doesn't contain this slug, it's available
          const existingPack = data.packs?.find(p => p.slug === uniqueSlug);
          if (!existingPack || data.packs.length === 0) {
            break; // Slug is available
          }
        } else {
          // If API error, assume slug is available (will fail later if duplicate)
          break;
        }
        // Slug exists, try with suffix
        uniqueSlug = `${baseSlug}-${attempt}`;
        attempt++;
        if (attempt > 100) {
          // Fallback to timestamp if too many attempts
          uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
          break;
        }
      }
      
      setUploadProgress(5);
      setUploadStatus('Generating preview...');

      // Step 2: Generate thumbnail and blurhash from first image
      const previewFile = getPreviewImage(uploadedFiles);
      let thumbnailBlob = null;
      let blurhash = null;

      if (previewFile) {
        try {
          const thumbnailResult = await generateThumbnail(previewFile, 800);
          thumbnailBlob = thumbnailResult.blob;
          blurhash = await generateBlurhash(previewFile);
        } catch (err) {
          console.warn('Failed to generate preview:', err);
        }
      }

      setUploadProgress(15);
      setUploadStatus('Building ZIP file...');

      // Step 3: Get user profile for author name if original
      let authorName = null;
      if (packMetadata.isOriginal) {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, username')
              .eq('id', user.id)
              .single();
            authorName = profile?.display_name || profile?.username || null;
          }
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      } else {
        authorName = packMetadata.authorName || null;
      }

      // Step 4: Generate schedule.toml with metadata and create ZIP
      const scheduleWithMeta = {
        meta: {
          name: packMetadata.title,
          type: wallpackType === 'daypack' ? 'timeblocks' : wallpackType === 'weekpack' ? 'days' : 'album',
          author: authorName,
          description: packMetadata.description || null,
          version: '1.0'
        },
        ...scheduleConfig
      };
      const scheduleTomlString = toml.stringify(scheduleWithMeta);
      const zipBlob = await createPackZip(uploadedFiles, scheduleTomlString, uniqueSlug);

      setUploadProgress(25);
      setUploadStatus('Requesting upload URLs...');

      // Step 4: Prepare file list for presigned URLs
      const filesToUpload = [];
      
      // Add original images to full/ folder
      const imageFiles = uploadedFiles.filter(f => f.type?.startsWith('image/'));
      imageFiles.forEach(file => {
        filesToUpload.push({
          key: `full/${file.name}`,
          contentType: file.type,
          file: file.file
        });
      });

      // Add thumbnail to preview/ folder
      if (thumbnailBlob) {
        filesToUpload.push({
          key: 'preview/thumb.jpg',
          contentType: 'image/jpeg',
          file: thumbnailBlob
        });
      }

      // Add schedule.toml
      const scheduleBlob = new Blob([scheduleTomlString], { type: 'text/plain' });
      filesToUpload.push({
        key: 'schedule.toml',
        contentType: 'text/plain',
        file: scheduleBlob
      });

      // Add ZIP file
      filesToUpload.push({
        key: `${uniqueSlug}.zip`,
        contentType: 'application/zip',
        file: zipBlob
      });

      // Step 5: Request presigned URLs
      const presignResponse = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: uniqueSlug,
          files: filesToUpload.map(f => ({ key: f.key, contentType: f.contentType }))
        })
      });

      if (!presignResponse.ok) {
        const errorData = await presignResponse.json();
        throw new Error(errorData.error || 'Failed to get upload URLs');
      }

      const presignData = await presignResponse.json();

      setUploadProgress(35);
      setUploadStatus('Uploading files to S3...');

      // Step 6: Upload files to S3
      const totalFiles = filesToUpload.length;
      let uploadedCount = 0;

      for (const fileInfo of filesToUpload) {
        const presignedFile = presignData.files.find(f => f.key === fileInfo.key);
        if (!presignedFile) {
          throw new Error(`Missing presigned URL for ${fileInfo.key}`);
        }

        const uploadResponse = await fetch(presignedFile.presignedUrl, {
          method: 'PUT',
          body: fileInfo.file,
          headers: {
            'Content-Type': fileInfo.contentType
          }
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${fileInfo.key}`);
        }

        uploadedCount++;
        const progressPercent = 35 + Math.round((uploadedCount / totalFiles) * 45);
        setUploadProgress(progressPercent);
        setUploadStatus(`Uploading files... (${uploadedCount}/${totalFiles})`);
      }

      setUploadProgress(85);
      setUploadStatus('Saving to database...');

      // Step 7: Get the public URLs
      const zipFileUrl = presignData.files.find(f => f.key.endsWith('.zip'))?.publicUrl;
      const previewImageUrl = presignData.files.find(f => f.key === 'preview/thumb.jpg')?.publicUrl;

      if (!zipFileUrl) {
        throw new Error('Failed to get ZIP file URL');
      }

      // Step 8: Create pack record in database
      const createPackResponse = await fetch('/api/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: packMetadata.title,
          slug: uniqueSlug,
          description: packMetadata.description,
          pack_type: wallpackType,
          is_original: packMetadata.isOriginal,
          author_name: packMetadata.isOriginal ? null : packMetadata.authorName,
          author_url: packMetadata.isOriginal ? null : packMetadata.authorUrl,
          tags: packMetadata.tags,
          preview_image_url: previewImageUrl,
          blurhash: blurhash,
          zip_file_url: zipFileUrl
        })
      });

      if (!createPackResponse.ok) {
        const errorData = await createPackResponse.json();
        throw new Error(errorData.error || 'Failed to save pack');
      }

      setUploadProgress(100);
      setUploadStatus('Upload complete!');

      // Success - redirect after a short delay
      setTimeout(() => {
        setIsUploading(false);
        router.push(`/packs/${uniqueSlug}`);
      }, 1500);

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('Upload failed');
      setUploadError(error.message);
      setIsUploading(false);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <WallpackTypeSelector
            selectedType={wallpackType}
            onSelect={setWallpackType}
          />
        );
      case 2:
        return (
          <PackMetadata
            metadata={packMetadata}
            onMetadataChange={setPackMetadata}
          />
        );
      case 3:
        return (
          <FileUploader
            files={uploadedFiles}
            onFilesChange={setUploadedFiles}
            wallpackType={wallpackType}
          />
        );
      case 4:
        return (
          <ScheduleBuilder
            wallpackType={wallpackType}
            files={uploadedFiles}
            config={scheduleConfig}
            onConfigChange={setScheduleConfig}
            metadata={packMetadata}
          />
        );
      case 5:
        return (
          <UploadProgress
            progress={uploadProgress}
            status={uploadStatus}
            isUploading={isUploading}
            wallpackType={wallpackType}
            files={uploadedFiles}
            scheduleConfig={scheduleConfig}
            metadata={packMetadata}
            onEditStep={setCurrentStep}
            error={uploadError}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background/80">
      <section className="relative mt-20 pt-24 px-6 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-serif mb-6">Create Wallpack</h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto">
              Create and share your dynamic wallpaper packs with the Wallpy community.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-12">
            <div className="flex items-center justify-center">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                    currentStep >= step.id 
                      ? 'bg-blue-500 border-blue-500 text-white' 
                      : 'border-white/30 text-white/50'
                  }`}>
                    {currentStep > step.id ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-2 ${
                      currentStep > step.id ? 'bg-blue-500' : 'bg-white/30'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center mt-4">
              <h2 className="text-xl font-medium">{steps[currentStep - 1].title}</h2>
              <p className="text-white/60">{steps[currentStep - 1].description}</p>
            </div>
          </div>

          {/* Current Step Content */}
          <div className="mb-8">
            {renderCurrentStep()}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="px-6 py-3 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex space-x-4">
              {currentStep < steps.length ? (
                <button
                  onClick={handleNext}
                  disabled={!canProceedToNext()}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canProceedToNext() || isUploading}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : 'Upload Wallpack'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
