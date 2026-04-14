import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { AppSettings, CompressTask, FmtResult } from '../types';

export const tauriApi = {
  getSettings: () => invoke<AppSettings>('get_settings'),
  saveSettings: (settings: AppSettings) => invoke<void>('save_settings', { settings }),
  compressImages: (tasks: CompressTask[]) => invoke<void>('compress_images', { tasks }),
  openFolder: (path: string) => invoke<void>('open_folder', { path }),
};

// Persistent settings — saved alongside the executable (portable-friendly)
// Path resolved by Rust command: get_config_path -> <exe_dir>/settings.json

export async function loadPersistedSettings(): Promise<Partial<AppSettings>> {
  try {
    const path = await invoke<string>('get_config_path');
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const text = await readTextFile(path);
    return JSON.parse(text) as Partial<AppSettings>;
  } catch {
    return {};
  }
}

export async function persistSettings(settings: AppSettings): Promise<void> {
  try {
    const path = await invoke<string>('get_config_path');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(path, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Failed to persist settings:', e);
  }
}

export async function clearPersistedSettings(): Promise<void> {
  try {
    const path = await invoke<string>('get_config_path');
    const { remove } = await import('@tauri-apps/plugin-fs');
    await remove(path);
  } catch {
    // File may not exist, ignore
  }
}

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

export type FmtResultPayload = {
  task_id: string;
  result: FmtResult;
};

export const listenFmtResults = (
  cb: (payload: FmtResultPayload) => void
) => listen<FmtResultPayload>('fmt-result', (e) => cb(e.payload));

export const listenAllDone = (cb: () => void) =>
  listen('all-done', () => cb());
