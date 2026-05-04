export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes === 0) return '0 B';
  const abs = Math.abs(bytes);
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(abs) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  const val = parseFloat((abs / Math.pow(k, idx)).toFixed(1));
  return (bytes < 0 ? '-' : '') + val + ' ' + sizes[idx];
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
