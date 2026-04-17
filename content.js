const SETTINGS_DEFAULTS = {
  enabled: true,
  localUrl: 'http://127.0.0.1:3000/coordinate',
  pollInterval: 1000,
  coordinateSpace: 'auto',
  focusRadiusX: 220,
  focusRadiusY: 150,
  focusOffsetX: 0,
  focusOffsetY: 0,
  feather: 96,
  transitionMs: 220,
  brightness: 0.96,
  contrast: 0.88,
  saturate: 0.92,
  overlayTint: 0.08,
};

const OUTSIDE_TEXT_CLASS = 'shrimp-coordinate-lens__outside-text';
const MAX_TINTED_TEXT_ELEMENTS = 2200;
const TEXT_TINT_UPDATE_INTERVAL_MS = 120;
const EXCLUDED_TINT_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION']);

let settings = { ...SETTINGS_DEFAULTS };
let overlayRoot = null;
let pollTimer = null;
let lastPointerCoordinate = null;
let outsideTintedElements = new Set();
let targetCoordinate = null;
let renderedCoordinate = null;
let animationFrameId = null;
let animationLastTimestamp = 0;
let lastTextTintUpdateTimestamp = 0;

initialize().catch((error) => {
  console.error('Coordinate Dimming Lens initialization failed:', error);
});

async function initialize() {
  settings = await loadSettings();
  ensureOverlay();
  trackPointer();
  applyCoordinate(null);
  startPolling();

  chrome.storage.onChanged.addListener(handleStorageChange);
  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === 'lens-settings-updated') {
        settings = normalizeSettings({ ...settings, ...message.settings });
        refreshPolling();
      }
    });
  }
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      { ...SETTINGS_DEFAULTS, focusRadius: SETTINGS_DEFAULTS.focusRadiusX },
      (stored) => {
        resolve(normalizeSettings(stored));
      }
    );
  });
}

function handleStorageChange(changes, areaName) {
  if (areaName !== 'sync') {
    return;
  }

  const updated = {};
  for (const [key, change] of Object.entries(changes)) {
    if (Object.prototype.hasOwnProperty.call(SETTINGS_DEFAULTS, key) || key === 'focusRadius') {
      updated[key] = change.newValue;
    }
  }

  if (Object.keys(updated).length === 0) {
    return;
  }

  settings = normalizeSettings({ ...settings, ...updated });
  refreshPolling();
}

function refreshPolling() {
  stopPolling();
  startPolling();
}

function startPolling() {
  if (!settings.enabled) {
    applyCoordinate(null);
    return;
  }

  requestCoordinate();
  const interval = clampNumber(settings.pollInterval, 300, 10000, SETTINGS_DEFAULTS.pollInterval);
  pollTimer = window.setInterval(requestCoordinate, interval);
}

