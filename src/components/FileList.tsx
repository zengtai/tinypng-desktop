import React, { useCallback, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { formatBytes, formatPercent, formatLabel } from '../utils/format';
import { tauriApi } from '../utils/tauri';
import { OutputFormat, FileItem } from '../types';

interface Props {
  onDrop: (paths: string[]) => void;
}

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: null, label: '保持原格式' },
  { value: 'webp', label: 'WebP' },
  { value: 'avif', label: 'AVIF' },
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
];

function FileRow({ file }: { file: FileItem }) {
  const { removeFile, setFileFormat, isProcessing } = useAppStore();
  const result = file.result;
  const status = result?.status ?? 'pending';

  const handleOpenFolder = () => {
    if (result?.output_path) tauriApi.openFolder(result.output_path);
  };

  return (
    <div className={`file-row status-${status}`}>
      <div className="file-icon">
        <FileTypeIcon name={file.file_name} />
      </div>

      <div className="file-info">
        <span className="file-name" title={file.file_path}>{file.file_name}</span>
        <span className="file-meta">
          {formatBytes(file.file_size)}
          {result?.compressed_size != null && (
            <> → <strong>{formatBytes(result.compressed_size)}</strong></>
          )}
          {result?.saved_percent != null && (
            <span className="saved-badge">-{formatPercent(result.saved_percent)}</span>
          )}
        </span>
        {result?.error && (
          <span className="file-error" title={result.error}>
            ⚠ {result.error}
          </span>
        )}
      </div>

      <div className="file-format">
        <select
          value={file.output_format ?? ''}
          onChange={(e) => setFileFormat(file.id, (e.target.value || null) as OutputFormat)}
          disabled={isProcessing || status === 'done'}
        >
          {FORMAT_OPTIONS.map((o) => (
            <option key={String(o.value)} value={o.value ?? ''}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="file-status">
        {status === 'pending' && <span className="badge pending">待处理</span>}
        {status === 'uploading' && <Spinner label="上传中" />}
        {status === 'converting' && <Spinner label="转换中" />}
        {status === 'done' && (
          <button className="badge done clickable" onClick={handleOpenFolder} title="在文件夹中显示">
            ✓ 完成
          </button>
        )}
        {status === 'error' && <span className="badge error">失败</span>}
      </div>

      <button
        className="file-remove"
        onClick={() => removeFile(file.id)}
        disabled={isProcessing && (status === 'uploading' || status === 'converting')}
        title="移除"
      >
        ×
      </button>
    </div>
  );
}

function FileTypeIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const colors: Record<string, string> = {
    png: '#7B61FF', jpg: '#FF6B35', jpeg: '#FF6B35',
    webp: '#00C48C', avif: '#FFB800',
  };
  const color = colors[ext] ?? '#999';
  return (
    <div className="type-icon" style={{ background: color + '22', color }}>
      {ext.toUpperCase().slice(0, 4)}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="badge processing">
      <span className="spin" />
      {label}
    </span>
  );
}

export default function FileList({ onDrop }: Props) {
  const { files } = useAppStore();
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const paths: string[] = [];
    Array.from(e.dataTransfer.files).forEach((f) => {
      const path = (f as any).path ?? f.name;
      if (/\.(png|jpe?g|webp|avif)$/i.test(f.name)) paths.push(path);
    });
    if (paths.length > 0) onDrop(paths);
  }, [onDrop]);

  return (
    <div
      className={`file-list ${dragOver ? 'dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="file-list-header">
        <span>文件</span>
        <span style={{ marginLeft: 'auto', marginRight: '140px' }}>输出格式</span>
        <span>状态</span>
      </div>
      <div className="file-list-body">
        {files.map((f) => <FileRow key={f.id} file={f} />)}
      </div>
      {dragOver && (
        <div className="drop-overlay">松开以添加图片</div>
      )}
    </div>
  );
}
