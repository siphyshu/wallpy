"use client"

import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/footer';
import WallpackTypeSelector from '@/components/upload/WallpackTypeSelector';
import ImportPack from '@/components/upload/ImportPack';
import FileUploader from '@/components/upload/FileUploader';
import ScheduleBuilder from '@/components/upload/ScheduleBuilder';
import PackMetadata from '@/components/upload/PackMetadata';
import UploadProgress from '@/components/upload/UploadProgress';
import { submitPack } from '@/lib/packs/client-upload';
import { BUILDER_KINDS, configToSchedule, defaultConfig, scheduleToConfig } from '@/lib/spec/builder';
import { validateSchedule } from '@/lib/spec/validate';
import { parseTagList } from '@/lib/packs/limits';

const DRAFT_VERSION = 1;

function draftKey(edit) {
  return edit ? `wallpy-upload-draft:edit:${edit.slug}` : 'wallpy-upload-draft:new';
}

/** The draft lives in the browser only; never let a bad read/write break the wizard. */
function loadDraft(edit) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(draftKey(edit));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.v === DRAFT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function saveDraft(edit, data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(draftKey(edit), JSON.stringify({ v: DRAFT_VERSION, ...data }));
  } catch {
    // Storage full, disabled, or private mode: the draft just won't survive a refresh.
  }
}

function clearDraft(edit) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(draftKey(edit));
  } catch {}
}

function freshState() {
  return {
    step: 1, type: null, files: [], config: null, cover: null,
    metadata: { title: '', description: '', isOriginal: true, authorName: '', authorUrl: '', tags: '', categories: [], aiUse: null, license: 'personal-use' },
  };
}

/** The wizard's starting state for editing: a new version of `edit` (an EditablePack) starts from its latest version; its images are reused, not re-uploaded. */
function editState(edit) {
  const { base } = edit;
  const type = BUILDER_KINDS[base.kind] ?? 'daypack';
  // Schedules the builder can't show open as text on the schedule step.
  const config = scheduleToConfig(type, base.schedule);
  const files = base.files.map((f) => ({
    id: `${f.sha256.slice(0, 12)}-${f.path}`,
    name: f.path,
    size: f.size,
    type: f.mime,
    preview: f.previewUrl,
    existing: { sha256: f.sha256, url: f.url, thumbSha256: f.thumbSha256, previewSha256: f.previewSha256 },
  }));
  const cover = files.find((f) => f.existing.sha256 === base.coverSha256)?.name ?? files[0]?.name ?? null;
  return {
    step: 2,
    type,
    config,
    files,
    cover,
    metadata: {
      title: base.title,
      description: base.description,
      isOriginal: base.uploaderIsArtist,
      authorName: base.artist?.name ?? '',
      authorUrl: base.artist?.url ?? '',
      tags: base.tags.join(', '),
      categories: base.categories,
      aiUse: base.aiUse,
      license: base.license,
    },
  };
}

/** Rebuilds the files list from a saved draft: images still in `edit` (matched by hash) come back fully; everything else is a placeholder (the blob couldn't be stored) that needs re-adding. */
function restoreFiles(draftFiles, edit) {
  const bySha = new Map((edit?.base.files ?? []).map((f) => [f.sha256, f]));
  return (draftFiles ?? []).map((d, i) => {
    const match = d.sha256 ? bySha.get(d.sha256) : null;
    if (match) {
      return {
        id: `${match.sha256.slice(0, 12)}-${match.path}`,
        name: match.path,
        size: match.size,
        type: match.mime,
        preview: match.previewUrl,
        existing: { sha256: match.sha256, url: match.url, thumbSha256: match.thumbSha256, previewSha256: match.previewSha256 },
      };
    }
    return { id: `pending-${i}-${d.name}`, name: d.name, size: d.size, type: d.type, needsReupload: true };
  });
}

function initialState(edit, draft) {
  const base = edit ? editState(edit) : freshState();
  if (!draft) return { ...base, restoredPending: 0 };
  const files = restoreFiles(draft.files, edit);
  return {
    step: draft.step ?? base.step,
    type: draft.type ?? base.type,
    config: draft.config ?? base.config,
    cover: draft.cover ?? base.cover,
    files,
    metadata: draft.metadata ?? base.metadata,
    restoredPending: files.filter((f) => f.needsReupload).length,
  };
}

const neverChanges = () => () => {};

/**
 * The server can't read localStorage, so it (and the first client render,
 * which must match it) sees no draft; `useSyncExternalStore` then corrects
 * that in one synchronous step right after hydrating, without the mismatch a
 * plain effect + setState would cause. `key` remounts `WizardBody` with the
 * real draft already baked into its initial state.
 */
/** @param {{ edit?: import('@/lib/data/editing').EditablePack | null }} props */
export default function UploadWizard({ edit = null }) {
  // getSnapshot must keep returning the same reference, or
  // useSyncExternalStore re-renders forever seeing a "new" object each call.
  const draftSnapshot = useMemo(() => loadDraft(edit), [edit]);
  const draft = useSyncExternalStore(neverChanges, () => draftSnapshot, () => null);
  return <WizardBody key={draft ? 'restored' : 'fresh'} edit={edit} draft={draft} />;
}

