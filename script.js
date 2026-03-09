const sourceEl = document.getElementById('sourceText');
const outputEl = document.getElementById('outputText');
const loopsEl = document.getElementById('loops');
const poolSizeEl = document.getElementById('poolSize');
const statusEl = document.getElementById('status');
const translateBtn = document.getElementById('translateBtn');
const stopBtn = document.getElementById('stopBtn');

const HOT_LANGS = [
  'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'tr', 'ar',
  'id', 'vi', 'th', 'zh-CN', 'zh-TW', 'uk', 'ro', 'cs', 'el', 'sv', 'fi',
  'da', 'no', 'hu', 'he', 'hi', 'ms', 'bg'
];

let running = false;
let controller = null;

const setStatus = (message, isError = false) => {
  statusEl.textContent = message;
  statusEl.style.borderLeftColor = isError ? 'var(--danger)' : 'var(--accent)';
};

const buildPath = (loops, source) => {
  const poolSize = Math.min(Math.max(Number(poolSizeEl.value) || 12, 3), HOT_LANGS.length);
  const pool = HOT_LANGS.slice(0, poolSize).filter((l) => l !== source);
  const path = [];

  for (let i = 0; i < loops; i += 1) {
    path.push(pool[i % pool.length]);
  }

  return path;
};

const translate = async (text, from, to) => {
  const endpoint = new URL('https://translate.googleapis.com/translate_a/single');
  endpoint.searchParams.set('client', 'gtx');
  endpoint.searchParams.set('sl', from);
  endpoint.searchParams.set('tl', to);
  endpoint.searchParams.set('dt', 't');
  endpoint.searchParams.set('q', text);

  const response = await fetch(endpoint, {
    method: 'GET',
    cache: 'no-store',
    signal: controller.signal
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  const translated = (data?.[0] || []).map((chunk) => chunk?.[0] || '').join('');
  const detected = data?.[2] || from;

  return { translated, detected };
};

const setRunning = (isRunning) => {
  running = isRunning;
  translateBtn.disabled = isRunning;
  stopBtn.disabled = !isRunning;
};

const runRoundTrip = async () => {
  const input = sourceEl.value.trim();
  const loops = Math.min(Math.max(Number(loopsEl.value) || 1, 1), 80);

  if (!input) {
    setStatus('Please enter text first.', true);
    return;
  }

  controller = new AbortController();
  setRunning(true);
  outputEl.value = '';

  try {
    setStatus('Detecting source language...');
    const first = await translate(input, 'auto', 'en');
    const sourceLang = first.detected || 'auto';

    let current = input;
    const path = buildPath(loops, sourceLang);

    for (let i = 0; i < path.length; i += 1) {
      const target = path[i];
      setStatus(`Round ${i + 1}/${loops}: ${sourceLang} -> ${target}`);
      const step = await translate(current, i === 0 ? sourceLang : path[i - 1], target);
      current = step.translated;
    }

    setStatus(`Returning to original language: ${sourceLang}`);
    const final = await translate(current, path[path.length - 1] || sourceLang, sourceLang);

    outputEl.value = final.translated;
    setStatus(`Done in ${loops + 2} requests. Source language: ${sourceLang}.`);
  } catch (error) {
    if (error.name === 'AbortError') {
      setStatus('Stopped.', true);
    } else {
      setStatus(`Translation failed: ${error.message}`, true);
    }
  } finally {
    setRunning(false);
    controller = null;
  }
};

translateBtn.addEventListener('click', () => {
  if (!running) runRoundTrip();
});

stopBtn.addEventListener('click', () => {
  if (controller) controller.abort();
});