function stopPolling() {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function ensureOverlay() {
  if (overlayRoot) {
    return overlayRoot;
  }

  overlayRoot = document.createElement('div');
  overlayRoot.id = 'shrimp-coordinate-lens';
  overlayRoot.setAttribute('aria-hidden', 'true');
  overlayRoot.innerHTML = `
    <div class="shrimp-coordinate-lens__wash"></div>
    <div class="shrimp-coordinate-lens__ring"></div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #shrimp-coordinate-lens {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
      contain: strict;
      --shrimp-focus-x: 50vw;
      --shrimp-focus-y: 50vh;
      --shrimp-focus-radius-x: ${SETTINGS_DEFAULTS.focusRadiusX}px;
      --shrimp-focus-radius-y: ${SETTINGS_DEFAULTS.focusRadiusY}px;
      --shrimp-focus-inner-stop: 56%;
      --shrimp-focus-outer-stop: 100%;
      --shrimp-brightness: ${SETTINGS_DEFAULTS.brightness};
      --shrimp-contrast: ${SETTINGS_DEFAULTS.contrast};
      --shrimp-saturate: ${SETTINGS_DEFAULTS.saturate};
      --shrimp-tint: ${SETTINGS_DEFAULTS.overlayTint};
      display: none;
    }

    #shrimp-coordinate-lens.shrimp-coordinate-lens--active {
      display: block;
    }

    #shrimp-coordinate-lens .shrimp-coordinate-lens__wash {
      position: absolute;
      inset: 0;
      background: rgba(10, 14, 22, var(--shrimp-tint));
      backdrop-filter: brightness(var(--shrimp-brightness)) contrast(var(--shrimp-contrast)) saturate(var(--shrimp-saturate));
      -webkit-backdrop-filter: brightness(var(--shrimp-brightness)) contrast(var(--shrimp-contrast)) saturate(var(--shrimp-saturate));
      -webkit-mask-image: radial-gradient(
        ellipse var(--shrimp-focus-radius-x) var(--shrimp-focus-radius-y) at var(--shrimp-focus-x) var(--shrimp-focus-y),
        transparent 0,
        transparent var(--shrimp-focus-inner-stop),
        rgba(0, 0, 0, 0.25) calc(var(--shrimp-focus-inner-stop) + 3%),
        rgba(0, 0, 0, 0.92) var(--shrimp-focus-outer-stop),
        rgba(0, 0, 0, 1) 100%
      );
      mask-image: radial-gradient(
        ellipse var(--shrimp-focus-radius-x) var(--shrimp-focus-radius-y) at var(--shrimp-focus-x) var(--shrimp-focus-y),
        transparent 0,
        transparent var(--shrimp-focus-inner-stop),
        rgba(0, 0, 0, 0.25) calc(var(--shrimp-focus-inner-stop) + 3%),
        rgba(0, 0, 0, 0.92) var(--shrimp-focus-outer-stop),
        rgba(0, 0, 0, 1) 100%
      );
    }

    #shrimp-coordinate-lens .shrimp-coordinate-lens__ring {
      position: absolute;
      inset: 0;
      background: radial-gradient(
        ellipse var(--shrimp-focus-radius-x) var(--shrimp-focus-radius-y) at var(--shrimp-focus-x) var(--shrimp-focus-y),
        rgba(255, 255, 255, 0) 0,
        rgba(255, 255, 255, 0) 94%,
        rgba(255, 255, 255, 0.28) 101%,
        rgba(255, 255, 255, 0.08) 109%,
        rgba(255, 255, 255, 0) 116%
      );
      mix-blend-mode: screen;
      opacity: 0.9;
    }

    .${OUTSIDE_TEXT_CLASS} {
      color: rgba(136, 214, 154, 0.95) !important;
      -webkit-text-fill-color: rgba(136, 214, 154, 0.95) !important;
      transition: color 260ms ease-out, -webkit-text-fill-color 260ms ease-out;
    }
  `;

  document.documentElement.appendChild(style);
  document.documentElement.appendChild(overlayRoot);
  return overlayRoot;
}

async function requestCoordinate() {
  if (!settings.enabled || !settings.localUrl) {
    applyCoordinate(null);
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'fetch-coordinate',
      url: settings.localUrl,
    });

    if (!response?.ok) {
      applyCoordinate(resolvePointerCoordinate());
      return;
    }

    const coordinate = response.coordinate
      ? resolveCoordinate(response.coordinate, settings.coordinateSpace)
      : resolvePointerCoordinate();
    applyCoordinate(coordinate);
  } catch (error) {
    console.warn('Coordinate Dimming Lens request failed:', error);
    applyCoordinate(resolvePointerCoordinate());
  }
}

