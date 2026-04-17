import React, { useState, useCallback } from 'react';

interface Props {
  onDrop: (paths: string[]) => void;
  onPick: () => void;
}

export default function DropZone({ onDrop, onPick }: Props) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const imagePaths: string[] = [];
    files.forEach((f) => {
      // In Tauri, we get the file path via the webkitRelativePath or file path
      const path = (f as any).path ?? f.name;
      if (/\.(png|jpe?g|webp|avif)$/i.test(f.name)) {
        imagePaths.push(path);
      }
    });
    if (imagePaths.length > 0) onDrop(imagePaths);
  }, [onDrop]);

  return (
    <div
      className={`dropzone ${dragOver ? 'dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onPick}
    >
      <div className="dropzone-inner">
        <div className="dropzone-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="32" fill="currentColor" opacity="0.08"/>
            <path d="M32 18v18M24 28l8-10 8 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 44h24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="dropzone-title">拖拽图片到这里</p>
        <p className="dropzone-sub">或者 <span className="link">点击选择文件</span></p>
        <p className="dropzone-hint">支持 PNG · JPEG · WebP · AVIF · 单张最大 5MB · 无数量限制</p>
      </div>
    </div>
  );
}
