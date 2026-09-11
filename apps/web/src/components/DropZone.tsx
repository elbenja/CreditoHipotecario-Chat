import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MAX_BYTES } from '../pdf/readPdf';
import { Icon } from './Icon';

/** How long the amber "can't read that" overlay stays after a bad drop. */
const REJECT_MS = 3000;

// While a file is still being dragged the browser exposes its MIME type but
// not its name, so the extension in "No puedo leer .docx" comes from here.
const EXT_BY_MIME: Record<string, string> = {
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'application/zip': 'zip',
};

const isPdf = (type: string, name = '') =>
  type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');

const extOf = (name: string): string | null => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : null;
};

type Drag = { kind: 'ok' } | { kind: 'bad'; ext: string | null };

/**
 * Cards 10 and 11: the whole chat column is the drop target. A dragged file
 * dims and blurs the chat behind a dashed overlay that says what we accept;
 * a file we cannot read gets the amber variant and is never handed up.
 */
export function DropZone({
  onDrop,
  disabled = false,
  className = '',
  children,
}: {
  onDrop: (file: File) => void;
  /** A read already in flight: the overlay still shows, the drop is ignored. */
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  // dragenter/dragleave fire for every child crossed; only the outermost
  // transition matters, so count the depth instead of trusting each event.
  const depth = useRef(0);

  useEffect(() => {
    if (rejected === null) return;
    const t = setTimeout(() => setRejected(null), REJECT_MS);
    return () => clearTimeout(t);
  }, [rejected]);

  const classify = (dt: DataTransfer): Drag | null => {
    const files = Array.from(dt.items ?? []).filter((i) => i.kind === 'file');
    // A text or link drag is not ours.
    if (files.length === 0 && !Array.from(dt.types ?? []).includes('Files')) return null;
    const bad = files.find((i) => !isPdf(i.type));
    if (!bad) return { kind: 'ok' };
    return { kind: 'bad', ext: EXT_BY_MIME[bad.type] ?? null };
  };

  const onDragEnter = (e: React.DragEvent) => {
    const kind = classify(e.dataTransfer);
    if (!kind) return;
    e.preventDefault();
    depth.current += 1;
    setDrag(kind);
    setRejected(null);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = drag.kind === 'ok' && !disabled ? 'copy' : 'none';
  };

  const onDragLeave = () => {
    if (!drag) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDrag(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!drag) return;
    e.preventDefault();
    depth.current = 0;
    setDrag(null);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!isPdf(file.type, file.name)) {
      setRejected(extOf(file.name) ?? EXT_BY_MIME[file.type] ?? '');
      return;
    }
    onDrop(file);
  };

  const bad: string | null | false =
    drag?.kind === 'bad' ? drag.ext : rejected !== null ? rejected : false;
  const veiled = drag !== null || rejected !== null;

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      style={bad !== false ? { cursor: 'no-drop' } : undefined}
    >
      <div
        className={`flex min-h-0 flex-1 flex-col transition-[filter,opacity] duration-180 ease-ch ${
          veiled ? 'pointer-events-none opacity-[.28] blur-[3px]' : ''
        }`}
      >
        {children}
      </div>

      {veiled && (
        <div
          role="status"
          aria-live="polite"
          data-testid="drop-overlay"
          data-variant={bad !== false ? 'bad' : 'ok'}
          className={`ch-veil pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed ${
            bad !== false
              ? 'border-[rgba(245,158,11,.5)] bg-[rgba(11,15,26,.78)]'
              : 'border-slate-500 bg-[rgba(11,15,26,.72)]'
          }`}
        >
          {bad !== false ? (
            <>
              <Icon name="file-not-found" size={28} className="text-[#f59e0b]" />
              <div className="text-center">
                <div className="font-jakarta text-[15px] font-bold tracking-[-.02em] text-slate-50">
                  {bad ? `No puedo leer .${bad} todavía` : 'No puedo leer ese formato todavía'}
                </div>
                <div className="mt-[5px] text-[12px] text-slate-400">
                  Exporta el cronograma como PDF y suéltalo de nuevo
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-end gap-4 text-slate-400">
                <Icon name="image-02" size={25} className="ch-drop-icon -rotate-[10deg]" />
                <Icon name="file-02" size={31} className="ch-drop-icon ch-drop-float" />
                <Icon name="folder-02" size={25} className="ch-drop-icon rotate-[10deg]" />
              </div>
              <div className="text-center">
                <div className="font-jakarta text-[15px] font-bold tracking-[-.02em] text-slate-50">
                  Suelta tu cronograma aquí
                </div>
                <div className="mt-[5px] text-[12px] text-slate-400">
                  PDF del banco · hasta {MAX_BYTES / 1024 / 1024} MB
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
