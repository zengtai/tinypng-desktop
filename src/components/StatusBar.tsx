import React from 'react';
import { useAppStore } from '../stores/appStore';
import { formatBytes } from '../utils/format';

export default function StatusBar() {
  const { files, isProcessing, notification } = useAppStore();
  if (!files.length) return (
    <footer className="status-bar">
      <span className="status-hint">TinyPNG Desktop — 自动批量队列，无数量限制</span>
    </footer>
  );

  const total = files.length;
  const allFmtsDone = (f: any) => [...f.formats].every((fmt: string) => f.results[fmt]?.status === 'done');
  const done = files.filter(allFmtsDone).length;
  const errors = files.filter(f => [...f.formats].some((fmt: string) => f.results[fmt]?.status === 'error')).length;
  const batches = Math.ceil(total / 20);

  const savedBytes = files.reduce((sum, f) => {
    return sum + [...f.formats].reduce((s, fmt) => {
      const r = f.results[fmt];
      return r?.status === 'done' ? s + f.file_size - (r.compressed_size || 0) : s;
    }, 0);
  }, 0);

  return (
    <footer className="status-bar">
      {notification ? (
        <div className="sb-notify">{notification}</div>
      ) : (
        <>
          <div className="sb-l">
            {isProcessing
              ? <span className="status-active">处理中 {done}/{total}</span>
              : <span>{total} 张</span>}
            {batches > 1 && <span className="batch-tag">将分 {batches} 批</span>}
            {errors > 0 && <span className="status-error">{errors} 失败</span>}
          </div>
          {done > 0 && (
            <div className="sb-r">
              <span className="status-saved">节省 {formatBytes(savedBytes)} ({done}/{total} 完成)</span>
            </div>
          )}
        </>
      )}
    </footer>
  );
}
