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
  focusedBrightnessScale: 0.92,
  focusedContrastScale: 0.94,
  focusedSaturateScale: 0.94,
  focusedTintScale: 1.26,
  focusedTextOutsideScale: 1.14,
  focusedTransitionScale: 1,
  scanningBrightnessScale: 1.06,
  scanningContrastScale: 1.04,
  scanningSaturateScale: 1.03,
  scanningTintScale: 0.54,
  scanningTextOutsideScale: 0.62,
  scanningTransitionScale: 0.68,
  fatigueBrightnessScale: 0.78,
  fatigueContrastScale: 0.84,
  fatigueSaturateScale: 0.82,
  fatigueTintScale: 1.55,
  fatigueTextOutsideScale: 1.42,
  fatigueTransitionScale: 4,
  modeMovementEpsilonPx: 1.2,
  modeFastSpeedPxPerMs: 0.88,
  modeFastResetSpeedPxPerMs: 0.5,
  modeScanTriggerMs: 1200,
  modeScanExitSpeedPxPerMs: 0.42,
  modeScanExitHoldMs: 360,
  modeFatigueIdleMs: 7000,
  modeSlowSpeedPxPerMs: 0.08,
  modeSlowResetSpeedPxPerMs: 0.22,
  modeFatigueTriggerMs: 1600,
  modeFatigueExitSpeedPxPerMs: 0.36,
  modeSpeedDecayTauMs: 360,
  modeDecayAfterIdleMs: 100,
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
  focusedBrightnessScale: document.getElementById('focusedBrightnessScale'),
  focusedContrastScale: document.getElementById('focusedContrastScale'),
  focusedSaturateScale: document.getElementById('focusedSaturateScale'),
  focusedTintScale: document.getElementById('focusedTintScale'),
  focusedTextOutsideScale: document.getElementById('focusedTextOutsideScale'),
  focusedTransitionScale: document.getElementById('focusedTransitionScale'),
  scanningBrightnessScale: document.getElementById('scanningBrightnessScale'),
  scanningContrastScale: document.getElementById('scanningContrastScale'),
  scanningSaturateScale: document.getElementById('scanningSaturateScale'),
  scanningTintScale: document.getElementById('scanningTintScale'),
  scanningTextOutsideScale: document.getElementById('scanningTextOutsideScale'),
  scanningTransitionScale: document.getElementById('scanningTransitionScale'),
  fatigueBrightnessScale: document.getElementById('fatigueBrightnessScale'),
  fatigueContrastScale: document.getElementById('fatigueContrastScale'),
  fatigueSaturateScale: document.getElementById('fatigueSaturateScale'),
  fatigueTintScale: document.getElementById('fatigueTintScale'),
  fatigueTextOutsideScale: document.getElementById('fatigueTextOutsideScale'),
  fatigueTransitionScale: document.getElementById('fatigueTransitionScale'),
  modeMovementEpsilonPx: document.getElementById('modeMovementEpsilonPx'),
  modeFastSpeedPxPerMs: document.getElementById('modeFastSpeedPxPerMs'),
  modeFastResetSpeedPxPerMs: document.getElementById('modeFastResetSpeedPxPerMs'),
  modeScanTriggerMs: document.getElementById('modeScanTriggerMs'),
  modeScanExitSpeedPxPerMs: document.getElementById('modeScanExitSpeedPxPerMs'),
  modeScanExitHoldMs: document.getElementById('modeScanExitHoldMs'),
  modeFatigueIdleMs: document.getElementById('modeFatigueIdleMs'),
  modeSlowSpeedPxPerMs: document.getElementById('modeSlowSpeedPxPerMs'),
  modeSlowResetSpeedPxPerMs: document.getElementById('modeSlowResetSpeedPxPerMs'),
  modeFatigueTriggerMs: document.getElementById('modeFatigueTriggerMs'),
  modeFatigueExitSpeedPxPerMs: document.getElementById('modeFatigueExitSpeedPxPerMs'),
  modeSpeedDecayTauMs: document.getElementById('modeSpeedDecayTauMs'),
  modeDecayAfterIdleMs: document.getElementById('modeDecayAfterIdleMs'),
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
  const modeSettings = normalizeModeSettings(source);

  return {
    ...DEFAULTS,
    ...source,
    ...modeSettings,
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
  form.focusedBrightnessScale.value = settings.focusedBrightnessScale ?? DEFAULTS.focusedBrightnessScale;
  form.focusedContrastScale.value = settings.focusedContrastScale ?? DEFAULTS.focusedContrastScale;
  form.focusedSaturateScale.value = settings.focusedSaturateScale ?? DEFAULTS.focusedSaturateScale;
  form.focusedTintScale.value = settings.focusedTintScale ?? DEFAULTS.focusedTintScale;
  form.focusedTextOutsideScale.value = settings.focusedTextOutsideScale ?? DEFAULTS.focusedTextOutsideScale;
  form.focusedTransitionScale.value = settings.focusedTransitionScale ?? DEFAULTS.focusedTransitionScale;
  form.scanningBrightnessScale.value = settings.scanningBrightnessScale ?? DEFAULTS.scanningBrightnessScale;
  form.scanningContrastScale.value = settings.scanningContrastScale ?? DEFAULTS.scanningContrastScale;
  form.scanningSaturateScale.value = settings.scanningSaturateScale ?? DEFAULTS.scanningSaturateScale;
  form.scanningTintScale.value = settings.scanningTintScale ?? DEFAULTS.scanningTintScale;
  form.scanningTextOutsideScale.value = settings.scanningTextOutsideScale ?? DEFAULTS.scanningTextOutsideScale;
  form.scanningTransitionScale.value = settings.scanningTransitionScale ?? DEFAULTS.scanningTransitionScale;
  form.fatigueBrightnessScale.value = settings.fatigueBrightnessScale ?? DEFAULTS.fatigueBrightnessScale;
  form.fatigueContrastScale.value = settings.fatigueContrastScale ?? DEFAULTS.fatigueContrastScale;
  form.fatigueSaturateScale.value = settings.fatigueSaturateScale ?? DEFAULTS.fatigueSaturateScale;
  form.fatigueTintScale.value = settings.fatigueTintScale ?? DEFAULTS.fatigueTintScale;
  form.fatigueTextOutsideScale.value = settings.fatigueTextOutsideScale ?? DEFAULTS.fatigueTextOutsideScale;
  form.fatigueTransitionScale.value = settings.fatigueTransitionScale ?? DEFAULTS.fatigueTransitionScale;
  form.modeMovementEpsilonPx.value = settings.modeMovementEpsilonPx ?? DEFAULTS.modeMovementEpsilonPx;
  form.modeFastSpeedPxPerMs.value = settings.modeFastSpeedPxPerMs ?? DEFAULTS.modeFastSpeedPxPerMs;
  form.modeFastResetSpeedPxPerMs.value = settings.modeFastResetSpeedPxPerMs ?? DEFAULTS.modeFastResetSpeedPxPerMs;
  form.modeScanTriggerMs.value = settings.modeScanTriggerMs ?? DEFAULTS.modeScanTriggerMs;
  form.modeScanExitSpeedPxPerMs.value = settings.modeScanExitSpeedPxPerMs ?? DEFAULTS.modeScanExitSpeedPxPerMs;
  form.modeScanExitHoldMs.value = settings.modeScanExitHoldMs ?? DEFAULTS.modeScanExitHoldMs;
  form.modeFatigueIdleMs.value = settings.modeFatigueIdleMs ?? DEFAULTS.modeFatigueIdleMs;
  form.modeSlowSpeedPxPerMs.value = settings.modeSlowSpeedPxPerMs ?? DEFAULTS.modeSlowSpeedPxPerMs;
  form.modeSlowResetSpeedPxPerMs.value = settings.modeSlowResetSpeedPxPerMs ?? DEFAULTS.modeSlowResetSpeedPxPerMs;
  form.modeFatigueTriggerMs.value = settings.modeFatigueTriggerMs ?? DEFAULTS.modeFatigueTriggerMs;
  form.modeFatigueExitSpeedPxPerMs.value = settings.modeFatigueExitSpeedPxPerMs ?? DEFAULTS.modeFatigueExitSpeedPxPerMs;
  form.modeSpeedDecayTauMs.value = settings.modeSpeedDecayTauMs ?? DEFAULTS.modeSpeedDecayTauMs;
  form.modeDecayAfterIdleMs.value = settings.modeDecayAfterIdleMs ?? DEFAULTS.modeDecayAfterIdleMs;
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
  const modeSettings = normalizeModeSettings({
    focusedBrightnessScale: form.focusedBrightnessScale.value,
    focusedContrastScale: form.focusedContrastScale.value,
    focusedSaturateScale: form.focusedSaturateScale.value,
    focusedTintScale: form.focusedTintScale.value,
    focusedTextOutsideScale: form.focusedTextOutsideScale.value,
    focusedTransitionScale: form.focusedTransitionScale.value,
    scanningBrightnessScale: form.scanningBrightnessScale.value,
    scanningContrastScale: form.scanningContrastScale.value,
    scanningSaturateScale: form.scanningSaturateScale.value,
    scanningTintScale: form.scanningTintScale.value,
    scanningTextOutsideScale: form.scanningTextOutsideScale.value,
    scanningTransitionScale: form.scanningTransitionScale.value,
    fatigueBrightnessScale: form.fatigueBrightnessScale.value,
    fatigueContrastScale: form.fatigueContrastScale.value,
    fatigueSaturateScale: form.fatigueSaturateScale.value,
    fatigueTintScale: form.fatigueTintScale.value,
    fatigueTextOutsideScale: form.fatigueTextOutsideScale.value,
    fatigueTransitionScale: form.fatigueTransitionScale.value,
    modeMovementEpsilonPx: form.modeMovementEpsilonPx.value,
    modeFastSpeedPxPerMs: form.modeFastSpeedPxPerMs.value,
    modeFastResetSpeedPxPerMs: form.modeFastResetSpeedPxPerMs.value,
    modeScanTriggerMs: form.modeScanTriggerMs.value,
    modeScanExitSpeedPxPerMs: form.modeScanExitSpeedPxPerMs.value,
    modeScanExitHoldMs: form.modeScanExitHoldMs.value,
    modeFatigueIdleMs: form.modeFatigueIdleMs.value,
    modeSlowSpeedPxPerMs: form.modeSlowSpeedPxPerMs.value,
    modeSlowResetSpeedPxPerMs: form.modeSlowResetSpeedPxPerMs.value,
    modeFatigueTriggerMs: form.modeFatigueTriggerMs.value,
    modeFatigueExitSpeedPxPerMs: form.modeFatigueExitSpeedPxPerMs.value,
    modeSpeedDecayTauMs: form.modeSpeedDecayTauMs.value,
    modeDecayAfterIdleMs: form.modeDecayAfterIdleMs.value,
  });

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
    ...modeSettings,
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

function normalizeModeSettings(source) {
  const values = source && typeof source === 'object' ? source : {};
  const fastSpeed = toClampedNumber(values.modeFastSpeedPxPerMs, 0.05, 4, DEFAULTS.modeFastSpeedPxPerMs);
  const slowSpeed = toClampedNumber(values.modeSlowSpeedPxPerMs, 0.001, 1, DEFAULTS.modeSlowSpeedPxPerMs);

  return {
    focusedBrightnessScale: toClampedNumber(
      values.focusedBrightnessScale,
      0.4,
      1.4,
      DEFAULTS.focusedBrightnessScale
    ),
    focusedContrastScale: toClampedNumber(values.focusedContrastScale, 0.4, 1.4, DEFAULTS.focusedContrastScale),
    focusedSaturateScale: toClampedNumber(values.focusedSaturateScale, 0.4, 1.8, DEFAULTS.focusedSaturateScale),
    focusedTintScale: toClampedNumber(values.focusedTintScale, 0.2, 2, DEFAULTS.focusedTintScale),
    focusedTextOutsideScale: toClampedNumber(
      values.focusedTextOutsideScale,
      0.2,
      2,
      DEFAULTS.focusedTextOutsideScale
    ),
    focusedTransitionScale: toClampedNumber(values.focusedTransitionScale, 0.2, 8, DEFAULTS.focusedTransitionScale),
    scanningBrightnessScale: toClampedNumber(
      values.scanningBrightnessScale,
      0.4,
      1.4,
      DEFAULTS.scanningBrightnessScale
    ),
    scanningContrastScale: toClampedNumber(
      values.scanningContrastScale,
      0.4,
      1.4,
      DEFAULTS.scanningContrastScale
    ),
    scanningSaturateScale: toClampedNumber(values.scanningSaturateScale, 0.4, 1.8, DEFAULTS.scanningSaturateScale),
    scanningTintScale: toClampedNumber(values.scanningTintScale, 0.2, 2, DEFAULTS.scanningTintScale),
    scanningTextOutsideScale: toClampedNumber(
      values.scanningTextOutsideScale,
      0.2,
      2,
      DEFAULTS.scanningTextOutsideScale
    ),
    scanningTransitionScale: toClampedNumber(
      values.scanningTransitionScale,
      0.2,
      8,
      DEFAULTS.scanningTransitionScale
    ),
    fatigueBrightnessScale: toClampedNumber(
      values.fatigueBrightnessScale,
      0.4,
      1.4,
      DEFAULTS.fatigueBrightnessScale
    ),
    fatigueContrastScale: toClampedNumber(values.fatigueContrastScale, 0.4, 1.4, DEFAULTS.fatigueContrastScale),
    fatigueSaturateScale: toClampedNumber(values.fatigueSaturateScale, 0.4, 1.8, DEFAULTS.fatigueSaturateScale),
    fatigueTintScale: toClampedNumber(values.fatigueTintScale, 0.2, 2, DEFAULTS.fatigueTintScale),
    fatigueTextOutsideScale: toClampedNumber(
      values.fatigueTextOutsideScale,
      0.2,
      2,
      DEFAULTS.fatigueTextOutsideScale
    ),
    fatigueTransitionScale: toClampedNumber(values.fatigueTransitionScale, 0.2, 8, DEFAULTS.fatigueTransitionScale),
    modeMovementEpsilonPx: toClampedNumber(
      values.modeMovementEpsilonPx,
      0.1,
      20,
      DEFAULTS.modeMovementEpsilonPx
    ),
    modeFastSpeedPxPerMs: fastSpeed,
    modeFastResetSpeedPxPerMs: toClampedNumber(
      values.modeFastResetSpeedPxPerMs,
      0.01,
      fastSpeed,
      Math.min(fastSpeed, DEFAULTS.modeFastResetSpeedPxPerMs)
    ),
    modeScanTriggerMs: toClampedNumber(values.modeScanTriggerMs, 200, 8000, DEFAULTS.modeScanTriggerMs),
    modeScanExitSpeedPxPerMs: toClampedNumber(
      values.modeScanExitSpeedPxPerMs,
      0.01,
      3,
      DEFAULTS.modeScanExitSpeedPxPerMs
    ),
    modeScanExitHoldMs: toClampedNumber(values.modeScanExitHoldMs, 80, 3000, DEFAULTS.modeScanExitHoldMs),
    modeFatigueIdleMs: toClampedNumber(values.modeFatigueIdleMs, 1000, 120000, DEFAULTS.modeFatigueIdleMs),
    modeSlowSpeedPxPerMs: slowSpeed,
    modeSlowResetSpeedPxPerMs: toClampedNumber(
      values.modeSlowResetSpeedPxPerMs,
      slowSpeed,
      2,
      Math.max(slowSpeed, DEFAULTS.modeSlowResetSpeedPxPerMs)
    ),
    modeFatigueTriggerMs: toClampedNumber(values.modeFatigueTriggerMs, 200, 12000, DEFAULTS.modeFatigueTriggerMs),
    modeFatigueExitSpeedPxPerMs: toClampedNumber(
      values.modeFatigueExitSpeedPxPerMs,
      0.05,
      3,
      DEFAULTS.modeFatigueExitSpeedPxPerMs
    ),
    modeSpeedDecayTauMs: toClampedNumber(values.modeSpeedDecayTauMs, 60, 5000, DEFAULTS.modeSpeedDecayTauMs),
    modeDecayAfterIdleMs: toClampedNumber(
      values.modeDecayAfterIdleMs,
      0,
      2000,
      DEFAULTS.modeDecayAfterIdleMs
    ),
  };
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