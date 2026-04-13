import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { tauriApi, pickDirectory } from '../utils/tauri';
import { AppSettings, OutputFormat } from '../types';

export default function SettingsPanel() {
  const { settings, setSettings } = useAppStore();
  const [local, setLocal] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLocal(settings); }, [settings]);

  const handleSave = async () => {
    await tauriApi.saveSettings(local);
    setSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePickDir = async () => {
    const dir = await pickDirectory();
    if (dir) setLocal((s) => ({ ...s, output_dir: dir }));
  };

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setLocal((s) => ({ ...s, [key]: value }));

  return (
    <div className="settings-panel">
      <h2>设置</h2>

      <section className="settings-section">
        <h3>输出目录</h3>
        <div className="setting-row">
          <label>保存位置</label>
          <div className="dir-picker">
            <span className="dir-path">
              {local.output_dir ?? '与原图相同目录'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handlePickDir}>
              选择目录
            </button>
            {local.output_dir && (
              <button
                className="btn btn-ghost btn-sm text-danger"
                onClick={() => set('output_dir', null)}
              >
                重置
              </button>
            )}
          </div>
        </div>

        <div className="setting-row">
          <label>文件名后缀</label>
          <div className="setting-input-group">
            <input
              type="text"
              value={local.output_suffix}
              onChange={(e) => set('output_suffix', e.target.value)}
              disabled={local.overwrite_original}
              placeholder="_tiny"
              className="input-sm"
            />
            <span className="hint">例：image.png → image_tiny.png</span>
          </div>
        </div>

        <div className="setting-row">
          <label>覆盖原文件</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={local.overwrite_original}
              onChange={(e) => set('overwrite_original', e.target.checked)}
            />
            <span className="toggle-track" />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h3>格式转换</h3>
        <div className="setting-row">
          <label>默认输出格式</label>
          <select
            value={local.default_output_format ?? ''}
            onChange={(e) =>
              set('default_output_format', (e.target.value || null) as OutputFormat)
            }
          >
            <option value="">保持原格式</option>
            <option value="webp">WebP（体积最小，现代浏览器）</option>
            <option value="avif">AVIF（更小，兼容性略低）</option>
            <option value="png">PNG（无损）</option>
            <option value="jpeg">JPEG（有损）</option>
          </select>
        </div>
        <p className="section-hint">
          单张图片的格式设置会覆盖此默认值。
        </p>
      </section>

      <section className="settings-section">
        <h3>队列设置</h3>
        <div className="setting-row">
          <label>并发数量</label>
          <div className="setting-input-group">
            <input
              type="range"
              min={1}
              max={5}
              value={local.max_concurrent}
              onChange={(e) => set('max_concurrent', Number(e.target.value))}
              className="slider"
            />
            <span className="slider-value">{local.max_concurrent}</span>
            <span className="hint">每批最多 {local.max_concurrent} 张同时上传</span>
          </div>
        </div>

        <div className="setting-row">
          <label>失败重试次数</label>
          <select
            value={local.retry_count}
            onChange={(e) => set('retry_count', Number(e.target.value))}
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>{n} 次</option>
            ))}
          </select>
        </div>

        <div className="batch-info">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          TinyPNG 每次最多上传 20 张。本应用自动将大量图片分成每批 20 张的队列，批次间隔 0.5 秒，完全绕过限制。
        </div>
      </section>

      <div className="settings-footer">
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? '✓ 已保存' : '保存设置'}
        </button>
      </div>
    </div>
  );
}
