const DEFAULTS = {
  enabled: true,
  localUrl: 'http://127.0.0.1:3000/coordinate',
  pollInterval: 1000,
  coordinateSpace: 'auto',
  focusRadius: 180,
  feather: 96,
  brightness: 0.96,
  contrast: 0.88,
  saturate: 0.92,
  overlayTint: 0.08,
};

const form = {
  enabled: document.getElementById('enabled'),
  localUrl: document.getElementById('localUrl'),
  pollInterval: document.getElementById('pollInterval'),
  coordinateSpace: document.getElementById('coordinateSpace'),
  focusRadius: document.getElementById('focusRadius'),
  feather: document.getElementById('feather'),
  brightness: document.getElementById('brightness'),
  contrast: document.getElementById('contrast'),
  saturate: document.getElementById('saturate'),
  overlayTint: document.getElementById('overlayTint'),
  saveBtn: document.getElementById('saveBtn'),
  testBtn: document.getElementById('testBtn'),
  status: document.getElementById('status'),
};

initialize().catch((error) => {
  setStatus(`初始化失败：${error instanceof Error ? error.message : String(error)}`);
});

async function initialize() {
  const stored = await loadSettings();
  fillForm(stored);
  form.saveBtn.addEventListener('click', saveSettings);
  form.testBtn.addEventListener('click', testEndpoint);
  setStatus('配置已加载。');
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULTS, (stored) => {
      resolve({ ...DEFAULTS, ...stored });
    });
  });
}

function fillForm(settings) {
  form.enabled.checked = Boolean(settings.enabled);
  form.localUrl.value = settings.localUrl ?? '';
  form.pollInterval.value = settings.pollInterval ?? DEFAULTS.pollInterval;
  form.coordinateSpace.value = settings.coordinateSpace ?? DEFAULTS.coordinateSpace;
  form.focusRadius.value = settings.focusRadius ?? DEFAULTS.focusRadius;
  form.feather.value = settings.feather ?? DEFAULTS.feather;
  form.brightness.value = settings.brightness ?? DEFAULTS.brightness;
  form.contrast.value = settings.contrast ?? DEFAULTS.contrast;
  form.saturate.value = settings.saturate ?? DEFAULTS.saturate;
  form.overlayTint.value = settings.overlayTint ?? DEFAULTS.overlayTint;
}

async function saveSettings() {
  const settings = readForm();
  const permissionGranted = await ensureOriginPermission(settings.localUrl);
  if (!permissionGranted) {
    return;
  }

  await new Promise((resolve) => chrome.storage.sync.set(settings, resolve));
  chrome.runtime.sendMessage({ type: 'lens-settings-updated', settings });
  setStatus('配置已保存。');
}

function readForm() {
  return {
    enabled: form.enabled.checked,
    localUrl: form.localUrl.value.trim(),
    pollInterval: toNumber(form.pollInterval.value, DEFAULTS.pollInterval),
    coordinateSpace: form.coordinateSpace.value,
    focusRadius: toNumber(form.focusRadius.value, DEFAULTS.focusRadius),
    feather: toNumber(form.feather.value, DEFAULTS.feather),
    brightness: toNumber(form.brightness.value, DEFAULTS.brightness),
    contrast: toNumber(form.contrast.value, DEFAULTS.contrast),
    saturate: toNumber(form.saturate.value, DEFAULTS.saturate),
    overlayTint: toNumber(form.overlayTint.value, DEFAULTS.overlayTint),
  };
}

async function testEndpoint() {
  const settings = readForm();
  if (!settings.localUrl) {
    setStatus('请先填写本地 URL。');
    return;
  }

  const permissionGranted = await ensureOriginPermission(settings.localUrl);
  if (!permissionGranted) {
    return;
  }

  setStatus('正在测试接口...');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'fetch-coordinate', url: settings.localUrl });
    if (!response?.ok) {
      setStatus(`接口测试失败：${response?.error ?? 'unknown-error'}`);
      return;
    }
    const coordinate = response.coordinate;
    setStatus(`接口可用，读取到坐标：x=${Math.round(coordinate.x)}, y=${Math.round(coordinate.y)}，基准=${coordinate.space}`);
  } catch (error) {
    setStatus(`接口测试失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

function toNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

async function ensureOriginPermission(urlString) {
  let originPattern = '';
  try {
    originPattern = `${new URL(urlString).origin}/*`;
  } catch {
    setStatus('请输入有效的 http 或 https URL。');
    return false;
  }

  const alreadyGranted = await new Promise((resolve) => {
    chrome.permissions.contains({ origins: [originPattern] }, resolve);
  });

  if (alreadyGranted) {
    return true;
  }

  const granted = await new Promise((resolve) => {
    chrome.permissions.request({ origins: [originPattern] }, resolve);
  });

  if (!granted) {
    setStatus(`未授予 ${originPattern} 的访问权限。`);
    return false;
  }

  return true;
}

function setStatus(message) {
  form.status.textContent = message;
}