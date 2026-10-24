// Background removal that runs entirely in the user's browser.
// The model is downloaded once and cached by the browser; no image ever leaves the device.

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';
const MODEL_ID = 'onnx-community/BiRefNet_lite-ONNX';
const GPU_BROKEN_KEY = 'bgRemoval.webgpuFailed';

let segmenterPromise = null;

function gpuMarkedBroken() {
  try { return localStorage.getItem(GPU_BROKEN_KEY) === '1'; } catch { return false; }
}

function markGpuBroken() {
  try { localStorage.setItem(GPU_BROKEN_KEY, '1'); } catch { /* storage unavailable */ }
}

async function hasWebGPU() {
  if (!navigator.gpu || gpuMarkedBroken()) return false;
  try {
    return !!(await navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

async function createSegmenter(onStatus, { allowGpu = true } = {}) {
  const { pipeline } = await import(TRANSFORMERS_URL);
  const gpu = allowGpu && await hasWebGPU();

  // Try the fastest option first, then fall back to plain CPU (WASM).
  const attempts = gpu
    ? [{ device: 'webgpu', dtype: 'fp16' }, { device: 'webgpu', dtype: 'fp32' }]
    : [];
  attempts.push({ device: 'wasm', dtype: 'q8' }, { device: 'wasm', dtype: 'fp32' });

  const failures = [];
  for (const opts of attempts) {
    try {
      onStatus?.(`Loading model (${opts.device}, ${opts.dtype})… first time may take a minute`);
      const segmenter = await pipeline('background-removal', MODEL_ID, {
        ...opts,
        progress_callback: (p) => {
          if (p.status === 'progress' && p.total) {
            const mb = (n) => (n / 1048576).toFixed(0);
            onStatus?.(`Downloading model: ${mb(p.loaded)} / ${mb(p.total)} MB`);
          }
        },
      });
      return { segmenter, device: opts.device, dtype: opts.dtype };
    } catch (err) {
      console.warn('Model load failed for', opts, err);
      failures.push(`[${opts.device}/${opts.dtype}] ${err?.message || err}`);
    }
  }
  throw new Error(`Model could not load. ${failures.join(' · ')}`);
}

export function loadSegmenter(onStatus, options) {
  if (!segmenterPromise) {
    segmenterPromise = createSegmenter(onStatus, options).catch((err) => {
      segmenterPromise = null; // allow retry
      throw err;
    });
  }
  return segmenterPromise;
}

async function loadOrExplain(onStatus, options) {
  try {
    return await loadSegmenter(onStatus, options);
  } catch (err) {
    // Distinguish "library didn't load" from "model didn't load".
    try { await import(TRANSFORMERS_URL); } catch {
      throw new Error(`AI library could not load from CDN (${err.message})`);
    }
    throw err;
  }
}

// Returns a canvas with the product cut out (transparent background).
export async function removeBackground(imageUrl, onStatus) {
  let { segmenter, device, dtype } = await loadOrExplain(onStatus);
  onStatus?.(`Removing background (${device}, ${dtype})…`);
  try {
    return (await segmenter(imageUrl)).toCanvas();
  } catch (err) {
    if (device !== 'webgpu') throw err;
    // Some GPUs load the model but can't run it (e.g. too few storage buffers).
    // Remember that and retry on the CPU.
    console.warn('WebGPU inference failed, falling back to WASM', err);
    markGpuBroken();
    segmenterPromise = null;
    ({ segmenter, device, dtype } = await loadOrExplain(onStatus, { allowGpu: false }));
    onStatus?.(`Removing background on CPU (${dtype})… this can take a little longer`);
    return (await segmenter(imageUrl)).toCanvas();
  }
}
