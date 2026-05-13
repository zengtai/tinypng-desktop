type Locale = 'zh' | 'en';

const messages: Record<Locale, Record<string, string>> = {
  zh: {
    // Tabs
    'tab.compress': '压缩',
    'tab.settings': '设置',

    // Theme
    'theme.light': '切换亮色模式',
    'theme.dark': '切换暗色模式',

    // DropZone
    'drop.title': '拖拽图片或文件夹到这里',
    'drop.or': '或者 ',
    'drop.pick': '点击选择文件',
    'drop.hint': '支持 PNG · JPEG · WebP · AVIF · 单张最大 5MB',

    // TopBar
    'top.add': '添加图片',
    'top.format': '格式：',
    'top.applyAll': '应用到全部',
    'top.tally': '{n} 张 · <b>{done}</b> 完成',
    'top.clearDone': '清除已完成',
    'top.retryFailed': '重试失败',
    'top.clearAll': '清除全部',
    'top.processing': '处理中...',
    'top.start': '开始压缩',

    // FileCards
    'card.processing': '处理中',
    'card.done': '完成',
    'card.pending': '待处理',
    'card.showInFolder': '点击在文件夹中显示',
    'card.retry': '重试',
    'card.failed': '失败',
    'card.tilePending': '待处理',
    'drag.overlay': '松开以添加图片',

    // StatusBar
    'status.hint': 'TinyPNG Desktop — 自动分批队列，请合理使用',
    'status.processing': '处理中 {done}/{total}',
    'status.count': '{n} 张',
    'status.batches': '将分 {n} 批',
    'status.errors': '{n} 失败',
    'status.saved': '节省 {size}',
    'status.increased': '增加 {size}',
    'status.doneOf': '{done}/{total} 完成',

    // Settings - Output
    'set.output': '输出',
    'set.saveDir': '保存位置',
    'set.sameDirHint': '与原图相同目录',
    'set.pick': '选择',
    'set.reset': '重置',
    'set.suffix': '文件名后缀',
    'set.suffixW': '宽',
    'set.suffixH': '高',
    'set.suffixPreview': 'image.png → image{suffix}.png',
    'set.suffixEmpty': '留空则无后缀 · 可用 {w} {h} 插入宽高，如 _{w}x{h} → image_800x600.jpg',
    'set.suffixWarn': '⚠ 后缀为空且保存到原目录，同格式输出将覆盖原文件',
    'set.overwrite': '覆盖原文件',
    'set.fmtFolder': '按格式分文件夹',
    'set.fmtFolderHint': 'webp → /webp/image_tiny.webp',

    // Settings - Queue
    'set.queue': '队列',
    'set.concurrent': '并发数量',
    'set.concurrentHint': '张同时上传',
    'set.retry': '失败重试',
    'set.retryUnit': '{n} 次',
    'set.batchInfo': 'TinyPNG 每次限制 20 张。本工具自动分批处理，请合理使用，避免频繁请求导致 IP 被限速。',

    // Settings - API
    'set.api': 'API',
    'set.apiKey': 'API Key',
    'set.apiPlaceholder': '留空则使用免费接口',
    'set.apiClear': '清除 API Key',
    'set.apiDesc': '填写后使用 ',
    'set.apiLink': 'TinyPNG 官方 API',
    'set.apiQuota': '（每月 500 张免费额度，无单次数量限制）',
    'set.bgColor': '透明背景色',
    'set.bgHint': '透明图转 JPEG 时填充的背景色',

    // Settings - Font
    'set.font': '界面',
    'set.fontFamily': '界面字体',
    'set.fontPlaceholder': '留空使用系统默认字体',
    'set.fontHint': '输入字体名称，带空格的名称需加引号，如 "Microsoft YaHei"',

    // Settings - Footer
    'set.save': '保存设置',
    'set.restoreDefault': '恢复默认',
    'set.saved': '✓ 已保存',

    // Notifications (from App.tsx)
    'notify.skippedNonImage': '已跳过 {n} 个不支持的文件（仅支持 PNG/JPEG/WebP/AVIF）',
    'notify.skippedLarge': '跳过 {n} 个超过 5MB 的文件：{names}',

    // Rust error codes
    'err_dns': '网络连接失败，请检查网络',
    'err_timeout': '请求超时，请稍后重试',
    'err_connect': '无法连接服务器，请检查网络',
    'err_429': '请求过于频繁，请稍后重试',
    'err_401': 'API Key 无效，请检查设置',
    'err_413': '文件过大，请使用 5MB 以内的图片',
    'err_415': '不支持的图片格式',
    'err_alpha_free': '原图含透明通道，免费接口不支持转换为 JPEG。设置 API Key 后可自动填充背景色转换',
    'err_same_path': '输出路径与原文件相同，请设置文件名后缀或开启覆盖模式',
  },
  en: {
    'tab.compress': 'Compress',
    'tab.settings': 'Settings',

    'theme.light': 'Switch to light mode',
    'theme.dark': 'Switch to dark mode',

    'drop.title': 'Drop images or folders here',
    'drop.or': 'or ',
    'drop.pick': 'click to select files',
    'drop.hint': 'PNG · JPEG · WebP · AVIF · Max 5MB each',

    'top.add': 'Add images',
    'top.format': 'Format: ',
    'top.applyAll': 'Apply to all',
    'top.tally': '{n} files · <b>{done}</b> done',
    'top.clearDone': 'Clear done',
    'top.retryFailed': 'Retry failed',
    'top.clearAll': 'Clear all',
    'top.processing': 'Processing...',
    'top.start': 'Compress',

    'card.processing': 'Processing',
    'card.done': 'Done',
    'card.pending': 'Pending',
    'card.showInFolder': 'Click to show in folder',
    'card.retry': 'Retry',
    'card.failed': 'Failed',
    'card.tilePending': 'Pending',
    'drag.overlay': 'Drop to add images',

    'status.hint': 'TinyPNG Desktop — Auto batch queue, please use responsibly',
    'status.processing': 'Processing {done}/{total}',
    'status.count': '{n} files',
    'status.batches': '{n} batches',
    'status.errors': '{n} failed',
    'status.saved': 'Saved {size}',
    'status.increased': 'Increased {size}',
    'status.doneOf': '{done}/{total} done',

    'set.output': 'Output',
    'set.saveDir': 'Save to',
    'set.sameDirHint': 'Same as source',
    'set.pick': 'Browse',
    'set.reset': 'Reset',
    'set.suffix': 'Filename suffix',
    'set.suffixW': 'W',
    'set.suffixH': 'H',
    'set.suffixPreview': 'image.png → image{suffix}.png',
    'set.suffixEmpty': 'Empty = no suffix · Use {w} {h} for dimensions, e.g. _{w}x{h} → image_800x600.jpg',
    'set.suffixWarn': '⚠ Empty suffix with same directory will overwrite same-format originals',
    'set.overwrite': 'Overwrite original',
    'set.fmtFolder': 'Folder per format',
    'set.fmtFolderHint': 'webp → /webp/image_tiny.webp',

    'set.queue': 'Queue',
    'set.concurrent': 'Concurrency',
    'set.concurrentHint': 'simultaneous uploads',
    'set.retry': 'Retry on failure',
    'set.retryUnit': '{n} times',
    'set.batchInfo': 'TinyPNG limits 20 images per request. This tool auto-batches, but please use responsibly to avoid rate limiting.',

    'set.api': 'API',
    'set.apiKey': 'API Key',
    'set.apiPlaceholder': 'Leave empty for free API',
    'set.apiClear': 'Clear API Key',
    'set.apiDesc': 'Use ',
    'set.apiLink': 'TinyPNG Official API',
    'set.apiQuota': ' (500 free/month, no per-batch limit)',
    'set.bgColor': 'Background color',
    'set.bgHint': 'Fill color for transparent images converted to JPEG',

    'set.font': 'Interface',
    'set.fontFamily': 'Font',
    'set.fontPlaceholder': 'Leave empty for system default',
    'set.fontHint': 'Enter font name. Names with spaces need quotes, e.g. "Segoe UI"',

    'set.save': 'Save',
    'set.restoreDefault': 'Restore defaults',
    'set.saved': '✓ Saved',

    'notify.skippedNonImage': 'Skipped {n} unsupported files (PNG/JPEG/WebP/AVIF only)',
    'notify.skippedLarge': 'Skipped {n} files over 5MB: {names}',

    'err_dns': 'Network error, please check your connection',
    'err_timeout': 'Request timed out, please try again',
    'err_connect': 'Cannot connect to server, please check your network',
    'err_429': 'Too many requests, please try again later',
    'err_401': 'Invalid API Key, please check settings',
    'err_413': 'File too large, please use images under 5MB',
    'err_415': 'Unsupported image format',
    'err_alpha_free': 'Image has transparency, free API cannot convert to JPEG. Set an API Key to auto-fill background',
    'err_same_path': 'Output path is same as source, please set a suffix or enable overwrite',
  },
};

let currentLocale: Locale = 'zh';

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  let msg = messages[currentLocale]?.[key] ?? messages.zh[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.split(`{${k}}`).join(String(v));
    }
  }
  return msg;
}

export type { Locale };
