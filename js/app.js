import { PRESETS } from './presets.js?v=3';
import { removeBackground } from './bg-removal.js?v=3';
import {
  imageToCanvas, findProductBounds, compose, exportWithinLimit, checkCompliance,
} from './compose.js?v=3';

const $ = (sel) => document.querySelector(sel);

const state = {
  imageUrl: null,
  original: null,   // canvas of the uploaded photo
  cutout: null,     // canvas with transparent background, once removed
  outputs: [],      // { key, preset, blob, url, checks }
};

const fileInput = $('#file');
const dropZone = $('#drop');
const status = $('#status');
const removeBtn = $('#remove-bg');
const generateBtn = $('#generate');
const zipBtn = $('#download-zip');
const results = $('#results');

function setStatus(text, kind = '') {
  status.textContent = text;
  status.dataset.kind = kind;
}

function renderPlatformOptions() {
  $('#platforms').innerHTML = Object.entries(PRESETS).map(([key, p]) => `
    <label class="chip">
      <input type="checkbox" name="platform" value="${key}" checked>
      <span>${p.name}${p.verified ? '' : ' <small title="Specs not confirmed from official docs">*</small>'}</span>
    </label>`).join('');
}

function hasTransparency(canvas) {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return true;
  }
  return false;
}

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('Please choose a JPG, PNG or WebP image.', 'error');
    return;
  }
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = URL.createObjectURL(file);
  state.cutout = null;
  const img = new Image();
  img.onload = () => {
    state.original = imageToCanvas(img);
    $('#preview').src = state.imageUrl;
    $('#editor').hidden = false;
    generateBtn.disabled = false;
    // A PNG that already has a transparent background needs no removal step.
    if (hasTransparency(state.original)) {
      state.cutout = state.original;
      $('#preview').classList.add('checker');
      removeBtn.disabled = true;
      setStatus('This image already has a transparent background. Choose platforms and generate.', 'ok');
    } else {
      $('#preview').classList.remove('checker');
      removeBtn.disabled = false;
      setStatus(`Loaded ${img.naturalWidth}×${img.naturalHeight}. Remove the background, then generate.`);
    }
  };
  img.onerror = () => setStatus('Could not read this image. iPhone HEIC photos are not supported yet — export as JPG.', 'error');
  img.src = state.imageUrl;
}

fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('over');
  loadFile(e.dataTransfer.files[0]);
});

removeBtn.addEventListener('click', async () => {
  removeBtn.disabled = true;
  generateBtn.disabled = true;
  const started = performance.now();
  try {
    state.cutout = await removeBackground(state.imageUrl, (s) => setStatus(s));
    $('#preview').src = state.cutout.toDataURL('image/png');
    $('#preview').classList.add('checker');
    const secs = ((performance.now() - started) / 1000).toFixed(1);
    setStatus(`Background removed in ${secs}s. Now choose platforms and generate.`, 'ok');
  } catch (err) {
    console.error(err);
    setStatus(`Background removal failed: ${err.message}. You can still generate using the original photo.`, 'error');
    removeBtn.disabled = false;
  }
  generateBtn.disabled = false;
});

function selectedPlatforms() {
  return [...document.querySelectorAll('input[name=platform]:checked')].map((el) => el.value);
}

function sanitizeSku(value) {
  return (value.trim() || 'product').replace(/[^A-Za-z0-9_-]/g, '-');
}

generateBtn.addEventListener('click', async () => {
  const keys = selectedPlatforms();
  if (!keys.length) { setStatus('Select at least one platform.', 'error'); return; }

  generateBtn.disabled = true;
  setStatus('Generating images…');
  state.outputs.forEach((o) => URL.revokeObjectURL(o.url));
  state.outputs = [];

  const source = state.cutout || state.original;
  const bounds = state.cutout ? findProductBounds(source) : { x: 0, y: 0, w: source.width, h: source.height };
  const chosenBg = $('#bg-color').value;
  const shadow = $('#shadow').checked && !!state.cutout;

  for (const key of keys) {
    const preset = PRESETS[key];
    const background = preset.forceBackground ? preset.background : chosenBg;
    const { canvas, placed } = compose(source, bounds, preset, { background, shadow });
    const blob = await exportWithinLimit(canvas, preset);
    const checks = checkCompliance(canvas, blob, placed, preset);
    state.outputs.push({ key, preset, blob, url: URL.createObjectURL(blob), checks });
  }

  renderResults();
  zipBtn.disabled = false;
  generateBtn.disabled = false;
  setStatus(`Generated ${state.outputs.length} image(s).`, 'ok');
});

function renderResults() {
  const sku = sanitizeSku($('#sku').value);
  results.innerHTML = state.outputs.map((o) => {
    const allOk = o.checks.every((c) => c.ok);
    const checks = o.checks.map((c) => `
      <li class="${c.ok ? 'ok' : c.warn ? 'warn' : 'fail'}">${c.ok ? '✓' : c.warn ? '!' : '✗'} ${c.label}</li>`).join('');
    return `
      <article class="card">
        <header>
          <h3>${o.preset.name}</h3>
          <span class="badge ${allOk ? 'ok' : 'warn'}">${allOk ? 'Ready' : 'Check'}</span>
        </header>
        <img src="${o.url}" alt="${o.preset.name} output" style="aspect-ratio:${o.preset.width}/${o.preset.height}">
        <ul class="checks">${checks}</ul>
        <p class="note">${o.preset.notes}</p>
        <a class="btn secondary" href="${o.url}" download="${o.preset.fileName(sku)}">Download</a>
      </article>`;
  }).join('');
}

zipBtn.addEventListener('click', async () => {
  const sku = sanitizeSku($('#sku').value);
  const zip = new window.JSZip();
  for (const o of state.outputs) {
    zip.folder(o.preset.name).file(o.preset.fileName(sku), o.blob);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${sku}-listing-images.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

renderPlatformOptions();
