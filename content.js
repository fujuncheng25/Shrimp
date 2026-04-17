const SETTINGS_DEFAULTS = {
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

let settings = { ...SETTINGS_DEFAULTS };
let overlayRoot = null;
let pollTimer = null;
let lastPointerCoordinate = null;

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
        settings = { ...settings, ...message.settings };
        refreshPolling();
      }
    });
  }
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(SETTINGS_DEFAULTS, (stored) => {
      resolve({ ...SETTINGS_DEFAULTS, ...stored });
    });
  });
}

function handleStorageChange(changes, areaName) {
  if (areaName !== 'sync') {
    return;
  }

  const updated = {};
  for (const [key, change] of Object.entries(changes)) {
    if (Object.prototype.hasOwnProperty.call(SETTINGS_DEFAULTS, key)) {
      updated[key] = change.newValue;
    }
  }

  if (Object.keys(updated).length === 0) {
    return;
  }

  settings = { ...settings, ...updated };
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
      --shrimp-focus-radius: ${SETTINGS_DEFAULTS.focusRadius}px;
      --shrimp-focus-feather: ${SETTINGS_DEFAULTS.feather}px;
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
        circle at var(--shrimp-focus-x) var(--shrimp-focus-y),
        transparent 0,
        transparent calc(var(--shrimp-focus-radius) - var(--shrimp-focus-feather)),
        rgba(0, 0, 0, 0.25) calc(var(--shrimp-focus-radius) - 12px),
        rgba(0, 0, 0, 0.92) calc(var(--shrimp-focus-radius) + var(--shrimp-focus-feather)),
        rgba(0, 0, 0, 1) 100%
      );
      mask-image: radial-gradient(
        circle at var(--shrimp-focus-x) var(--shrimp-focus-y),
        transparent 0,
        transparent calc(var(--shrimp-focus-radius) - var(--shrimp-focus-feather)),
        rgba(0, 0, 0, 0.25) calc(var(--shrimp-focus-radius) - 12px),
        rgba(0, 0, 0, 0.92) calc(var(--shrimp-focus-radius) + var(--shrimp-focus-feather)),
        rgba(0, 0, 0, 1) 100%
      );
    }

    #shrimp-coordinate-lens .shrimp-coordinate-lens__ring {
      position: absolute;
      inset: 0;
      background: radial-gradient(
        circle at var(--shrimp-focus-x) var(--shrimp-focus-y),
        rgba(255, 255, 255, 0) 0,
        rgba(255, 255, 255, 0) calc(var(--shrimp-focus-radius) - 6px),
        rgba(255, 255, 255, 0.28) calc(var(--shrimp-focus-radius) + 2px),
        rgba(255, 255, 255, 0.08) calc(var(--shrimp-focus-radius) + 20px),
        rgba(255, 255, 255, 0) calc(var(--shrimp-focus-radius) + 36px)
      );
      mix-blend-mode: screen;
      opacity: 0.9;
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
      return;
    }

    const coordinate = response.coordinate
      ? resolveCoordinate(response.coordinate, settings.coordinateSpace)
      : resolvePointerCoordinate();
    applyCoordinate(coordinate);
  } catch (error) {
    console.warn('Coordinate Dimming Lens request failed:', error);
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
  if (!pointer) {
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      radius: clampNumber(settings.focusRadius, 40, 1200, SETTINGS_DEFAULTS.focusRadius),
      feather: clampNumber(settings.feather, 4, 400, SETTINGS_DEFAULTS.feather),
    };
  }

  return {
    x: clampNumber(pointer.x, -100000, 100000, window.innerWidth / 2),
    y: clampNumber(pointer.y, -100000, 100000, window.innerHeight / 2),
    radius: clampNumber(settings.focusRadius, 40, 1200, SETTINGS_DEFAULTS.focusRadius),
    feather: clampNumber(settings.feather, 4, 400, SETTINGS_DEFAULTS.feather),
  };
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

  return {
    x,
    y,
    radius: clampNumber(settings.focusRadius, 40, 1200, SETTINGS_DEFAULTS.focusRadius),
    feather: clampNumber(settings.feather, 4, 400, SETTINGS_DEFAULTS.feather),
  };
}

function applyCoordinate(coordinate) {
  const overlay = ensureOverlay();
  if (!overlay) {
    return;
  }

  if (!coordinate) {
    overlay.classList.remove('shrimp-coordinate-lens--active');
    return;
  }

  overlay.classList.add('shrimp-coordinate-lens--active');
  overlay.style.setProperty('--shrimp-focus-x', `${Math.round(coordinate.x)}px`);
  overlay.style.setProperty('--shrimp-focus-y', `${Math.round(coordinate.y)}px`);
  overlay.style.setProperty('--shrimp-focus-radius', `${Math.round(coordinate.radius)}px`);
  overlay.style.setProperty('--shrimp-focus-feather', `${Math.round(coordinate.feather)}px`);
  overlay.style.setProperty('--shrimp-brightness', String(clampNumber(settings.brightness, 0.5, 1.2, SETTINGS_DEFAULTS.brightness)));
  overlay.style.setProperty('--shrimp-contrast', String(clampNumber(settings.contrast, 0.5, 1.2, SETTINGS_DEFAULTS.contrast)));
  overlay.style.setProperty('--shrimp-saturate', String(clampNumber(settings.saturate, 0.5, 1.5, SETTINGS_DEFAULTS.saturate)));
  overlay.style.setProperty('--shrimp-tint', String(clampNumber(settings.overlayTint, 0, 0.35, SETTINGS_DEFAULTS.overlayTint)));
}

function clampNumber(value, min, max, fallback) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}