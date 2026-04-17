const DEFAULT_TIMEOUT_MS = 3000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'fetch-coordinate') {
    return false;
  }

  const url = typeof message.url === 'string' ? message.url.trim() : '';
  if (!url) {
    sendResponse({ ok: false, error: 'missing-url' });
    return false;
  }

  fetchCoordinate(url)
    .then((result) => sendResponse(result))
    .catch((error) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });

  return true;
});

async function fetchCoordinate(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, error: `http-${response.status}` };
    }

    const rawText = await response.text();
    const parsed = parseCoordinatePayload(rawText, response.headers.get('content-type'));

    if (!parsed) {
      return { ok: true, coordinate: null, raw: rawText, fallback: 'cursor' };
    }

    return { ok: true, coordinate: parsed.coordinate, raw: parsed.raw, fallback: 'cursor' };
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseCoordinatePayload(text, contentType) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return null;
  }

  let payload = trimmed;
  if (!contentType || contentType.includes('json') || looksLikeJson(trimmed)) {
    try {
      payload = JSON.parse(trimmed);
    } catch {
      payload = trimmed;
    }
  }

  const coordinate = extractCoordinate(payload);
  if (!coordinate) {
    return null;
  }

  return { coordinate, raw: payload };
}

function looksLikeJson(text) {
  return (text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'));
}

function extractCoordinate(payload) {
  if (Array.isArray(payload) && payload.length >= 2) {
    const x = toNumber(payload[0]);
    const y = toNumber(payload[1]);
    if (x !== null && y !== null) {
      return normalizeCoordinate({ x, y, space: 'viewport' });
    }
  }

  if (typeof payload === 'string') {
    const match = payload.match(/(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)/);
    if (match) {
      const x = toNumber(match[1]);
      const y = toNumber(match[2]);
      if (x !== null && y !== null) {
        return normalizeCoordinate({ x, y, space: 'viewport' });
      }
    }
    return null;
  }

  if (payload && typeof payload === 'object') {
    if (payload.coordinate) {
      const nested = extractCoordinate(payload.coordinate);
      if (nested) {
        return nested;
      }
    }

    if (payload.point) {
      const nested = extractCoordinate(payload.point);
      if (nested) {
        return nested;
      }
    }

    const xValue = payload.x ?? payload.clientX ?? payload.pageX;
    const yValue = payload.y ?? payload.clientY ?? payload.pageY;
    const x = toNumber(xValue);
    const y = toNumber(yValue);

    if (x !== null && y !== null) {
      const space = payload.relativeTo === 'document' || payload.space === 'document' || payload.mode === 'document' ? 'document' : 'viewport';
      return normalizeCoordinate({ x, y, space });
    }
  }

  return null;
}

function normalizeCoordinate(coordinate) {
  if (!coordinate) {
    return null;
  }

  const x = Number.isFinite(coordinate.x) ? coordinate.x : null;
  const y = Number.isFinite(coordinate.y) ? coordinate.y : null;

  if (x === null || y === null) {
    return null;
  }

  return {
    x,
    y,
    space: coordinate.space === 'document' ? 'document' : 'viewport',
  };
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}