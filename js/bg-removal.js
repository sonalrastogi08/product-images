// Background removal that runs entirely in the user's browser.
// The model is downloaded once and cached by the browser; no image ever leaves the device.

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';
const MODEL_ID = 'onnx-community/BiRefNet_lite-ONNX';

let segmenterPromise = null;

async function hasWebGPU() {
  if (!navigator.gpu) return false;
  try {
    return !!(await navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

async function createSegmenter(onStatus) {
  const { pipeline } = await import(TRANSFORMERS_URL);
  const gpu = await hasWebGPU();

  // Try the fastest option first, then fall back to plain CPU (WASM).
  const attempts = gpu
    ? [{ device: 'webgpu', dtype: 'fp16' }, { device: 'webgpu', dtype: 'fp32' }, { device: 'wasm', dtype: 'fp32' }]
    : [{ device: 'wasm', dtype: 'q8' }, { device: 'wasm', dtype: 'fp32' }];

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

export function loadSegmenter(onStatus) {
  if (!segmenterPromise) {
    segmenterPromise = createSegmenter(onStatus).catch((err) => {
      segmenterPromise = null; // allow retry
      throw err;
    });
  }
  return segmenterPromise;
}

// Returns a canvas with the product cut out (transparent background).
export async function removeBackground(imageUrl, onStatus) {
  let transformersOk = true;
  const { segmenter, device, dtype } = await loadSegmenter(onStatus).catch(async (err) => {
    // Distinguish "library didn't load" from "model didn't load".
    try { await import(TRANSFORMERS_URL); } catch { transformersOk = false; }
    throw transformersOk ? err : new Error(`AI library could not load from CDN (${err.message})`);
  });
  onStatus?.(`Removing background (${device}, ${dtype})…`);
  const result = await segmenter(imageUrl);
  return result.toCanvas();
}
