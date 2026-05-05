import React from 'react';
import { useAppStore, ALL_FMTS } from '../stores/appStore';
import { t } from '../i18n';

interface Props {
  onAdd: () => void;
  onCompress: () => void;
}

export default function TopBar({ onAdd, onCompress }: Props) {
  const { files, globalFormats, isProcessing, clearFiles, clearDone, setGlobalFormats, applyGlobalFormats, clearAllErrors } = useAppStore();

  const allFmtsDone = (f: any) => [...f.formats].every((fmt: string) => f.results[fmt]?.status === 'done');
  const done = files.filter(allFmtsDone).length;
  const pending = files.filter(f => !allFmtsDone(f)).length;
  const hasErrors = files.some(f => [...f.formats].some((fmt: string) => f.results[fmt]?.status === 'error'));

  const toggleFmt = (fmt: string) => {
    const next = new Set(globalFormats);
    if (fmt === 'all') {
      if (next.size === ALL_FMTS.length) {
        next.clear(); next.add('png');
      } else {
        ALL_FMTS.forEach(f => next.add(f));
      }
    } else {
      if (next.has(fmt)) { if (next.size > 1) next.delete(fmt); }
      else next.add(fmt);
    }
    setGlobalFormats(next);
  };

  return (
    <div className="toolbar">
      <button className="btn btn-ghost" onClick={onAdd} disabled={isProcessing}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        {t('top.add')}
      </button>

      <div className="fmt-bar">
        <span className="fmt-bar-label">{t('top.format')}</span>
        <div className="fmt-chips">
          {ALL_FMTS.map(fmt => (
            <span key={fmt} className={`fchip${globalFormats.has(fmt) ? ' on' : ''}`} onClick={() => toggleFmt(fmt)}>
              {fmt.toUpperCase()}
            </span>
          ))}
          <span className={`fchip${globalFormats.size === ALL_FMTS.length ? ' on' : ''}`} onClick={() => toggleFmt('all')}>ALL</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={applyGlobalFormats} disabled={isProcessing}>{t('top.applyAll')}</button>
      </div>

      <div className="toolbar-r">
        <span className="tally" dangerouslySetInnerHTML={{__html: t('top.tally', { n: files.length, done })}} />
        {done > 0 && !isProcessing && (
          <button className="btn btn-ghost btn-sm" onClick={clearDone}>{t('top.clearDone')}</button>
        )}
        {hasErrors && !isProcessing && (
          <button className="btn btn-ghost btn-sm" onClick={clearAllErrors}>{t('top.retryFailed')}</button>
        )}
        {!isProcessing && (
          <button className="btn btn-danger btn-sm" onClick={clearFiles}>{t('top.clearAll')}</button>
        )}
        <button className="btn btn-primary" onClick={onCompress} disabled={isProcessing || pending === 0}>
          {isProcessing ? (
            <><span className="spin" /> {t('top.processing')}</>
          ) : (
            <><svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> {t('top.start')} ({pending})</>
          )}
        </button>
      </div>
    </div>
  );
}
