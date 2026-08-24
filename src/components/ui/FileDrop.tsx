'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface FileDropProps {
  onFile: (file: File) => void;
  accept?: string;
  label?: string;
  multiple?: boolean;
  maxSize?: number; // bytes
  className?: string;
  disabled?: boolean;
}

export const FileDrop = ({ onFile, accept, label, multiple, maxSize = 10 * 1024 * 1024, className, disabled }: FileDropProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    processFiles(files);
    e.target.value = '';
  };

  const processFiles = (files: File[]) => {
    setError(null);
    const validFiles = files.filter((file) => {
      if (maxSize && file.size > maxSize) {
        setError(`File "${file.name}" exceeds maximum size of ${formatBytes(maxSize)}`);
        return false;
      }
      return true;
    });

    if (multiple) {
      validFiles.forEach(onFile);
    } else if (validFiles.length > 0) {
      onFile(validFiles[0]);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="sr-only"
        disabled={disabled}
        aria-label="File upload"
      />

      <button
        type="button"
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={disabled}
        className={cn(
          'w-full border-2 border-dashed rounded-md p-8 text-center transition-colors',
          'bg-paper border-line hover:border-accent/50',
          dragActive && 'bg-accent/5 border-accent',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <svg className="w-10 h-10 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <div>
            <p className="font-medium text-ink">{label || 'Drag & drop files here, or click to select'}</p>
            <p className="text-sm text-muted">
              {accept ? `Accepted: ${accept}` : 'Any file type'}
              {maxSize && ` • Max size: ${formatBytes(maxSize)}`}
            </p>
          </div>
        </div>
      </button>

      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
};

FileDrop.displayName = 'FileDrop';