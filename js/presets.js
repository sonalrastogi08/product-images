// Marketplace image rules. Keep all platform rules here so a rule change is a one-file edit.
// `verified: false` means the numbers come from secondary sources — confirm on the seller portal.

export const PRESETS = {
  amazon: {
    name: 'Amazon',
    width: 2000,
    height: 2000,
    fill: 0.85,              // product should cover ~85% of the frame
    background: '#ffffff',   // main image must be pure white
    forceBackground: true,
    format: 'image/jpeg',
    minLongSide: 1000,
    maxBytes: 10 * 1024 * 1024,
    minBytes: 0,
    fileName: (sku) => `${sku}.MAIN.jpg`,
    notes: 'Pure white (255,255,255) background, product fills ~85%, min 1000px longest side.',
    verified: true,
  },
  flipkart: {
    name: 'Flipkart',
    width: 1500,
    height: 1500,
    fill: 0.85,
    background: '#ffffff',
    forceBackground: true,
    format: 'image/jpeg',
    minLongSide: 500,
    maxBytes: 5 * 1024 * 1024,
    minBytes: 0,
    fileName: (sku) => `${sku}_1.jpg`,
    notes: 'White background, square. Exact specs not confirmed from official docs.',
    verified: false,
  },
  meesho: {
    name: 'Meesho',
    width: 1000,
    height: 1000,
    fill: 0.85,
    background: '#ffffff',
    forceBackground: false,  // plain, uncluttered background — any solid colour works
    format: 'image/jpeg',
    minLongSide: 500,
    maxBytes: 5 * 1024 * 1024,
    minBytes: 0,
    fileName: (sku) => `${sku}_1.jpg`,
    notes: 'Square 1:1, plain background, solo product, no text/watermark. Pixel size not confirmed.',
    verified: false,
  },
  myntra: {
    name: 'Myntra',
    width: 1080,
    height: 1440,
    fill: 0.9,
    background: '#ffffff',
    forceBackground: false,  // white or light grey
    format: 'image/jpeg',
    minLongSide: 1440,
    maxBytes: 1024 * 1024,
    minBytes: 500 * 1024,
    fileName: (sku) => `${sku}_1.jpg`,
    notes: '3:4 ratio, min 1080×1440, JPEG 500KB–1MB, white or light grey background.',
    verified: true,
  },
};
