const DEFAULTS = {
  enabled: true,
  localUrl: 'http://127.0.0.1:3000/coordinate',
  pollInterval: 1000,
  coordinateSpace: 'auto',
  focusRadiusX: 220,
  focusRadiusY: 150,
  focusOffsetX: 0,
  focusOffsetY: 0,
  feather: 96,
  transitionMs: 320,
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
  focusRadiusX: document.getElementById('focusRadiusX'),
  focusRadiusY: document.getElementById('focusRadiusY'),
  focusOffsetX: document.getElementById('focusOffsetX'),
  focusOffsetY: document.getElementById('focusOffsetY'),
  feather: document.getElementById('feather'),
  transitionMs: document.getElementById('transitionMs'),
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
    chrome.storage.sync.get({ ...DEFAULTS, focusRadius: DEFAULTS.focusRadiusX }, (stored) => {
      resolve(normalizeLoadedSettings(stored));
    });
  });
}

function normalizeLoadedSettings(stored) {
  const source = stored && typeof stored === 'object' ? stored : {};
  const legacyRadius = toClampedNumber(source.focusRadius, 40, 1600, DEFAULTS.focusRadiusX);
  const focusRadiusX = toClampedNumber(source.focusRadiusX, 40, 1600, legacyRadius);
  const focusRadiusY = toClampedNumber(source.focusRadiusY, 40, 1600, legacyRadius);
  const maxFeather = Math.max(4, Math.min(focusRadiusX, focusRadiusY) - 2);

  return {
    ...DEFAULTS,
    ...source,
    focusRadiusX,
    focusRadiusY,
    focusOffsetX: toClampedNumber(source.focusOffsetX, -3000, 3000, DEFAULTS.focusOffsetX),
    focusOffsetY: toClampedNumber(source.focusOffsetY, -3000, 3000, DEFAULTS.focusOffsetY),
    feather: toClampedNumber(source.feather, 4, Math.min(600, maxFeather), DEFAULTS.feather),
    transitionMs: toClampedNumber(source.transitionMs, 180, 2000, DEFAULTS.transitionMs),
    brightness: toClampedNumber(source.brightness, 0.5, 1.2, DEFAULTS.brightness),
    contrast: toClampedNumber(source.contrast, 0.5, 1.2, DEFAULTS.contrast),
    saturate: toClampedNumber(source.saturate, 0.5, 1.5, DEFAULTS.saturate),
    overlayTint: toClampedNumber(source.overlayTint, 0, 0.35, DEFAULTS.overlayTint),
    pollInterval: toClampedNumber(source.pollInterval, 300, 10000, DEFAULTS.pollInterval),
  };
}

function fillForm(settings) {
  form.enabled.checked = Boolean(settings.enabled);
  form.localUrl.value = settings.localUrl ?? '';
  form.pollInterval.value = settings.pollInterval ?? DEFAULTS.pollInterval;
  form.coordinateSpace.value = settings.coordinateSpace ?? DEFAULTS.coordinateSpace;
  form.focusRadiusX.value = settings.focusRadiusX ?? DEFAULTS.focusRadiusX;
  form.focusRadiusY.value = settings.focusRadiusY ?? DEFAULTS.focusRadiusY;
  form.focusOffsetX.value = settings.focusOffsetX ?? DEFAULTS.focusOffsetX;
  form.focusOffsetY.value = settings.focusOffsetY ?? DEFAULTS.focusOffsetY;
  form.feather.value = settings.feather ?? DEFAULTS.feather;
  form.transitionMs.value = settings.transitionMs ?? DEFAULTS.transitionMs;
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
  const focusRadiusX = toClampedNumber(form.focusRadiusX.value, 40, 1600, DEFAULTS.focusRadiusX);
  const focusRadiusY = toClampedNumber(form.focusRadiusY.value, 40, 1600, DEFAULTS.focusRadiusY);
  const maxFeather = Math.max(4, Math.min(focusRadiusX, focusRadiusY) - 2);

  return {
    enabled: form.enabled.checked,
    localUrl: form.localUrl.value.trim(),
    pollInterval: toClampedNumber(form.pollInterval.value, 300, 10000, DEFAULTS.pollInterval),
    coordinateSpace: form.coordinateSpace.value,
    focusRadiusX,
    focusRadiusY,
    focusOffsetX: toClampedNumber(form.focusOffsetX.value, -3000, 3000, DEFAULTS.focusOffsetX),
    focusOffsetY: toClampedNumber(form.focusOffsetY.value, -3000, 3000, DEFAULTS.focusOffsetY),
    feather: toClampedNumber(form.feather.value, 4, Math.min(600, maxFeather), DEFAULTS.feather),
    transitionMs: toClampedNumber(form.transitionMs.value, 180, 2000, DEFAULTS.transitionMs),
    brightness: toClampedNumber(form.brightness.value, 0.5, 1.2, DEFAULTS.brightness),
    contrast: toClampedNumber(form.contrast.value, 0.5, 1.2, DEFAULTS.contrast),
    saturate: toClampedNumber(form.saturate.value, 0.5, 1.5, DEFAULTS.saturate),
    overlayTint: toClampedNumber(form.overlayTint.value, 0, 0.35, DEFAULTS.overlayTint),
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
    if (!response.coordinate) {
      setStatus('接口可用，但没有返回坐标；页面将使用当前鼠标位置作为输入。');
      return;
    }

    const coordinate = response.coordinate;
    setStatus(`接口可用，读取到坐标：x=${Math.round(coordinate.x)}, y=${Math.round(coordinate.y)}，基准=${coordinate.space}`);
  } catch (error) {
    setStatus(`接口测试失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

function toClampedNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
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