"use client"

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/footer';
import WallpackTypeSelector from '@/components/upload/WallpackTypeSelector';
import FileUploader from '@/components/upload/FileUploader';
import ScheduleBuilder from '@/components/upload/ScheduleBuilder';
import PackMetadata from '@/components/upload/PackMetadata';
import UploadProgress from '@/components/upload/UploadProgress';

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

  const steps = [
    { id: 1, title: 'Choose Type', description: 'Select wallpack type' },
    { id: 2, title: 'Upload Files', description: 'Upload your images' },
    { id: 3, title: 'Configure Schedule', description: 'Set up display schedule' },
    { id: 4, title: 'Metadata', description: 'Add pack information' },
    { id: 5, title: 'Upload', description: 'Upload to Wallpy' }
  ];

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return wallpackType !== null;
      case 2:
        return uploadedFiles.length > 0;
      case 3:
        return scheduleConfig !== null;
      case 4:
        return packMetadata.title.trim() !== '' && packMetadata.tags.trim() !== '';
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

    try {
      // Simulate the upload process
      const uploadSteps = [
        { progress: 20, status: 'Validating files...' },
        { progress: 40, status: 'Generating previews...' },
        { progress: 60, status: 'Uploading to S3...' },
        { progress: 80, status: 'Saving to database...' },
        { progress: 100, status: 'Upload complete!' }
      ];

      for (const step of uploadSteps) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setUploadProgress(step.progress);
        setUploadStatus(step.status);
      }

      // Simulate success
      setTimeout(() => {
        setIsUploading(false);
        alert('Wallpack uploaded successfully!');
        router.push('/gallery');
      }, 1000);

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('Upload failed. Please try again.');
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
          <FileUploader
            files={uploadedFiles}
            onFilesChange={setUploadedFiles}
            wallpackType={wallpackType}
          />
        );
      case 3:
        return (
          <ScheduleBuilder
            wallpackType={wallpackType}
            files={uploadedFiles}
            config={scheduleConfig}
            onConfigChange={setScheduleConfig}
          />
        );
      case 4:
        return (
          <PackMetadata
            metadata={packMetadata}
            onMetadataChange={setPackMetadata}
            isOriginal={packMetadata.isOriginal}
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