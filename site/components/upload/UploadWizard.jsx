"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/footer';
import WallpackTypeSelector from '@/components/upload/WallpackTypeSelector';
import FileUploader from '@/components/upload/FileUploader';
import ScheduleBuilder, { defaultScheduleConfig } from '@/components/upload/ScheduleBuilder';
import PackMetadata from '@/components/upload/PackMetadata';
import UploadProgress from '@/components/upload/UploadProgress';
import { submitPack } from '@/lib/packs/client-upload';
import { builderToSchedule, scheduleToBuilder } from '@/lib/spec/builder';

const BUILDER_KINDS = { timeblocks: 'daypack', days: 'weekpack', album: 'album' };

/**
 * The wizard's starting state. Editing (a new version of `edit`, an
 * EditablePack) starts from that version: its images are reused, not re-uploaded.
 */
function initialState(edit) {
  if (!edit) {
    return {
      step: 1, type: null, files: [], config: null, scheduleNotice: null,
      metadata: { title: '', description: '', isOriginal: true, authorName: '', authorUrl: '', tags: '', aiUse: null, license: 'personal-use' },
    };
  }
  const { base } = edit;
  const type = BUILDER_KINDS[base.kind] ?? 'daypack';
  let config = null;
  let scheduleNotice = null;
  try {
    config = scheduleToBuilder(type, base.schedule);
    // The builders can't show every schedule the format allows (e.g. a file
    // uploaded by hand). Say so rather than quietly changing it.
    // Labels don't count: the builder names unnamed blocks.
    const rebuilt = builderToSchedule(type, config, { name: base.title });
    // Sorted keys: jsonb from the database doesn't keep the original key order.
    const slots = (schedule) => JSON.stringify(schedule.slot.map(({ label: _label, ...slot }) =>
      Object.fromEntries(Object.entries(slot).sort(([a], [b]) => a.localeCompare(b)))));
    if (slots(rebuilt) !== slots(base.schedule)) {
      scheduleNotice = 'This schedule uses options the builder can\'t show yet. Check the schedule step: what you see there is what will be submitted.';
    }
  } catch {
    scheduleNotice = 'The builder couldn\'t read this schedule. Set it up again on the schedule step.';
  }
  return {
    step: 2,
    type,
    config,
    scheduleNotice,
    files: base.files.map((f) => ({
      id: `${f.sha256.slice(0, 12)}-${f.path}`,
      name: f.path,
      size: f.size,
      type: f.mime,
      preview: f.url,
      existing: { sha256: f.sha256, url: f.url },
    })),
    metadata: {
      title: base.title,
      description: base.description,
      isOriginal: base.uploaderIsArtist,
      authorName: base.artist?.name ?? '',
      authorUrl: base.artist?.url ?? '',
      tags: base.tags.join(', '),
      aiUse: base.aiUse,
      license: base.license,
    },
  };
}

/** @param {{ edit?: import('@/lib/data/editing').EditablePack | null }} props */
export default function UploadWizard({ edit = null }) {
  const router = useRouter();
  const [initial] = useState(() => initialState(edit));
  const [currentStep, setCurrentStep] = useState(initial.step);
  const [wallpackType, setWallpackType] = useState(initial.type);
  const [uploadedFiles, setUploadedFiles] = useState(initial.files);
  const [scheduleConfig, setScheduleConfig] = useState(initial.config);
  const [packMetadata, setPackMetadata] = useState(initial.metadata);
  const nextVersion = edit ? edit.latest.number + 1 : null;
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
        return packMetadata.title.trim() !== '' && packMetadata.tags.trim() !== '' && packMetadata.aiUse !== null
          && (packMetadata.isOriginal || packMetadata.authorName.trim() !== '');
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
      // Entering the schedule step: start from the template for this pack type.
      if (currentStep === 3 && !scheduleConfig) {
        setScheduleConfig(defaultScheduleConfig(wallpackType, uploadedFiles.filter((f) => f.type.startsWith('image/'))));
      }
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
    setUploadError(null);
    setUploadProgress(0);
    try {
      const images = uploadedFiles.map((f) => (f.existing ? { name: f.name, existing: f.existing } : { name: f.name, file: f.file }));
      const { slug } = await submitPack(
        {
          title: packMetadata.title,
          description: packMetadata.description,
          tags: packMetadata.tags.split(',').map((t) => t.trim()).filter(Boolean),
          license: packMetadata.license,
          ai_use: packMetadata.aiUse,
          uploader_is_artist: packMetadata.isOriginal,
          artist: packMetadata.isOriginal ? null : { name: packMetadata.authorName, url: packMetadata.authorUrl },
          schedule: builderToSchedule(wallpackType, scheduleConfig, {
            name: packMetadata.title,
            author: packMetadata.isOriginal ? undefined : packMetadata.authorName,
          }),
          images,
          // The first image represents the pack (gallery thumbnail, pack page).
          cover: images[0]?.name,
        },
        ({ status, percent }) => {
          setUploadStatus(status);
          setUploadProgress(percent);
        },
        edit ? {
          slug: edit.slug,
          previous: { coverSha256: edit.base.coverSha256, thumbSha256: edit.base.thumbSha256, previewSha256: edit.base.previewSha256 },
        } : undefined,
      );
      router.push(`/packs/${slug}`);
    } catch (error) {
      setUploadStatus('Upload failed');
      setUploadError(error instanceof Error ? error.message : 'Something went wrong');
      setIsUploading(false);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <WallpackTypeSelector
            selectedType={wallpackType}
            onSelect={(type) => {
              // A different type needs a different schedule.
              if (type !== wallpackType) setScheduleConfig(null);
              setWallpackType(type);
            }}
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
            <h1 className="text-4xl md:text-6xl font-serif mb-6">{edit ? 'Update Wallpack' : 'Create Wallpack'}</h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto">
              {!edit
                ? 'Create and share your dynamic wallpaper packs with the Wallpy community.'
                : edit.isPublic
                  ? `Changes go to review as version ${nextVersion}. Version ${edit.base.number} stays live until it's approved.`
                  : `Make your changes, then send version ${nextVersion} back for review.`}
            </p>
          </div>

          {edit && (edit.latest.notes || initial.scheduleNotice) && (
            <div className="max-w-3xl mx-auto mb-12 flex flex-col gap-3">
              {edit.latest.notes && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                  <span className="font-medium">Changes requested on version {edit.latest.number}:</span> &ldquo;{edit.latest.notes}&rdquo;
                </div>
              )}
              {initial.scheduleNotice && (
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                  {initial.scheduleNotice}
                </div>
              )}
            </div>
          )}

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
                  {isUploading ? 'Uploading...' : edit ? `Submit version ${nextVersion}` : 'Upload Wallpack'}
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
