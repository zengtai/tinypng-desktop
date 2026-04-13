import React from 'react';
import { useAppStore } from '../stores/appStore';
import { tauriApi } from '../utils/tauri';

interface Props {
  onAdd: () => void;
  onCompress: () => void;
  isProcessing: boolean;
}

export default function Toolbar({ onAdd, onCompress, isProcessing }: Props) {
  const { files, clearFiles, clearDone } = useAppStore();

  const pending = files.filter(
    (f) => !f.result || f.result.status === 'error' || f.result.status === 'pending'
  ).length;
  const done = files.filter((f) => f.result?.status === 'done').length;

  const handleCancel = async () => {
    await tauriApi.cancelTasks();
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="btn btn-ghost" onClick={onAdd} disabled={isProcessing}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          添加图片
        </button>
        {done > 0 && (
          <button className="btn btn-ghost" onClick={clearDone} disabled={isProcessing}>
            清除已完成
          </button>
        )}
        {files.length > 0 && !isProcessing && (
          <button className="btn btn-ghost text-danger" onClick={clearFiles}>
            清除全部
          </button>
        )}
      </div>
      <div className="toolbar-right">
        <span className="counter">
          {files.length} 张 · {pending} 待处理 · {done} 完成
        </span>
        {isProcessing ? (
          <button className="btn btn-danger" onClick={handleCancel}>
            取消
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={onCompress}
            disabled={pending === 0}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            开始压缩 {pending > 0 ? `(${pending})` : ''}
          </button>
        )}
      </div>
    </div>
  );
}
