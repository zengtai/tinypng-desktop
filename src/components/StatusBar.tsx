import React from 'react';
import { useAppStore } from '../stores/appStore';
import { formatBytes } from '../utils/format';
import { t } from '../i18n';

export default function StatusBar() {
  const { files, isProcessing, notification, compressionCount } = useAppStore();
  if (!files.length) return (
    <footer className="status-bar">
      <span className="status-hint">{t('status.hint')}</span>
    </footer>
  );

  const total = files.length;
  const allFmtsDone = (f: any) => [...f.formats].every((fmt: string) => f.results[fmt]?.status === 'done');
  const done = files.filter(allFmtsDone).length;
  const errors = files.filter(f => [...f.formats].some((fmt: string) => f.results[fmt]?.status === 'error')).length;
  const batches = Math.ceil(total / 20);

  const savedBytes = files.reduce((sum, f) => {
    return sum + [...f.formats].reduce((s, fmt) => {
      const r = f.results[fmt];
      return r?.status === 'done' ? s + f.file_size - (r.compressed_size || 0) : s;
    }, 0);
  }, 0);

  return (
    <footer className="status-bar">
      {notification ? (
        <div className="sb-notify">{notification}</div>
      ) : (
        <>
          <div className="sb-l">
            {isProcessing
              ? <span className="status-active">{t('status.processing', { done, total })}</span>
              : <span>{t('status.count', { n: total })}</span>}
            {batches > 1 && <span className="batch-tag">{t('status.batches', { n: batches })}</span>}
            {errors > 0 && <span className="status-error">{t('status.errors', { n: errors })}</span>}
          </div>
          {(done > 0 || compressionCount !== null) && (
            <div className="sb-r">
              {done > 0 && (
                <span className="status-saved">
                  {savedBytes >= 0
                    ? t('status.saved', { size: formatBytes(savedBytes) })
                    : t('status.increased', { size: formatBytes(Math.abs(savedBytes)) })
                  } ({t('status.doneOf', { done, total })})
                </span>
              )}
              {compressionCount !== null && (
                <span className="api-count">API: {compressionCount}/500</span>
              )}
            </div>
          )}
        </>
      )}
    </footer>
  );
}
