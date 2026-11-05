/**
 * Client-side PDF text extraction using pdfjs-dist.
 * - Selectable-text PDFs are read directly from the text layer.
 * - Scanned / image-only PDFs are run through Tesseract.js OCR in-browser
 *   (lazy-loaded; no API keys). OCR is applied per-page only when a page has
 *   no readable text layer, capped to keep processing time reasonable.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { DocumentContext } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const PDF_MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_PAGES = 120;
const MAX_CHARS_PER_PAGE = 4000;
const MAX_TOTAL_CHARS = 20000;

/** Minimum text-layer characters before we consider a page "scanned". */
const TEXT_LAYER_MIN_CHARS = 32;
/** Max pages OCR'd in one run (sequential, slow). */
const MAX_OCR_PAGES = 20;
/** Render scale for OCR (~2x ≈ 144 DPI on letter). */
const OCR_RENDER_SCALE = 2;

export class PdfExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfExtractionError';
  }
}

export interface PdfExtractionResult extends DocumentContext {
  totalPages: number;
  truncated: boolean;
  extractedCharacters: number;
  /** True when at least one page was OCR'd (scanned content). */
  ocrApplied: boolean;
  /** Page numbers (1-based) that were OCR'd. */
  ocrPages: number[];
}

/* ---------------- OCR (Tesseract.js, lazy) ---------------- */

type TesseractWorker = {
  recognize: (image: string | HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
};

let ocrWorkerPromise: Promise<TesseractWorker> | null = null;

async function getOcrWorker(): Promise<TesseractWorker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      // Dynamic import keeps tesseract.js + its wasm out of the main bundle.
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: () => {},
      });
      return worker as unknown as TesseractWorker;
    })();
    // Reset the cached worker if it ever throws so future runs retry.
    ocrWorkerPromise.catch(() => {
      ocrWorkerPromise = null;
    });
  }
  return ocrWorkerPromise;
}

async function renderPageToCanvas(page: pdfjsLib.PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return canvas;
}

async function ocrPageText(page: pdfjsLib.PDFPageProxy): Promise<string> {
  const canvas = await renderPageToCanvas(page, OCR_RENDER_SCALE);
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(canvas);
  return (data.text || '').replace(/\s{3,}/g, '  ').trim();
}

/* ---------------- Extraction ---------------- */

function joinTextLayer(textContent: unknown): string {
  const items = (textContent as { items?: Array<{ str?: unknown }> }).items ?? [];
  let text = '';
  for (const item of items) {
    const str = typeof item.str === 'string' ? item.str : '';
    if (!str) continue;
    if (text.length > 0 && !/\s$/.test(text) && !/^[\s,.;:!?)]/.test(str)) {
      text += ' ';
    }
    text += str;
  }
  return text.replace(/\s{3,}/g, '  ').trim();
}

export async function extractPdfText(file: File): Promise<PdfExtractionResult> {
  if (file.size > PDF_MAX_FILE_BYTES) {
    throw new PdfExtractionError(`"${file.name}" exceeds the ${Math.round(PDF_MAX_FILE_BYTES / (1024 * 1024))}MB limit.`);
  }
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new PdfExtractionError(`"${file.name}" is not a PDF file.`);
  }

  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    const buffer = await file.arrayBuffer();
    pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  } catch (err) {
    console.error('pdfjs load failed:', err);
    throw new PdfExtractionError(`"${file.name}" could not be opened as a PDF. The file may be corrupted or password-protected.`);
  }

  const totalPages = pdf.numPages;
  const pageCount = Math.min(totalPages, MAX_PAGES);
  const pages: string[] = [];
  const ocrPages: number[] = [];
  let extractedCharacters = 0;
  let truncated = totalPages > MAX_PAGES;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    try {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      let text = joinTextLayer(textContent);

      // Scanned page fallback: no text layer → OCR it (bounded).
      if (text.length < TEXT_LAYER_MIN_CHARS && ocrPages.length < MAX_OCR_PAGES) {
        try {
          const ocrText = await ocrPageText(page);
          if (ocrText.length > 0) {
            text = ocrText;
            ocrPages.push(pageNumber);
          }
        } catch (ocrErr) {
          console.warn(`OCR failed on page ${pageNumber}:`, ocrErr);
        }
      }

      text = text.slice(0, MAX_CHARS_PER_PAGE);
      pages.push(text);
      extractedCharacters += text.length;
      if (extractedCharacters >= MAX_TOTAL_CHARS) {
        truncated = true;
        break;
      }
    } catch (err) {
      console.warn(`pdfjs page ${pageNumber} failed:`, err);
      pages.push('');
    }
  }

  if (extractedCharacters < 32) {
    if (ocrPages.length > 0) {
      throw new PdfExtractionError(
        `"${file.name}" was OCR'd but still yielded no readable text. The scan may be too low-quality.`
      );
    }
    throw new PdfExtractionError(
      `"${file.name}" yielded no readable text and could not be OCR'd. Please try another PDF.`
    );
  }

  return {
    filename: file.name,
    pages,
    totalPages,
    truncated,
    extractedCharacters,
    ocrApplied: ocrPages.length > 0,
    ocrPages,
  };
}
