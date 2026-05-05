import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { tauriApi, pickDirectory, persistSettings, clearPersistedSettings } from '../utils/tauri';
import { AppSettings } from '../types';
import { t } from '../i18n';

export default function SettingsPanel() {
  const { settings, setSettings } = useAppStore();
  const [local, setLocal] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLocal(settings); }, [settings]);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setLocal(s => ({ ...s, [key]: value }));

  const handleSave = async () => {
    await tauriApi.saveSettings(local);
    await persistSettings(local);
    setSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const defaultSettings: AppSettings = {
    output_dir: null,
    output_suffix: '_tiny',
    overwrite_original: false,
    fmt_folder: false,
    max_concurrent: 3,
    retry_count: 2,
    api_key: null,
    bg_color: '#ffffff',
    locale: 'zh',
  };

  const handlePickDir = async () => {
    const dir = await pickDirectory();
    if (dir) set('output_dir', dir);
  };

  const handleReset = async () => {
    setLocal(defaultSettings);
    await tauriApi.saveSettings(defaultSettings);
    await clearPersistedSettings();
    setSettings(defaultSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-panel">
      <div className="s-grid">
      <section className="s-section">
        <h3>{t('set.output')}</h3>
        <div className="s-row">
          <span className="s-label">{t('set.saveDir')}</span>
          <div className="s-ctrl">
            <span className="s-path">{local.output_dir || t('set.sameDirHint')}</span>
            <button className="btn btn-ghost btn-sm" onClick={handlePickDir}>{t('set.pick')}</button>
            {local.output_dir && (
              <button className="btn btn-ghost btn-sm text-danger" onClick={() => set('output_dir', null)}>{t('set.reset')}</button>
            )}
          </div>
        </div>
        <div className="s-row" style={{alignItems:'flex-start',paddingTop:10,paddingBottom:10}}>
          <span className="s-label" style={{paddingTop:6}}>{t('set.suffix')}</span>
          <div className="s-ctrl" style={{flexDirection:'column',alignItems:'flex-start',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <input id="suffix-el" className="s-input" value={local.output_suffix} disabled={local.overwrite_original}
                onChange={e => set('output_suffix', e.target.value)} />
              {([[t('set.suffixW'),'{w}'],[t('set.suffixH'),'{h}']]).map(([label, token]) => (
                <button key={label} className="btn btn-ghost btn-sm" disabled={local.overwrite_original}
                  onClick={() => {
                    const el = document.getElementById('suffix-el') as HTMLInputElement;
                    const start = el?.selectionStart ?? local.output_suffix.length;
                    const end = el?.selectionEnd ?? start;
                    const val = local.output_suffix.slice(0, start) + token + local.output_suffix.slice(end);
                    set('output_suffix', val);
                    setTimeout(() => { el?.focus(); el?.setSelectionRange(start+3, start+3); }, 0);
                  }}>{label}</button>
              ))}
            </div>
            <span className="s-hint">
              {local.output_suffix
                ? <>image.png → image{local.output_suffix}.png</>
                : <>{t('set.suffixEmpty')}</>}
            </span>
            {!local.output_suffix && !local.overwrite_original && !local.output_dir && (
              <span className="s-warn">{t('set.suffixWarn')}</span>
            )}
          </div>
        </div>
        <div className="s-row">
          <span className="s-label">{t('set.overwrite')}</span>
          <label className="toggle">
            <input type="checkbox" checked={local.overwrite_original}
              onChange={e => set('overwrite_original', e.target.checked)} />
            <span className="track" />
          </label>
        </div>
        <div className="s-row">
          <span className="s-label">{t('set.fmtFolder')}</span>
          <div className="s-ctrl">
            <label className="toggle">
              <input type="checkbox" checked={local.fmt_folder}
                onChange={e => set('fmt_folder', e.target.checked)} />
              <span className="track" />
            </label>
            <span className="s-hint">{t('set.fmtFolderHint')}</span>
          </div>
        </div>
      </section>

      <section className="s-section">
        <h3>{t('set.queue')}</h3>
        <div className="s-row">
          <span className="s-label">{t('set.concurrent')}</span>
          <div className="s-ctrl">
            <input type="range" className="slider" min={1} max={5} value={local.max_concurrent}
              onChange={e => set('max_concurrent', Number(e.target.value))} />
            <span className="sv">{local.max_concurrent}</span>
            <span className="s-hint">{t('set.concurrentHint')}</span>
          </div>
        </div>
        <div className="s-row">
          <span className="s-label">{t('set.retry')}</span>
          <select className="s-select" value={local.retry_count}
            onChange={e => set('retry_count', Number(e.target.value))}>
            {[0,1,2,3].map(n => <option key={n} value={n}>{t('set.retryUnit', { n })}</option>)}
          </select>
        </div>
        <div className="info-box">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7v4M8 5.2v.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          {t('set.batchInfo')}
        </div>
      </section>

      </div>

      <section className="s-section s-section-full">
        <h3>{t('set.api')}</h3>
        <div className="s-row">
          <span className="s-label">{t('set.apiKey')}</span>
          <div className="s-ctrl">
            <input className="s-input" style={{width:'100%',fontFamily:'"DM Mono",monospace',fontSize:11}}
              type="password"
              value={local.api_key || ''}
              onChange={e => set('api_key', e.target.value || null)}
              placeholder={t('set.apiPlaceholder')} />
            {local.api_key && (
              <button className="btn btn-ghost btn-sm" onClick={() => set('api_key', null)} title={t('set.apiClear')}
                style={{padding:'2px 6px',fontSize:14,lineHeight:1,color:'var(--text3)'}}>×</button>
            )}
          </div>
        </div>
        <div className="s-hint" style={{padding:'2px 0 0'}}>
          {t('set.apiDesc')}<a style={{color:'var(--accent)',cursor:'pointer'}} onClick={() => tauriApi.openUrl('https://tinypng.com/developers')}>{t('set.apiLink')}</a>{t('set.apiQuota')}
        </div>
        {local.api_key && (
          <div className="s-row" style={{marginTop:6}}>
            <span className="s-label">{t('set.bgColor')}</span>
            <div className="s-ctrl">
              <input type="color" value={local.bg_color || '#ffffff'}
                onChange={e => set('bg_color', e.target.value)}
                style={{width:28,height:22,padding:0,border:'1px solid var(--border2)',borderRadius:4,cursor:'pointer'}} />
              <input className="s-input" value={local.bg_color || '#ffffff'}
                onChange={e => set('bg_color', e.target.value)}
                style={{width:80,fontFamily:'"DM Mono",monospace',fontSize:11}} />
              <span className="s-hint">{t('set.bgHint')}</span>
            </div>
          </div>
        )}
      </section>

      <div className="s-footer">
        <button className="btn btn-primary" onClick={handleSave}>{t('set.save')}</button>
        <button className="btn btn-ghost" onClick={handleReset}>{t('set.restoreDefault')}</button>
        {saved && <span className="save-ok">{t('set.saved')}</span>}
      </div>

    </div>
  );
}
