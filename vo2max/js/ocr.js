/*
 * Client-side OCR via Tesseract.js, loaded from a CDN at call time — it's a
 * multi-megabyte WASM + trained-data payload, not worth bundling into this
 * otherwise dependency-free app. Recognition runs entirely in the browser
 * (nothing is uploaded anywhere); only the first use needs a network
 * connection to fetch the engine, after which the browser's own HTTP cache
 * keeps it fast.
 */

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js';

const STATUS_LABELS = {
  'loading tesseract core': 'Loading OCR engine',
  'initializing tesseract': 'Starting',
  'loading language traineddata': 'Downloading language data',
  'initializing api': 'Preparing',
  'recognizing text': 'Reading photo',
};

let tesseractModulePromise = null;
function loadTesseract() {
  if (!tesseractModulePromise) tesseractModulePromise = import(TESSERACT_CDN);
  return tesseractModulePromise;
}

/**
 * Runs OCR on an image and returns the raw recognized text.
 * @param {File|Blob} image
 * @param {(label: string, percent: number|null) => void} [onProgress]
 */
export async function recognizeImageText(image, onProgress) {
  const { createWorker } = await loadTesseract();
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (!onProgress) return;
      const label = STATUS_LABELS[m.status] ?? m.status;
      onProgress(label, typeof m.progress === 'number' ? Math.round(m.progress * 100) : null);
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
