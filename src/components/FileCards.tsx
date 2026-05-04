import React, { useCallback, useState } from 'react';
import { useAppStore, ALL_FMTS } from '../stores/appStore';
import { formatBytes } from '../utils/format';
import { tauriApi } from '../utils/tauri';
import { FileItem } from '../types';

interface Props { onDrop: (paths: string[]) => void; }

function FmtTile({ f, fmt }: { f: FileItem; fmt: string }) {
  const r = f.results[fmt];
  const status = r?.status || 'pending';
  const { clearFmtResult, isProcessing } = useAppStore();
  const [showErr, setShowErr] = useState(false);

  const handleClick = () => {
    if (status === 'done' && r?.output_path) tauriApi.openFolder(r.output_path);
    if (status === 'error') setShowErr(v => !v);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearFmtResult(f.id, fmt);
  };

  if (status === 'uploading' || status === 'processing') {
    return (
      <div className="fmt-tile loading">
        <div className="tile-fmt">{fmt.toUpperCase()}</div>
        <div className="tile-spin"><span className="spin" /></div>
      </div>
    );
  }
  if (status === 'done') {
    return (
      <div className="fmt-tile done" onClick={handleClick} title="点击在文件夹中显示">
        <div className="tile-check">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <div className="tile-fmt">{fmt.toUpperCase()}</div>
        <div className="tile-pct">-{Math.round(r!.saved_percent || 0)}%</div>
        <div className="tile-size">{formatBytes(r!.compressed_size || 0)}</div>
      </div>
    );
  }
  if (status === 'error') {
    const errMsg = r?.error || '未知错误';
    const shortErr = errMsg.length > 20 ? errMsg.slice(0, 20) + '…' : errMsg;
    // Permanent errors that retrying won't fix
    const permanent = errMsg.includes('透明通道') || errMsg.includes('输出路径与原文件');
    return (
      <div className="fmt-tile error-tile" onClick={handleClick} style={{cursor:'pointer'}}>
        <div className="tile-fmt">{fmt.toUpperCase()}</div>
        <div className="tile-err" title={errMsg}>{showErr || permanent ? shortErr : '失败'}</div>
        {!isProcessing && !permanent && (
          <button className="tile-retry" onClick={handleRetry} title="重试">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v4h4"/><path d="M15 12v-4h-4"/><path d="M13.5 6A6 6 0 0 0 3 5.5L1 8M2.5 10A6 6 0 0 0 13 10.5L15 8"/>
            </svg>
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="fmt-tile">
      <div className="tile-fmt">{fmt.toUpperCase()}</div>
      <div className="tile-pending">待处理</div>
    </div>
  );
}

function FileCard({ f }: { f: FileItem }) {
  const { removeFile, toggleFileFmt, isProcessing } = useAppStore();
  const fmts = [...f.formats];
  const anyBusy = fmts.some(fmt => ['uploading','processing'].includes(f.results[fmt]?.status || ''));
  const allDone = fmts.every(fmt => f.results[fmt]?.status === 'done');
  const anyDone = fmts.some(fmt => f.results[fmt]?.status === 'done');

  const ext = f.file_name.split('.').pop()?.toLowerCase() || '';
  const colors: Record<string, string> = { png:'#7B61FF', jpg:'#ff6b2b', jpeg:'#ff6b2b', webp:'#2ecc8f', avif:'#f5b731' };
  const color = colors[ext] || '#7b8299';

  let statusBadge = null;
  if (anyBusy) statusBadge = <span className="badge bd-busy"><span className="spin" /> 处理中</span>;
  else if (allDone) statusBadge = <span className="badge bd-done">✓ 完成</span>;
  else if (!anyDone) statusBadge = <span className="badge bd-pending">待处理</span>;

  return (
    <div className={`file-card${allDone ? ' st-done' : anyBusy ? ' st-busy' : ''}`}>
      <div className="card-head">
        <div className="card-ext" style={{ background: color+'18', color }}>{ext.toUpperCase().slice(0,4)}</div>
        <div className="card-info">
          <div className="card-name" title={f.file_path}>{f.file_name}</div>
          <div className="card-meta">
            <span className="card-orig-size">{formatBytes(f.file_size)}</span>
            <span className="card-orig-type">{ext.toUpperCase()}</span>
          </div>
        </div>
        <div className="card-status">{statusBadge}</div>
        <button className="card-rm" onClick={() => removeFile(f.id)} disabled={anyBusy}>×</button>
      </div>
      <div className="card-body">
        <div className="card-fmts">
          {ALL_FMTS.map(fmt => (
            <span
              key={fmt}
              className={`card-fchip${f.formats.has(fmt) ? ' on' : ''}${(isProcessing || anyBusy) ? ' disabled' : ''}`}
              onClick={() => { if (!isProcessing && !anyBusy) toggleFileFmt(f.id, fmt); }}
            >
              {fmt.toUpperCase()}
            </span>
          ))}
        </div>
        <div className="card-tiles">{fmts.map(fmt => <FmtTile key={fmt} f={f} fmt={fmt} />)}</div>
      </div>
    </div>
  );
}

export default function FileCards({ onDrop }: Props) {
  const { files } = useAppStore();
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const paths: string[] = [];
    Array.from(e.dataTransfer.files).forEach(f => {
      const path = (f as any).path ?? f.name;
      if (/\.(png|jpe?g|webp|avif)$/i.test(f.name)) paths.push(path);
    });
    if (paths.length) onDrop(paths);
  }, [onDrop]);

  return (
    <div
      className={`file-cards-wrap${dragOver ? ' over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="file-cards">
        {files.map(f => <FileCard key={f.id} f={f} />)}
      </div>
      {dragOver && <div className="drag-overlay">松开以添加图片</div>}
    </div>
  );
}
