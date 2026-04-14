import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { tauriApi, pickDirectory } from '../utils/tauri';
import { AppSettings } from '../types';

export default function SettingsPanel() {
  const { settings, setSettings } = useAppStore();
  const [local, setLocal] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => setLocal(settings), [settings]);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setLocal(s => ({ ...s, [key]: value }));

  const handleSave = async () => {
    await tauriApi.saveSettings(local);
    setSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePickDir = async () => {
    const dir = await pickDirectory();
    if (dir) set('output_dir', dir);
  };

  return (
    <div className="settings-panel">
      <h2>设置</h2>

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
        <div className="s-row">
          <span className="s-label">文件名后缀</span>
          <div className="s-ctrl">
            <input className="s-input" value={local.output_suffix} disabled={local.overwrite_original}
              onChange={e => set('output_suffix', e.target.value)} placeholder="_tiny" />
            <span className="s-hint">image.png → image_tiny.png</span>
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
          <select className="s-select" value={local.retry_count} onChange={e => set('retry_count', Number(e.target.value))}>
            {[0,1,2,3].map(n => <option key={n} value={n}>{n} 次</option>)}
          </select>
        </div>
        <div className="info-box">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M8 7v4M8 5.2v.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          TinyPNG 每次限制 20 张。本工具自动分批，支持任意数量图片。每张图上传一次，多种格式串行处理，避免触发限速。
        </div>
      </section>

      <div className="s-footer">
        <button className="btn btn-primary" onClick={handleSave}>保存设置</button>
        {saved && <span className="save-ok">✓ 已保存</span>}
      </div>
    </div>
  );
}
