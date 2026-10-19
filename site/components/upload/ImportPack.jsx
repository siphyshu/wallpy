"use client"

import { useRef, useState } from 'react';
import JSZip from 'jszip';
import toml from '@iarna/toml';
import { kindOfSchedule, scheduleToConfig } from '@/lib/spec/builder';
import { validateSchedule } from '@/lib/spec/validate';
import { safeImageName } from '@/lib/packs/limits';

const EXT_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

function extOf(path) {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? m[1].toLowerCase() : '';
}

function isJunk(path) {
  const base = path.split('/').pop() ?? '';
  return base === '' || base.startsWith('.') || path.includes('__MACOSX');
}

/**
 * Finds schedule.toml among `entries`, parses it, collects the images next to
 * it (flat or in an images/ subfolder), and checks the result against the
 * spec. `entries`: [{ path, blob() => Promise<Blob> }].
 */
async function importFromEntries(entries) {
  const usable = entries.filter((e) => !isJunk(e.path));
  const scheduleEntries = usable.filter((e) => /(^|\/)schedule\.toml$/i.test(e.path));
  if (scheduleEntries.length === 0) throw new Error('No schedule.toml found in the folder or zip.');
  scheduleEntries.sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  const scheduleEntry = scheduleEntries[0];
  const root = scheduleEntry.path.slice(0, scheduleEntry.path.length - 'schedule.toml'.length);

  const text = await (await scheduleEntry.blob()).text();
  let parsed;
  try {
    parsed = toml.parse(text);
  } catch (e) {
    throw new Error(`schedule.toml is not valid TOML: ${e.message}`);
  }
  if (parsed.meta || parsed.timeblocks || parsed.days || parsed.album) {
    throw new Error('This is an old (spec 1) schedule. Wallpy now uses spec 2: start the file with spec = 2 and list [[slot]]s.');
  }
  if (parsed.spec !== 2 || !Array.isArray(parsed.slot)) {
    throw new Error('Not a Wallpy schedule: expected spec = 2 and at least one [[slot]].');
  }

  const underRoot = usable.filter((e) => e.path.startsWith(root) && e !== scheduleEntry);
  const imageEntries = underRoot.filter((e) => {
    const rest = e.path.slice(root.length);
    if (rest.includes('/') && !rest.startsWith('images/')) return false;
    return extOf(rest) in EXT_MIME;
  });
  if (imageEntries.length === 0) throw new Error('No images found next to schedule.toml (flat, or in an images/ subfolder).');

  const unknown = underRoot
    .filter((e) => !imageEntries.includes(e))
    .map((e) => e.path.slice(root.length))
    .filter(Boolean);

  const taken = [];
  const images = [];
  for (const e of imageEntries) {
    const rest = e.path.slice(root.length);
    const base = rest.split('/').pop();
    const ext = extOf(base);
    const name = safeImageName(base, taken);
    taken.push(name);
    const blob = await e.blob();
    images.push({ name, file: new File([blob], name, { type: EXT_MIME[ext] }) });
  }

  const kind = kindOfSchedule(parsed);
  const problems = [
    ...validateSchedule(parsed, images.map((i) => i.name)),
    ...unknown.map((u) => `Unknown file in the pack: ${u}`),
  ];

  return { kind, schedule: parsed, images, problems };
}

async function entriesFromZip(file) {
  const zip = await JSZip.loadAsync(file);
  const entries = [];
  zip.forEach((path, entry) => {
    if (!entry.dir) entries.push({ path, blob: () => entry.async('blob') });
  });
  return entries;
}

function entriesFromFileList(fileList) {
  return [...fileList].map((f) => ({ path: f.webkitRelativePath || f.name, blob: async () => f }));
}

function readDirEntry(entry) {
  return new Promise((resolve, reject) => {
    if (entry.isFile) {
      entry.file((file) => resolve([{ path: entry.fullPath.replace(/^\//, ''), blob: async () => file }]), reject);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all = [];
      const next = () => reader.readEntries(async (batch) => {
        if (!batch.length) { resolve(all); return; }
        for (const e of batch) all.push(...(await readDirEntry(e)));
        next();
      }, reject);
      next();
    } else {
      resolve([]);
    }
  });
}

/**
 * Import step 1: drop a ready-made pack (schedule.toml + images, as a folder
 * or a .zip) instead of building one from scratch. On success it hands the
 * parsed type, schedule and images up and the wizard jumps to the details step.
 */
export default function ImportPack({ onImport }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const folderInputRef = useRef(null);
  const zipInputRef = useRef(null);

  const finish = async (entries) => {
    setBusy(true);
    setError(null);
    try {
      const { kind, schedule, images, problems } = await importFromEntries(entries);
      if (problems.length > 0) {
        setError(problems);
        return;
      }
      onImport({ type: kind, schedule, images });
    } catch (e) {
      setError([e instanceof Error ? e.message : 'Could not import this pack']);
    } finally {
      setBusy(false);
    }
  };

  const handleFolderInput = (e) => {
    const files = e.target.files;
    e.target.value = '';
    if (files && files.length) finish(entriesFromFileList(files));
  };

  const importZipFile = async (file) => {
    setBusy(true);
    setError(null);
    try {
      const entries = await entriesFromZip(file);
      await finish(entries);
    } catch (e) {
      setError([e instanceof Error ? e.message : 'Could not read this zip file']);
      setBusy(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      importZipFile(files[0]);
      return;
    }
    const items = [...(e.dataTransfer.items ?? [])];
    const dirEntries = items.map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
    if (dirEntries.length) {
      setBusy(true);
      setError(null);
      try {
        const nested = await Promise.all(dirEntries.map(readDirEntry));
        await finish(nested.flat());
      } catch {
        setError(['Could not read the dropped folder. Try "Choose a folder" or drop a .zip instead.']);
        setBusy(false);
      }
      return;
    }
    if (files.length) {
      finish(entriesFromFileList(files));
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-8">
      <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 p-6">
        <h3 className="text-lg font-bold mb-1">Already have a pack ready?</h3>
        <p className="text-sm text-white/60 mb-4">
          Import a pack folder or a .zip with a <span className="font-mono">schedule.toml</span> and its images, and skip straight to the details step.
        </p>
        <div
          className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            isDragOver ? 'border-white/60 bg-white/10' : 'border-white/20'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
          onDrop={handleDrop}
        >
          <p className="text-sm text-white/70 mb-3">Drop a .zip file here, or</p>
          <div className="flex items-center justify-center gap-3">
            <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple onChange={handleFolderInput} className="hidden" />
            <button
              type="button"
              disabled={busy}
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-medium disabled:opacity-50"
            >
              Choose a folder
            </button>
            <input ref={zipInputRef} type="file" accept=".zip" onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) importZipFile(file);
            }} className="hidden" />
            <button
              type="button"
              disabled={busy}
              onClick={() => zipInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-medium disabled:opacity-50"
            >
              Choose a .zip file
            </button>
          </div>
          {busy && <p className="mt-3 text-xs text-white/50">Reading your pack…</p>}
        </div>
        {error && (
          <ul className="mt-4 space-y-1 text-xs text-red-400">
            {error.map((msg) => <li key={msg}>{msg}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
