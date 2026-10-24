// Canvas helpers: place a product on a background at the size and fill % a marketplace wants,
// export within file-size limits, and check the result against the preset.

const ALPHA_THRESHOLD = 16;

export function imageToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas;
}

// Bounding box of non-transparent pixels, so empty space around the product is ignored.
export function findProductBounds(canvas) {
  const { width, height } = canvas;
  const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: width, h: height };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function compose(product, bounds, preset, { background, shadow }) {
  const canvas = document.createElement('canvas');
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scale = Math.min(
    (canvas.width * preset.fill) / bounds.w,
    (canvas.height * preset.fill) / bounds.h,
  );
  const w = Math.round(bounds.w * scale);
  const h = Math.round(bounds.h * scale);
  const x = Math.round((canvas.width - w) / 2);
  const y = Math.round((canvas.height - h) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = Math.round(canvas.width * 0.02);
    ctx.shadowOffsetY = Math.round(canvas.height * 0.01);
    ctx.drawImage(product, bounds.x, bounds.y, bounds.w, bounds.h, x, y, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(product, bounds.x, bounds.y, bounds.w, bounds.h, x, y, w, h);
  }
  return { canvas, placed: { w, h } };
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Highest JPEG quality that still fits under maxBytes (binary search).
export async function exportWithinLimit(canvas, preset) {
  let best = await toBlob(canvas, preset.format, 0.95);
  if (best.size <= preset.maxBytes) return best;
  let lo = 0.3, hi = 0.95;
  best = await toBlob(canvas, preset.format, lo);
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2;
    const blob = await toBlob(canvas, preset.format, mid);
    if (blob.size <= preset.maxBytes) { best = blob; lo = mid; } else { hi = mid; }
  }
  return best;
}

function isPureWhiteBorder(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const strips = [
    ctx.getImageData(0, 0, width, 2).data,
    ctx.getImageData(0, height - 2, width, 2).data,
    ctx.getImageData(0, 0, 2, height).data,
    ctx.getImageData(width - 2, 0, 2, height).data,
  ];
  return strips.every((d) => {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) return false;
    }
    return true;
  });
}

const fmtKB = (bytes) => `${Math.round(bytes / 1024)} KB`;

export function checkCompliance(canvas, blob, placed, preset) {
  const checks = [];
  const longSide = Math.max(canvas.width, canvas.height);
  checks.push({
    ok: longSide >= preset.minLongSide,
    label: `Size ${canvas.width}×${canvas.height} (min ${preset.minLongSide}px)`,
  });

  const fill = Math.max(placed.w / canvas.width, placed.h / canvas.height);
  checks.push({
    ok: fill >= preset.fill - 0.02,
    label: `Product fills ${Math.round(fill * 100)}% (target ${Math.round(preset.fill * 100)}%)`,
  });

  if (preset.forceBackground) {
    checks.push({ ok: isPureWhiteBorder(canvas), label: 'Pure white background' });
  }

  const sizeOk = blob.size <= preset.maxBytes;
  const aboveMin = blob.size >= preset.minBytes;
  checks.push({
    ok: sizeOk && aboveMin,
    warn: sizeOk && !aboveMin,
    label: preset.minBytes
      ? `File ${fmtKB(blob.size)} (allowed ${fmtKB(preset.minBytes)}–${fmtKB(preset.maxBytes)})`
      : `File ${fmtKB(blob.size)} (max ${fmtKB(preset.maxBytes)})`,
  });
  return checks;
}
