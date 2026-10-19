"use client";

import { useState } from 'react';
import JSZip from 'jszip';
import toml from '@iarna/toml';
import { errorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Manifest } from '@/lib/types';

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function folderName(title: string): string {
  return title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'wallpy-pack';
}

/**
 * Builds the pack zip in the browser from the manifest, in the layout the CLI
 * installs (<Pack Name>/schedule.toml + images/), checking every file's hash.
 */
export default function DownloadZipButton({ slug }: { slug: string }) {
  const [state, setState] = useState<{ busy: boolean; done: number; total: number; error: string | null }>({
    busy: false, done: 0, total: 0, error: null,
  });

  async function download() {
    setState({ busy: true, done: 0, total: 0, error: null });
    try {
      const res = await fetch(`/api/packs/${slug}/manifest?download=web`);
      if (!res.ok) throw new Error('Could not load this pack');
      const manifest: Manifest = await res.json();

      const root = folderName(manifest.title);
      const zip = new JSZip();
      zip.file(`${root}/schedule.toml`, toml.stringify(manifest.schedule as toml.JsonMap));
      setState((s) => ({ ...s, total: manifest.files.length }));

      for (const file of manifest.files) {
        // 'reload': the page's <img> tags may have cached a copy without CORS headers.
        const buffer = await (await fetch(file.url, { cache: 'reload' })).arrayBuffer();
        if ((await sha256Hex(buffer)) !== file.sha256) {
          throw new Error(`${file.path} didn't match its checksum; try again`);
        }
        zip.file(`${root}/images/${file.path}`, buffer);
        setState((s) => ({ ...s, done: s.done + 1 }));
      }

      // Images are already compressed; STORE is much faster and barely bigger.
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const link = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `${slug}.zip`,
      });
      link.click();
      URL.revokeObjectURL(link.href);
      setState({ busy: false, done: 0, total: 0, error: null });
    } catch (error) {
      setState({ busy: false, done: 0, total: 0, error: errorMessage(error) });
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" onClick={download} disabled={state.busy}>
        {state.busy ? `Downloading ${state.done}/${state.total || '…'}` : `Download ZIP`}
      </Button>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
    </div>
  );
}
