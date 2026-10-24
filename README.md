# ListingReady (prototype)

Upload one product photo → remove background → get images sized for Amazon, Flipkart, Meesho and Myntra, with a compliance check and a ZIP download.

Everything runs **in the browser**. Photos never leave the user's device, and there is no server to pay for.

## How it works

| Part | File | Notes |
|---|---|---|
| Platform rules | `js/presets.js` | Size, fill %, background, file-size limits, file naming. Edit here when a marketplace changes its rules. |
| Background removal | `js/bg-removal.js` | [BiRefNet_lite](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX) through [Transformers.js](https://github.com/huggingface/transformers.js). Uses WebGPU when available, falls back to WASM. The model downloads once and is cached by the browser. |
| Resize / place / export / checks | `js/compose.js` | Canvas only, no AI. |
| UI | `index.html`, `styles.css`, `js/app.js` | Plain HTML/CSS/JS, no build step. |
| ZIP | `vendor/jszip.min.js` | JSZip 3.10.1 (MIT). |

Uploading a PNG that is already transparent skips the background-removal step.

## Run locally

ES modules don't load from `file://`, so serve the folder:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy free on Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick this repo.
2. Framework preset: **None**. Build command: *(empty)*. Output directory: `/`.
3. Deploy, then add your domain under **Custom domains**.

## Before launch

- Confirm the BiRefNet_lite model licence on its model card / upstream repo.
- Confirm Flipkart and Meesho specs (marked `verified: false` in `js/presets.js`).
- Test background-removal speed and quality on a low-end Android phone.

See `docs/market-research.md` for the market research.
