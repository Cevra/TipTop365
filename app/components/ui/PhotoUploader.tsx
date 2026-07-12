'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/ui/cn';

// Camera-first photo capture (plan §20.4). PRESENTATIONAL for E0.10: local file
// selection + preview grid + per-room min-count indicator. The offline-tolerant
// upload queue (IndexedDB + service-worker retry, D20) and signed-URL PUT land
// in E4.9/E3.7 — this component's API (onFiles) stays the seam.
export function PhotoUploader({
  roomLabel,
  minCount = 0,
  onFiles,
}: {
  roomLabel?: string;
  minCount?: number;
  onFiles?: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  const handle = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    setPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    onFiles?.(files);
  };

  const enough = previews.length >= minCount;

  return (
    <div className="flex flex-col gap-2">
      {roomLabel && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900">{roomLabel}</span>
          {minCount > 0 && (
            <span className={cn(enough ? 'text-status-done' : 'text-gray-500')}>
              {previews.length}/{minCount} {enough ? '✓' : ''}
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {previews.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="" className="aspect-square w-full rounded-lg object-cover" />
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-primary-400 hover:text-primary-500"
          aria-label="Dodaj fotografiju"
        >
          <span className="text-2xl">＋</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
    </div>
  );
}