function WizardBody({ edit, draft }) {
  const router = useRouter();
  const [initial] = useState(() => initialState(edit, draft));
  const [currentStep, setCurrentStep] = useState(initial.step);
  const [wallpackType, setWallpackType] = useState(initial.type);
  const [uploadedFiles, setUploadedFiles] = useState(initial.files);
  const [scheduleConfig, setScheduleConfig] = useState(initial.config);
  const [packMetadata, setPackMetadata] = useState(initial.metadata);
  const [coverName, setCoverName] = useState(initial.cover);
  const [restoredPending] = useState(initial.restoredPending);

  // A withdrawn draft is replaced by the new version, which takes its number.
  const nextVersion = edit ? edit.latest.number + (edit.latest.status === 'draft' ? 0 : 1) : null;
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState(null);

  const steps = [
    { id: 1, title: 'Type', description: 'Choose the kind of pack' },
    { id: 2, title: 'Details', description: 'Name, categories, credit' },
    { id: 3, title: 'Images', description: 'Add your images' },
    { id: 4, title: 'Schedule', description: 'When each image shows' },
    { id: 5, title: 'Review', description: 'Check and send for review' }
  ];

  // The cover is whatever was explicitly chosen, falling back to the first
  // file if that one's gone (or nothing was chosen yet).
  const effectiveCover = (coverName && uploadedFiles.some((f) => f.name === coverName))
    ? coverName
    : uploadedFiles[0]?.name ?? null;

  // Draft autosave: type, metadata, schedule config, cover and step survive a
  // refresh. Images can't be stored, so only their names are kept.
  useEffect(() => {
    if (isUploading) return;
    saveDraft(edit, {
      step: currentStep,
      type: wallpackType,
      config: scheduleConfig,
      cover: effectiveCover,
      metadata: packMetadata,
      files: uploadedFiles.map((f) => ({ name: f.name, size: f.size, type: f.type, sha256: f.existing?.sha256 ?? null })),
    });
  }, [edit, currentStep, wallpackType, scheduleConfig, effectiveCover, packMetadata, uploadedFiles, isUploading]);

  const hasUnsavedWork = currentStep > 1 || Boolean(wallpackType) || packMetadata.title.trim() !== '' || uploadedFiles.length > 0;
  const unsavedRef = useRef(false);
  useEffect(() => { unsavedRef.current = hasUnsavedWork; }, [hasUnsavedWork]);
  useEffect(() => {
    const handler = (e) => {
      if (!unsavedRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const handleStartOver = () => {
    if (typeof window !== 'undefined' && !window.confirm('Start over? This clears everything you’ve entered here.')) return;
    clearDraft(edit);
    const fresh = edit ? editState(edit) : freshState();
    setCurrentStep(fresh.step);
    setWallpackType(fresh.type);
    setUploadedFiles(fresh.files);
    setScheduleConfig(fresh.config);
    setPackMetadata(fresh.metadata);
    setCoverName(fresh.cover);
  };

  // The schedule step shows what's wrong; moving on needs a valid schedule.
  const scheduleIsValid = () => {
    if (!scheduleConfig) return false;
    try {
      const schedule = configToSchedule(wallpackType, scheduleConfig, { name: packMetadata.title || 'Untitled' });
      return validateSchedule(schedule, uploadedFiles.map((f) => f.name)).length === 0;
    } catch {
      return false;
    }
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return wallpackType !== null;
      case 2:
        return packMetadata.title.trim() !== '' && packMetadata.categories.length >= 1 && packMetadata.categories.length <= 2
          && packMetadata.aiUse !== null
          && (packMetadata.isOriginal || packMetadata.authorName.trim() !== '');
      case 3:
        return uploadedFiles.length > 0 && !uploadedFiles.some((f) => f.needsReupload);
      case 4:
      case 5:
        return scheduleIsValid();
      default:
        return true;
    }
  };

  // What's missing before Next/Submit can be used on this step. The schedule
  // step is skipped here: its problems already show in the Schedule Preview.
  const stepIssues = () => {
    switch (currentStep) {
      case 1:
        return wallpackType ? [] : ['Choose a wallpack type'];
      case 2: {
        const issues = [];
        if (!packMetadata.title.trim()) issues.push('Add a title');
        if (packMetadata.categories.length < 1 || packMetadata.categories.length > 2) issues.push('Pick 1–2 categories');
        if (!packMetadata.aiUse) issues.push('Answer the AI question');
        if (!packMetadata.isOriginal && !packMetadata.authorName.trim()) issues.push('Credit the artist');
        return issues;
      }
      case 3: {
        const issues = [];
        if (uploadedFiles.length === 0) issues.push('Add at least one image');
        if (uploadedFiles.some((f) => f.needsReupload)) issues.push('Add your images back in (same file names slot back in)');
        return issues;
      }
      default:
        return [];
    }
  };

  const handleNext = () => {
    if (canProceedToNext() && currentStep < steps.length) {
      // Entering the schedule step: start from the template for this pack type.
      if (currentStep === 3 && !scheduleConfig) {
        setScheduleConfig(defaultConfig(wallpackType, uploadedFiles.filter((f) => f.type.startsWith('image/')).map((f) => f.name)));
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // A ready-made pack (schedule.toml + images) dropped on step 1: load it and
  // skip straight to the details step.
  const handleImport = ({ type, schedule, images }) => {
    const built = images.map((img) => ({
      file: img.file,
      id: Math.random().toString(36).slice(2, 11),
      name: img.name,
      size: img.file.size,
      type: img.file.type,
      preview: URL.createObjectURL(img.file),
    }));
    setWallpackType(type);
    setUploadedFiles(built);
    setCoverName(built[0]?.name ?? null);
    setPackMetadata((m) => ({ ...m, title: schedule.name && schedule.name !== 'Untitled' ? schedule.name : m.title }));
    setScheduleConfig(scheduleToConfig(type, schedule));
    setCurrentStep(2);
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
          tags: parseTagList(packMetadata.tags),
          categories: packMetadata.categories,
          license: packMetadata.license,
          ai_use: packMetadata.aiUse,
          uploader_is_artist: packMetadata.isOriginal,
          artist: packMetadata.isOriginal ? null : { name: packMetadata.authorName, url: packMetadata.authorUrl },
          schedule: configToSchedule(wallpackType, scheduleConfig, {
            name: packMetadata.title,
            author: packMetadata.isOriginal ? undefined : packMetadata.authorName,
          }),
          images,
          // The creator's choice (step 3); the first image by default.
          cover: effectiveCover ?? images[0]?.name,
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
      clearDraft(edit);
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
          <>
            <WallpackTypeSelector
              selectedType={wallpackType}
              onSelect={(type) => {
                // A different type needs a different schedule.
                if (type !== wallpackType) setScheduleConfig(null);
                setWallpackType(type);
              }}
            />
            <ImportPack onImport={handleImport} />
          </>
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
            coverName={effectiveCover}
            onCoverChange={setCoverName}
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
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background">
      <Page width="wide">
        <div>
          <PageHeader
            title={edit ? `Update ${edit.base.title}` : 'New pack'}
            description={
              !edit
                ? `Step ${currentStep} of ${steps.length} · ${steps[currentStep - 1].title}: ${steps[currentStep - 1].description.toLowerCase()}.`
                : edit.isPublic
                  ? `Changes go to review as version ${nextVersion}. Version ${edit.base.number} stays live until it's approved.`
                  : `Make your changes, then send version ${nextVersion} back for review.`
            }
            actions={hasUnsavedWork && (
              <Button variant="ghost" size="sm" onClick={handleStartOver}>Start over</Button>
            )}
          />

          {restoredPending > 0 && (
            <Notice className="mb-8">
              We restored your draft. Your images need adding again ({restoredPending} missing): drop the same files back in on the Images step and they&apos;ll slot back into place.
            </Notice>
          )}

          {edit?.latest.notes && (
            <Notice className="mb-8">
              <span className="font-medium">Changes requested on version {edit.latest.number}:</span> &ldquo;{edit.latest.notes}&rdquo;
            </Notice>
          )}

          {/* Progress: every step named; done steps ticked, the current one white. */}
          <ol className="mb-12 mx-auto max-w-3xl grid grid-cols-5 gap-2" aria-label="Steps">
            {steps.map((step) => {
              const state = currentStep > step.id ? 'done' : currentStep === step.id ? 'current' : 'todo';
              return (
                <li key={step.id} aria-current={state === 'current' ? 'step' : undefined} className="flex flex-col gap-2 min-w-0">
                  <span className={`h-1 rounded-full ${state === 'todo' ? 'bg-white/15' : 'bg-white'}`} />
                  <span className={`text-xs sm:text-sm truncate ${state === 'current' ? 'text-white font-medium' : state === 'done' ? 'text-white/70' : 'text-white/40'}`}>
                    <span className="hidden sm:inline">{step.id}. </span>{step.title}
                  </span>
                </li>
              );
            })}
          </ol>

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

            <div className="flex flex-col items-end gap-2">
              <div className="flex space-x-4">
                {currentStep < steps.length ? (
                  <button
                    onClick={handleNext}
                    disabled={!canProceedToNext()}
                    className="px-6 py-3 bg-white text-black hover:bg-white/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!canProceedToNext() || isUploading}
                    className="px-6 py-3 bg-white text-black hover:bg-white/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? 'Uploading...' : edit ? `Submit version ${nextVersion}` : 'Upload Wallpack'}
                  </button>
                )}
              </div>
              {stepIssues().length > 0 && (
                <ul className="text-xs text-white/50 text-right space-y-0.5">
                  {stepIssues().map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Page>

      <Footer />
    </div>
  );
}