function trackPointer() {
  const updatePointer = (event) => {
    lastPointerCoordinate = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  window.addEventListener('pointermove', updatePointer, { passive: true, capture: true });
  window.addEventListener('pointerdown', updatePointer, { passive: true, capture: true });
  window.addEventListener('mousemove', updatePointer, { passive: true, capture: true });
}

function resolvePointerCoordinate() {
  const pointer = lastPointerCoordinate;
  const rawX = pointer ? pointer.x : window.innerWidth / 2;
  const rawY = pointer ? pointer.y : window.innerHeight / 2;

  return resolveFocusGeometry(rawX, rawY);
}

function resolveCoordinate(coordinate, coordinateSpace) {
  const rawX = clampNumber(coordinate.x, -100000, 100000, null);
  const rawY = clampNumber(coordinate.y, -100000, 100000, null);

  if (rawX === null || rawY === null) {
    return null;
  }

  let x = rawX;
  let y = rawY;
  const space = coordinateSpace === 'document' ? 'document' : coordinateSpace === 'viewport' ? 'viewport' : coordinate.space;

  if (space === 'document') {
    x -= window.scrollX;
    y -= window.scrollY;
  }

  if (space === 'auto') {
    const looksLikeDocument = x > window.innerWidth || y > window.innerHeight;
    if (looksLikeDocument) {
      x -= window.scrollX;
      y -= window.scrollY;
    }
  }

  return resolveFocusGeometry(x, y);
}

function resolveFocusGeometry(x, y) {
  const legacyRadius = clampNumber(settings.focusRadius, 40, 1600, SETTINGS_DEFAULTS.focusRadiusX);
  const radiusX = clampNumber(settings.focusRadiusX, 40, 1600, legacyRadius);
  const radiusY = clampNumber(settings.focusRadiusY, 40, 1600, legacyRadius);
  const maxFeather = Math.max(4, Math.min(radiusX, radiusY) - 2);
  const offsetX = clampNumber(settings.focusOffsetX, -3000, 3000, SETTINGS_DEFAULTS.focusOffsetX);
  const offsetY = clampNumber(settings.focusOffsetY, -3000, 3000, SETTINGS_DEFAULTS.focusOffsetY);

  return {
    x: clampNumber(x + offsetX, -100000, 100000, window.innerWidth / 2),
    y: clampNumber(y + offsetY, -100000, 100000, window.innerHeight / 2),
    radiusX,
    radiusY,
    feather: clampNumber(settings.feather, 4, Math.min(600, maxFeather), SETTINGS_DEFAULTS.feather),
  };
}

function applyCoordinate(coordinate) {
  const overlay = ensureOverlay();
  if (!overlay) {
    return;
  }

  if (!coordinate) {
    targetCoordinate = null;
    renderedCoordinate = null;
    cancelFocusAnimation();
    overlay.classList.remove('shrimp-coordinate-lens--active');
    clearOutsideTextTint();
    return;
  }

  targetCoordinate = {
    x: coordinate.x,
    y: coordinate.y,
    radiusX: coordinate.radiusX,
    radiusY: coordinate.radiusY,
    feather: coordinate.feather,
  };

  overlay.classList.add('shrimp-coordinate-lens--active');

  if (!renderedCoordinate) {
    renderedCoordinate = { ...targetCoordinate };
    applyOverlayVisualState(overlay, renderedCoordinate);
    updateOutsideTextTint(renderedCoordinate, performance.now(), true);
  }

  scheduleFocusAnimation();
}

function scheduleFocusAnimation() {
  if (animationFrameId !== null || !targetCoordinate) {
    return;
  }

  animationFrameId = window.requestAnimationFrame(stepFocusAnimation);
}

function stepFocusAnimation(timestamp) {
  animationFrameId = null;
  const overlay = ensureOverlay();
  if (!overlay || !targetCoordinate) {
    return;
  }

  if (!renderedCoordinate) {
    renderedCoordinate = { ...targetCoordinate };
  }

  const deltaMs = animationLastTimestamp > 0 ? Math.max(0, timestamp - animationLastTimestamp) : 16;
  animationLastTimestamp = timestamp;

  const transitionMs = clampNumber(settings.transitionMs, 0, 2000, SETTINGS_DEFAULTS.transitionMs);
  const alpha = transitionMs <= 0 ? 1 : 1 - Math.exp(-deltaMs / transitionMs);

  renderedCoordinate = {
    x: lerp(renderedCoordinate.x, targetCoordinate.x, alpha),
    y: lerp(renderedCoordinate.y, targetCoordinate.y, alpha),
    radiusX: lerp(renderedCoordinate.radiusX, targetCoordinate.radiusX, alpha),
    radiusY: lerp(renderedCoordinate.radiusY, targetCoordinate.radiusY, alpha),
    feather: lerp(renderedCoordinate.feather, targetCoordinate.feather, alpha),
  };

  applyOverlayVisualState(overlay, renderedCoordinate);
  updateOutsideTextTint(renderedCoordinate, timestamp, false);

  if (!isCoordinateSettled(renderedCoordinate, targetCoordinate)) {
    scheduleFocusAnimation();
    return;
  }

  renderedCoordinate = { ...targetCoordinate };
  applyOverlayVisualState(overlay, renderedCoordinate);
  updateOutsideTextTint(renderedCoordinate, timestamp, true);
}

function cancelFocusAnimation() {
  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  animationLastTimestamp = 0;
}

function applyOverlayVisualState(overlay, coordinate) {
  const radiusX = clampNumber(coordinate.radiusX, 40, 1600, SETTINGS_DEFAULTS.focusRadiusX);
  const radiusY = clampNumber(coordinate.radiusY, 40, 1600, SETTINGS_DEFAULTS.focusRadiusY);
  const maxFeather = Math.max(4, Math.min(radiusX, radiusY) - 2);
  const feather = clampNumber(coordinate.feather, 4, Math.min(600, maxFeather), SETTINGS_DEFAULTS.feather);
  const stops = resolveFeatherStops(radiusX, radiusY, feather);

  overlay.style.setProperty('--shrimp-focus-x', `${Math.round(coordinate.x)}px`);
  overlay.style.setProperty('--shrimp-focus-y', `${Math.round(coordinate.y)}px`);
  overlay.style.setProperty('--shrimp-focus-radius-x', `${Math.round(radiusX)}px`);
  overlay.style.setProperty('--shrimp-focus-radius-y', `${Math.round(radiusY)}px`);
  overlay.style.setProperty('--shrimp-focus-inner-stop', `${stops.inner.toFixed(2)}%`);
  overlay.style.setProperty('--shrimp-focus-outer-stop', `${stops.outer.toFixed(2)}%`);
  overlay.style.setProperty('--shrimp-brightness', String(clampNumber(settings.brightness, 0.5, 1.2, SETTINGS_DEFAULTS.brightness)));
  overlay.style.setProperty('--shrimp-contrast', String(clampNumber(settings.contrast, 0.5, 1.2, SETTINGS_DEFAULTS.contrast)));
  overlay.style.setProperty('--shrimp-saturate', String(clampNumber(settings.saturate, 0.5, 1.5, SETTINGS_DEFAULTS.saturate)));
  overlay.style.setProperty('--shrimp-tint', String(clampNumber(settings.overlayTint, 0, 0.35, SETTINGS_DEFAULTS.overlayTint)));
}

function resolveFeatherStops(radiusX, radiusY, feather) {
  const minRadius = Math.max(4, Math.min(radiusX, radiusY));
  const innerRaw = ((minRadius - feather) / minRadius) * 100;
  const outerRaw = ((minRadius + feather) / minRadius) * 100;

  const inner = Math.max(0, Math.min(98, innerRaw));
  const outer = Math.max(inner + 0.5, Math.min(140, outerRaw));

  return { inner, outer };
}

function isCoordinateSettled(current, target) {
  if (!current || !target) {
    return true;
  }

  const positionDelta =
    Math.abs(current.x - target.x) +
    Math.abs(current.y - target.y) +
    Math.abs(current.radiusX - target.radiusX) +
    Math.abs(current.radiusY - target.radiusY) +
    Math.abs(current.feather - target.feather);

  return positionDelta < 0.9;
}

function lerp(current, target, factor) {
  return current + (target - current) * factor;
}

function updateOutsideTextTint(coordinate, timestamp, force) {
  if (!document.body || !coordinate) {
    clearOutsideTextTint();
    return;
  }

  const now = typeof timestamp === 'number' ? timestamp : performance.now();
  if (!force && now - lastTextTintUpdateTimestamp < TEXT_TINT_UPDATE_INTERVAL_MS) {
    return;
  }

  lastTextTintUpdateTimestamp = now;
  const nextTinted = new Set();
  const textElements = collectTintCandidates(MAX_TINTED_TEXT_ELEMENTS);

  for (const element of textElements) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    if (isElementOutsideFocus(rect, coordinate)) {
      nextTinted.add(element);
    }
  }

  for (const element of outsideTintedElements) {
    if (nextTinted.has(element)) {
      continue;
    }

    if (element.isConnected) {
      element.classList.remove(OUTSIDE_TEXT_CLASS);
    }
  }

  for (const element of nextTinted) {
    if (!outsideTintedElements.has(element)) {
      element.classList.add(OUTSIDE_TEXT_CLASS);
    }
  }

  outsideTintedElements = nextTinted;
}

