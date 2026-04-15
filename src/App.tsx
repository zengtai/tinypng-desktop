import React, { useEffect, useCallback, useState } from 'react';
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

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    // Load from Rust state first, then merge persisted settings from disk
    tauriApi.getSettings().then(async (rustSettings) => {
      const { loadPersistedSettings } = await import('./utils/tauri');
      const persisted = await loadPersistedSettings();
      const merged = { ...rustSettings, ...persisted };
      setSettings(merged);
      if (Object.keys(persisted).length > 0) {
        tauriApi.saveSettings(merged).catch(console.error);
      }
    }).catch(console.error);
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
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <nav className="tab-nav">
            <button className={activeTab === 'compress' ? 'active' : ''} onClick={() => setActiveTab('compress')}>压缩</button>
            <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>设置</button>
          </nav>
          <button className="theme-btn" onClick={toggleTheme} title={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}>
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
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
