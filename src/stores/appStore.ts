import { create } from 'zustand';
import { FileItem, AppSettings, TaskResult, OutputFormat } from '../types';

interface AppStore {
  files: FileItem[];
  settings: AppSettings;
  isProcessing: boolean;
  activeTab: 'compress' | 'settings';

  addFiles: (files: FileItem[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  clearDone: () => void;
  updateResult: (id: string, result: Partial<TaskResult>) => void;
  setProcessing: (v: boolean) => void;
  setSettings: (s: AppSettings) => void;
  setActiveTab: (t: 'compress' | 'settings') => void;
  setFileFormat: (id: string, fmt: OutputFormat) => void;
}

const defaultSettings: AppSettings = {
  output_dir: null,
  output_suffix: '_tiny',
  overwrite_original: false,
  default_output_format: null,
  max_concurrent: 3,
  retry_count: 2,
};

export const useAppStore = create<AppStore>((set) => ({
  files: [],
  settings: defaultSettings,
  isProcessing: false,
  activeTab: 'compress',

  addFiles: (newFiles) =>
    set((state) => {
      const existingPaths = new Set(state.files.map((f) => f.file_path));
      const unique = newFiles.filter((f) => !existingPaths.has(f.file_path));
      return { files: [...state.files, ...unique] };
    }),

  removeFile: (id) =>
    set((state) => ({ files: state.files.filter((f) => f.id !== id) })),

  clearFiles: () => set({ files: [] }),

  clearDone: () =>
    set((state) => ({
      files: state.files.filter((f) => f.result?.status !== 'done'),
    })),

  updateResult: (id, partial) =>
    set((state) => ({
      files: state.files.map((f) => {
        if (f.id !== id) return f;
        const prev = f.result ?? {
          id,
          status: 'pending' as const,
          original_size: f.file_size,
        };
        return { ...f, result: { ...prev, ...partial } };
      }),
    })),

  setProcessing: (v) => set({ isProcessing: v }),
  setSettings: (s) => set({ settings: s }),
  setActiveTab: (t) => set({ activeTab: t }),

  setFileFormat: (id, fmt) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, output_format: fmt } : f
      ),
    })),
}));
