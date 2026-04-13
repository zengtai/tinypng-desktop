import React from 'react';
import { useAppStore } from '../stores/appStore';
import { formatBytes } from '../utils/format';

export default function StatusBar() {
  const { files, isProcessing } = useAppStore();

  const total = files.length;
  const done = files.filter((f) => f.result?.status === 'done').length;
  const errors = files.filter((f) => f.result?.status === 'error').length;
  const processing = files.filter(
    (f) => f.result?.status === 'uploading' || f.result?.status === 'converting'
  ).length;

  const originalTotal = files.reduce((sum, f) => sum + f.file_size, 0);
  const compressedTotal = files.reduce(
    (sum, f) => sum + (f.result?.compressed_size ?? 0),
    0
  );
  const savedTotal = originalTotal - compressedTotal;

  const batchCount = Math.ceil(total / 20);

  if (total === 0) {
    return (
      <footer className="status-bar">
        <span className="status-hint">TinyPNG Desktop — 自动批量队列，无数量限制</span>
      </footer>
    );
  }

  return (
    <footer className="status-bar">
      <div className="status-left">
        {isProcessing ? (
          <span className="status-active">
            处理中 {processing}/{total}
            {batchCount > 1 && <span className="batch-tag">{batchCount} 批</span>}
          </span>
        ) : (
          <span>
            共 {total} 张
            {batchCount > 1 && <span className="batch-tag">将分 {batchCount} 批</span>}
          </span>
        )}
        {errors > 0 && (
          <span className="status-error">{errors} 失败</span>
        )}
      </div>
      {done > 0 && (
        <div className="status-right">
          <span className="status-saved">
            节省 {formatBytes(savedTotal)}
            {' '}
            ({done} / {total} 完成)
          </span>
        </div>
      )}
    </footer>
  );
}
