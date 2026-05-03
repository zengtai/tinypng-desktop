export type OutputFormat = 'webp' | 'avif' | 'png' | 'jpeg' | 'jxl';

export type FmtStatus = 'pending' | 'uploading' | 'processing' | 'done' | 'error';

export interface FmtResult {
  fmt: string;
  status: FmtStatus;
  compressed_size?: number;
  saved_percent?: number;
  output_path?: string;
  error?: string;
}

export interface CompressTask {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  formats: string[];         // ["webp", "png", "avif"]
  output_dir?: string;
  suffix: string;
  overwrite: boolean;
  fmt_folder: boolean;
}

export interface FileItem {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  formats: Set<string>;
  results: Record<string, FmtResult>;
}

export interface AppSettings {
  output_dir: string | null;
  output_suffix: string;
  overwrite_original: boolean;
  fmt_folder: boolean;
  max_concurrent: number;
  retry_count: number;
  api_key?: string | null;
}
