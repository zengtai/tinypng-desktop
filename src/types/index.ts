export type OutputFormat = 'webp' | 'avif' | 'png' | 'jpeg' | null;

export type TaskStatus =
  | 'pending'
  | 'uploading'
  | 'converting'
  | 'done'
  | 'error';

export interface CompressTask {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  output_format?: OutputFormat;
  output_dir?: string;
  suffix?: string;
}

export interface TaskResult {
  id: string;
  status: TaskStatus;
  original_size: number;
  compressed_size?: number;
  saved_percent?: number;
  output_path?: string;
  error?: string;
  output_format?: string;
}

export interface FileItem extends CompressTask {
  preview?: string;
  result?: TaskResult;
}

export interface AppSettings {
  output_dir: string | null;
  output_suffix: string;
  overwrite_original: boolean;
  default_output_format: OutputFormat;
  max_concurrent: number;
  retry_count: number;
}
