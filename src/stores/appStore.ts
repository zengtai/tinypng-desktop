import { create } from 'zustand';
import { FileItem, AppSettings, FmtResult } from '../types';

const ALL_FMTS = ['avif', 'jxl', 'webp', 'jpeg', 'png'];

interface AppStore {
  files: FileItem[];
  globalFormats: Set<string>;
  settings: AppSettings;
  isProcessing: boolean;
  activeTab: 'compress' | 'settings';

  addFiles: (files: FileItem[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  clearDone: () => void;
  updateFmtResult: (taskId: string, fmt: string, result: FmtResult) => void;
  setProcessing: (v: boolean) => void;
  setSettings: (s: AppSettings) => void;
  setActiveTab: (t: 'compress' | 'settings') => void;
  setGlobalFormats: (fmts: Set<string>) => void;
  applyGlobalFormats: () => void;
  toggleFileFmt: (id: string, fmt: string) => void;
  clearFmtResult: (id: string, fmt: string) => void;
  notification: string | null;
  setNotification: (msg: string | null) => void;
}

const defaultSettings: AppSettings = {
  output_dir: null,
  output_suffix: '_tiny',
  overwrite_original: false,
  fmt_folder: false,
  max_concurrent: 3,
  retry_count: 2,
};

export const useAppStore = create<AppStore>((set, get) => ({
  files: [],
  globalFormats: new Set(['webp', 'jpeg', 'png']),
  settings: defaultSettings,
  isProcessing: false,
  activeTab: 'compress',
  notification: null,

  addFiles: (newFiles) =>
    set((state) => {
      const existing = new Set(state.files.map(f => f.file_path));
      const unique = newFiles.filter(f => !existing.has(f.file_path));
      return { files: [...state.files, ...unique] };
    }),

  removeFile: (id) =>
    set((state) => ({ files: state.files.filter(f => f.id !== id) })),

  clearFiles: () => set({ files: [] }),

  clearDone: () =>
    set((state) => ({
      files: state.files.filter(f => {
        const fmts = [...f.formats];
        return !fmts.every(fmt => f.results[fmt]?.status === 'done');
      }),
    })),

  updateFmtResult: (taskId, fmt, result) =>
    set((state) => ({
      files: state.files.map(f => {
        if (f.id !== taskId) return f;
        return { ...f, results: { ...f.results, [fmt]: result } };
      }),
    })),

  setProcessing: (v) => set({ isProcessing: v }),
  setSettings: (s) => set({ settings: s }),
  setActiveTab: (t) => set({ activeTab: t }),

  setGlobalFormats: (fmts) => set({ globalFormats: fmts }),

  applyGlobalFormats: () =>
    set((state) => ({
      files: state.files.map(f => {
        const allDone = [...f.formats].every(fmt => f.results[fmt]?.status === 'done');
        if (allDone) return f;
        return { ...f, formats: new Set(state.globalFormats) };
      }),
    })),

  clearFmtResult: (id, fmt) =>
    set((state) => ({
      files: state.files.map(f => {
        if (f.id !== id) return f;
        const results = { ...f.results };
        delete results[fmt];
        return { ...f, results };
      }),
    })),

  setNotification: (msg) => {
    set({ notification: msg });
    if (msg) setTimeout(() => set({ notification: null }), 4000);
  },

  toggleFileFmt: (id, fmt) =>
    set((state) => ({
      files: state.files.map(f => {
        if (f.id !== id) return f;
        const fmts = new Set(f.formats);
        if (fmts.has(fmt)) {
          if (fmts.size > 1) fmts.delete(fmt);
        } else {
          fmts.add(fmt);
        }
        return { ...f, formats: fmts };
      }),
    })),
}));

export { ALL_FMTS };
