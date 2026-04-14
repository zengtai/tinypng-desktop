import React, { useEffect, useCallback } from 'react';
import { useAppStore } from './stores/appStore';
import { tauriApi, listenFmtResults, listenAllDone, pickImages } from './utils/tauri';
import { CompressTask, FileItem } from './types';
import { v4 as uuidv4 } from './utils/uuid';
import DropZone from './components/DropZone';
import FileCards from './components/FileCards';
import TopBar from './components/TopBar';
import SettingsPanel from './components/SettingsPanel';
import StatusBar from './components/StatusBar';
import './App.css';

export default function App() {
  const {
    files, settings, isProcessing, activeTab,
    addFiles, setProcessing, updateFmtResult, setSettings, setActiveTab,
  } = useAppStore();

  useEffect(() => {
    tauriApi.getSettings().then(setSettings).catch(console.error);
  }, []);

  // Listen for compression results from Rust backend
  useEffect(() => {
    const unsub1 = listenFmtResults((payload) => {
      updateFmtResult(payload.task_id, payload.result.fmt, payload.result);
    });
    const unsub2 = listenAllDone(() => setProcessing(false));
    return () => {
      unsub1.then(fn => fn());
      unsub2.then(fn => fn());
    };
  }, []);

  // Listen for OS-level file drag-drop via Tauri's native API
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('tauri://drag-drop', (event: any) => {
        const paths: string[] = event.payload?.paths ?? [];
        const images = paths.filter(p => /\.(png|jpe?g|webp|avif)$/i.test(p));
        if (images.length > 0) handleDropFiles(images);
      }).then(fn => { unlisten = fn; });
    });
    return () => { if (unlisten) unlisten(); };
  }, []);

  const handleDropFiles = useCallback(async (paths: string[]) => {
    const { stat } = await import('@tauri-apps/plugin-fs');
    const items: FileItem[] = await Promise.all(
      paths.map(async (p) => {
        let size = 0;
        try { const info = await stat(p); size = info.size ?? 0; } catch {}
        const name = p.replace(/\\/g, '/').split('/').pop() ?? p;
        return {
          id: uuidv4(),
          file_path: p,
          file_name: name,
          file_size: size,
          formats: new Set(useAppStore.getState().globalFormats),
          results: {},
        };
      })
    );
    addFiles(items);
  }, []);

  const handlePickFiles = useCallback(async () => {
    const paths = await pickImages();
    if (paths) handleDropFiles(paths);
  }, [handleDropFiles]);

  const handleCompress = useCallback(async () => {
    const pending = files.filter(f => {
      const fmts = [...f.formats];
      return fmts.some(fmt => !f.results[fmt] || f.results[fmt].status === 'error');
    });
    if (!pending.length || isProcessing) return;

    setProcessing(true);

    const tasks: CompressTask[] = pending.map(f => ({
      id: f.id,
      file_path: f.file_path,
      file_name: f.file_name,
      file_size: f.file_size,
      formats: [...f.formats],
      output_dir: settings.output_dir ?? undefined,
      suffix: settings.output_suffix,
      overwrite: settings.overwrite_original,
      fmt_folder: settings.fmt_folder,
    }));

    try {
      await tauriApi.compressImages(tasks);
    } catch (e) {
      console.error(e);
      setProcessing(false);
    }
  }, [files, settings, isProcessing]);

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
          <button className={activeTab === 'compress' ? 'active' : ''} onClick={() => setActiveTab('compress')}>压缩</button>
          <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>设置</button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'compress' ? (
          <>
            {isEmpty ? (
              <DropZone onDrop={handleDropFiles} onPick={handlePickFiles} />
            ) : (
              <>
                <TopBar onAdd={handlePickFiles} onCompress={handleCompress} />
                <FileCards onDrop={handleDropFiles} />
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