function clearOutsideTextTint() {
  for (const element of outsideTintedElements) {
    if (element.isConnected) {
      element.classList.remove(OUTSIDE_TEXT_CLASS);
    }
  }

  outsideTintedElements = new Set();
  lastTextTintUpdateTimestamp = 0;
}

function collectTintCandidates(limit) {
  const candidates = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  while (candidates.size < limit) {
    const node = walker.nextNode();
    if (!node) {
      break;
    }

    if (!node.nodeValue || !node.nodeValue.trim()) {
      continue;
    }

    const parent = node.parentElement;
    if (!isTintEligibleElement(parent)) {
      continue;
    }

    candidates.add(parent);
  }

  return candidates;
}

function isTintEligibleElement(element) {
  if (!element || !element.isConnected) {
    return false;
  }

  if (element.classList.contains(OUTSIDE_TEXT_CLASS)) {
    return true;
  }

  if (EXCLUDED_TINT_TAGS.has(element.tagName)) {
    return false;
  }

  if (element.closest('#shrimp-coordinate-lens')) {
    return false;
  }

  const computed = window.getComputedStyle(element);
  if (computed.display === 'none' || computed.visibility === 'hidden' || Number(computed.opacity) === 0) {
    return false;
  }

  return true;
}

function isElementOutsideFocus(rect, coordinate) {
  const nearestX = Math.max(rect.left, Math.min(coordinate.x, rect.right));
  const nearestY = Math.max(rect.top, Math.min(coordinate.y, rect.bottom));
  const dx = nearestX - coordinate.x;
  const dy = nearestY - coordinate.y;
  const radiusX = Math.max(4, coordinate.radiusX);
  const radiusY = Math.max(4, coordinate.radiusY);
  const normalizedDistance = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);

  return normalizedDistance > 1;
}

