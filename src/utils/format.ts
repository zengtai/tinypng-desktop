export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const formatPercent = (pct: number): string =>
  `${Math.round(pct)}%`;

export const getExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

export const formatLabel: Record<string, string> = {
  webp: 'WebP',
  avif: 'AVIF',
  png: 'PNG',
  jpeg: 'JPEG',
};
