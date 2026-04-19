import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { tauriApi, pickDirectory, persistSettings, clearPersistedSettings } from '../utils/tauri';
import { AppSettings } from '../types';

export default function SettingsPanel() {
  const { settings, setSettings } = useAppStore();
  const [local, setLocal] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLocal(settings); }, [settings]);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setLocal(s => ({ ...s, [key]: value }));

  const handleSave = async () => {
    await tauriApi.saveSettings(local);
    await persistSettings(local);   // ← write to disk
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
      <div className="s-header">
        <h2>设置</h2>
        <div className="s-header-right">
          <span className="s-version-num">v0.1.0</span>
          <span className="s-author-link" title="zengtai.net" onClick={() => tauriApi.openUrl('https://zengtai.net/')}>
            <img src={new URL('../assets/logo.png', import.meta.url).href} alt="" width="16" height="16" />
          </span>
        </div>
      </div>
      <div className="s-grid">
      <section className="s-section">
        <h3>输出</h3>
        <div className="s-row">
          <span className="s-label">保存位置</span>
          <div className="s-ctrl">
            <span className="s-path">{local.output_dir || '与原图相同目录'}</span>
            <button className="btn btn-ghost btn-sm" onClick={handlePickDir}>选择</button>
            {local.output_dir && (
              <button className="btn btn-ghost btn-sm text-danger" onClick={() => set('output_dir', null)}>重置</button>
            )}
          </div>
        </div>
        <div className="s-row" style={{alignItems:'flex-start',paddingTop:10,paddingBottom:10}}>
          <span className="s-label" style={{paddingTop:6}}>文件名后缀</span>
          <div className="s-ctrl" style={{flexDirection:'column',alignItems:'flex-start',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <input id="suffix-el" className="s-input" value={local.output_suffix} disabled={local.overwrite_original}
                onChange={e => set('output_suffix', e.target.value)} />
              {([['宽','{w}'],['高','{h}']]).map(([label, token]) => (
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
                : <>留空则无后缀 · 可用 {'{'}w{'}'} {'{'}h{'}'} 插入宽高，如 _{'{'}w{'}'}x{'{'}h{'}'} → image_800x600.jpg</>}
            </span>
          </div>
        </div>
        <div className="s-row">
          <span className="s-label">覆盖原文件</span>
          <label className="toggle">
            <input type="checkbox" checked={local.overwrite_original}
              onChange={e => set('overwrite_original', e.target.checked)} />
            <span className="track" />
          </label>
        </div>
        <div className="s-row">
          <span className="s-label">按格式分文件夹</span>
          <div className="s-ctrl">
            <label className="toggle">
              <input type="checkbox" checked={local.fmt_folder}
                onChange={e => set('fmt_folder', e.target.checked)} />
              <span className="track" />
            </label>
            <span className="s-hint">webp → /webp/image_tiny.webp</span>
          </div>
        </div>
      </section>

      <section className="s-section">
        <h3>队列</h3>
        <div className="s-row">
          <span className="s-label">并发数量</span>
          <div className="s-ctrl">
            <input type="range" className="slider" min={1} max={5} value={local.max_concurrent}
              onChange={e => set('max_concurrent', Number(e.target.value))} />
            <span className="sv">{local.max_concurrent}</span>
            <span className="s-hint">张同时上传</span>
          </div>
        </div>
        <div className="s-row">
          <span className="s-label">失败重试</span>
          <select className="s-select" value={local.retry_count}
            onChange={e => set('retry_count', Number(e.target.value))}>
            {[0,1,2,3].map(n => <option key={n} value={n}>{n} 次</option>)}
          </select>
        </div>
        <div className="info-box">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7v4M8 5.2v.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          TinyPNG 每次限制 20 张。本工具自动分批，支持任意数量图片。
        </div>
      </section>

      </div>
      <div className="s-footer">
        <button className="btn btn-primary" onClick={handleSave}>保存设置</button>
        <button className="btn btn-ghost" onClick={handleReset}>恢复默认</button>
        {saved && <span className="save-ok">✓ 已保存</span>}
      </div>

    </div>
  );
}