function normalizeSettings(rawSettings) {
  const source = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  const legacyRadius = clampNumber(source.focusRadius, 40, 1600, SETTINGS_DEFAULTS.focusRadiusX);
  const focusRadiusX = clampNumber(source.focusRadiusX, 40, 1600, legacyRadius);
  const focusRadiusY = clampNumber(source.focusRadiusY, 40, 1600, legacyRadius);
  const maxFeather = Math.max(4, Math.min(focusRadiusX, focusRadiusY) - 2);

  return {
    ...SETTINGS_DEFAULTS,
    ...source,
    focusRadiusX,
    focusRadiusY,
    focusOffsetX: clampNumber(source.focusOffsetX, -3000, 3000, SETTINGS_DEFAULTS.focusOffsetX),
    focusOffsetY: clampNumber(source.focusOffsetY, -3000, 3000, SETTINGS_DEFAULTS.focusOffsetY),
    feather: clampNumber(source.feather, 4, Math.min(600, maxFeather), SETTINGS_DEFAULTS.feather),
    transitionMs: clampNumber(source.transitionMs, 0, 2000, SETTINGS_DEFAULTS.transitionMs),
    brightness: clampNumber(source.brightness, 0.5, 1.2, SETTINGS_DEFAULTS.brightness),
    contrast: clampNumber(source.contrast, 0.5, 1.2, SETTINGS_DEFAULTS.contrast),
    saturate: clampNumber(source.saturate, 0.5, 1.5, SETTINGS_DEFAULTS.saturate),
    overlayTint: clampNumber(source.overlayTint, 0, 0.35, SETTINGS_DEFAULTS.overlayTint),
    pollInterval: clampNumber(source.pollInterval, 300, 10000, SETTINGS_DEFAULTS.pollInterval),
  };
}

function clampNumber(value, min, max, fallback) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}