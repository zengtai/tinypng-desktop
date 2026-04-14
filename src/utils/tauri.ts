import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { AppSettings, CompressTask } from '../types';

export const tauriApi = {
  getSettings: () => invoke<AppSettings>('get_settings'),
  saveSettings: (settings: AppSettings) => invoke<void>('save_settings', { settings }),
  compressImages: (tasks: CompressTask[]) => invoke<void>('compress_images', { tasks }),
  openFolder: (path: string) => invoke<void>('open_folder', { path }),
};

export const pickDirectory = async (): Promise<string | null> => {
  const result = await open({ directory: true, multiple: false });
  return result as string | null;
};

export const pickImages = async (): Promise<string[] | null> => {
  const result = await open({
    multiple: true,
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'avif'] }],
  });
  if (!result) return null;
  return Array.isArray(result) ? result : [result];
};

export type FmtResult = {
  fmt: string;
  status: string;
  compressed_size?: number;
  saved_percent?: number;
  output_path?: string;
  error?: string;
};

export type FmtResultPayload = {
  task_id: string;
  result: FmtResult;
};

export const listenFmtResults = (
  cb: (payload: FmtResultPayload) => void
) => listen<FmtResultPayload>('fmt-result', (e) => cb(e.payload));

export const listenAllDone = (cb: () => void) =>
  listen('all-done', () => cb());
