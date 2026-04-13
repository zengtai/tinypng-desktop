import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { AppSettings, CompressTask, TaskResult } from '../types';

export const tauriApi = {
  getSettings: () => invoke<AppSettings>('get_settings'),
  saveSettings: (settings: AppSettings) => invoke<void>('save_settings', { settings }),
  compressImages: (tasks: CompressTask[]) => invoke<void>('compress_images', { tasks }),
  cancelTasks: () => invoke<void>('cancel_tasks'),
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

export type TaskUpdatePayload = {
  id: string;
  status: string;
  compressed_size?: number;
  saved_percent?: number;
  output_path?: string;
  error?: string;
};

export const listenTaskUpdates = (
  cb: (payload: TaskUpdatePayload) => void
) => listen<TaskUpdatePayload>('task-update', (e) => cb(e.payload));

export const listenAllDone = (cb: () => void) =>
  listen('all-done', () => cb());
