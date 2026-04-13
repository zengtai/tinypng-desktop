import React, { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from './stores/appStore';
import { tauriApi, listenTaskUpdates, listenAllDone, pickImages } from './utils/tauri';
import { CompressTask, FileItem } from './types';
import { v4 as uuidv4 } from './utils/uuid';
import DropZone from './components/DropZone';
import FileList from './components/FileList';
import Toolbar from './components/Toolbar';
import SettingsPanel from './components/SettingsPanel';
import StatusBar from './components/StatusBar';
import './App.css';

export default function App() {
  const {
    files, settings, isProcessing, activeTab,
    addFiles, setProcessing, updateResult, setSettings, setActiveTab,
  } = useAppStore();

  // Load settings on mount
  useEffect(() => {
    tauriApi.getSettings().then(setSettings).catch(console.error);
  }, []);

  // Listen for task updates from backend
  useEffect(() => {
    const unsub1 = listenTaskUpdates((payload) => {
      updateResult(payload.id, {
        id: payload.id,
        status: payload.status as any,
        compressed_size: payload.compressed_size,
        saved_percent: payload.saved_percent,
        output_path: payload.output_path,
        error: payload.error,
      });
    });
    const unsub2 = listenAllDone(() => {
      setProcessing(false);
    });
    return () => {
      unsub1.then((fn) => fn());
      unsub2.then((fn) => fn());
    };
  }, []);

  const handleDropFiles = useCallback(async (paths: string[]) => {
    const items: FileItem[] = await Promise.all(
      paths.map(async (p) => {
        let size = 0;
        try {
          const { stat } = await import('@tauri-apps/plugin-fs');
          const info = await stat(p);
          size = info.size ?? 0;
        } catch {}
        const name = p.split('/').pop() ?? p.split('\\').pop() ?? p;
        return {
          id: uuidv4(),
          file_path: p,
          file_name: name,
          file_size: size,
          output_format: settings.default_output_format,
        };
      })
    );
    addFiles(items);
  }, [settings.default_output_format]);

  const handlePickFiles = useCallback(async () => {
    const paths = await pickImages();
    if (paths) handleDropFiles(paths);
  }, [handleDropFiles]);

  const handleCompress = useCallback(async () => {
    const pending = files.filter(
      (f) => !f.result || f.result.status === 'error' || f.result.status === 'pending'
    );
    if (pending.length === 0) return;

    setProcessing(true);

    const tasks: CompressTask[] = pending.map((f) => ({
      id: f.id,
      file_path: f.file_path,
      file_name: f.file_name,
      file_size: f.file_size,
      output_format: f.output_format ?? settings.default_output_format,
      output_dir: settings.output_dir ?? undefined,
      suffix: settings.output_suffix,
    }));

    try {
      await tauriApi.compressImages(tasks);
    } catch (e) {
      console.error(e);
      setProcessing(false);
    }
  }, [files, settings]);

  const isEmpty = files.length === 0;

  return (
    <div className="app" data-tab={activeTab}>
      <header className="app-header">
        <div className="logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="#FF6B35"/>
            <path d="M8 20L14 8L20 20H8Z" fill="white" opacity="0.9"/>
            <circle cx="14" cy="15" r="3" fill="#FF6B35"/>
          </svg>
          <span>TinyPNG Desktop</span>
        </div>
        <nav className="tab-nav">
          <button
            className={activeTab === 'compress' ? 'active' : ''}
            onClick={() => setActiveTab('compress')}
          >
            压缩
          </button>
          <button
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            设置
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'compress' ? (
          <>
            {isEmpty ? (
              <DropZone onDrop={handleDropFiles} onPick={handlePickFiles} />
            ) : (
              <>
                <Toolbar
                  onAdd={handlePickFiles}
                  onCompress={handleCompress}
                  isProcessing={isProcessing}
                />
                <FileList onDrop={handleDropFiles} />
              </>
            )}
          </>
        ) : (
          <SettingsPanel />
        )}
      </main>

      <StatusBar />
    </div>
  );
}
