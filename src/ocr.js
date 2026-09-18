// OCR + light field extraction. Uses Tesseract.js for images (local, no API
// key) and pdf-parse for PDF text. Total/merchant/date are pulled with simple
// heuristics — swap this module for Google Vision or an LLM later if you want
// higher accuracy.
const fs = require("fs");
const path = require("path");
const { fileURLToPath, pathToFileURL } = require("url");
const Tesseract = require("tesseract.js");
const pdfParse = require("pdf-parse");
const { getDocument } = require("pdfjs-dist/legacy/build/pdf.mjs");
const { createCanvas } = require("canvas");

const AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || "";
const AZURE_DOCUMENT_INTELLIGENCE_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY || "";

const PDFJS_STANDARD_FONT_DATA_URL = pathToFileURL(path.join(__dirname, "..", "node_modules", "pdfjs-dist", "standard_fonts")).href + "/";

function installPdfjsLocalFontRead() {
  if (globalThis.__receiptScannerPdfjsReadPatched) return;

  const fsPromises = require("fs/promises");
  const originalReadFile = fsPromises.readFile.bind(fsPromises);

  fsPromises.readFile = (file, ...args) => {
    if (typeof file === "string" && file.startsWith("file://")) {
      return originalReadFile(fileURLToPath(file), ...args);
    }
    return originalReadFile(file, ...args);
  };

  globalThis.__receiptScannerPdfjsReadPatched = true;
}

const MONEY_RE = /(?:[$€£]|USD|EUR|GBP|AUD|CAD|CHF|JPY|SEK|NOK|DKK|CNY|RMB|INR|HKD)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/gi;
const NO_CURRENCY_MONEY_RE = /(?<!\d)(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)(?!\d)/g;
const DATE_RE = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:0?[1-9]|[12][0-9]|3[01])\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*\d{4})\b/gi;
const TOTAL_KEYWORDS = /total|amount due|grand total|balance due|net total|amount/i;
const DATE_KEYWORDS = /date|issued|invoice date|receipt date|paid on/i;

function firstMoney(text) {
  const matches = [...text.matchAll(MONEY_RE)];
  const fallback = [...text.matchAll(NO_CURRENCY_MONEY_RE)];
  const candidates = [...matches.map((m) => m[1]), ...fallback.map((m) => m[1])];

  if (!candidates.length) return null;

  const cleaned = candidates
    .map((value) => value.replace(/,/g, ""))
    .filter((value) => !Number.isNaN(Number(value)));

  if (!cleaned.length) return null;

  const withContext = cleaned.map((value) => ({ value: parseFloat(value), text: text.slice(Math.max(0, text.indexOf(value) - 24), text.indexOf(value) + 24) }));
  const preferred = withContext.find((entry) => TOTAL_KEYWORDS.test(entry.text));
  const best = preferred ? preferred.value : withContext.reduce((max, entry) => entry.value > max.value ? entry : max, withContext[0]).value;
  return best;
}

function firstDate(text) {
  const candidates = [...text.matchAll(DATE_RE)].map((m) => m[0]);
  if (!candidates.length) return null;

  const indexed = candidates.map((value) => ({ value, index: text.indexOf(value) }));
  const preferred = indexed.find(({ index, value }) => {
    const context = text.slice(Math.max(0, index - 32), index + value.length + 32);
    return DATE_KEYWORDS.test(context);
  });

  return preferred ? preferred.value : candidates[0];
}

function cleanMerchantName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Unknown merchant";

  const cleaned = raw
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s*\([^)]*\)/g, " ")
    .replace(/\b(?:email\s*receipt|test\s*receipt|invoice|order|receipt|confirmation|bill|payment|download|file)\b/gi, " ")
    .replace(/(?<![A-Za-z])[0-9]+(?![A-Za-z])/g, " ")
    .replace(/[^A-Za-z0-9&\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || /^unknown merchant$/i.test(cleaned)) return "Unknown merchant";
  if (/^(?:order|invoice|receipt|email|confirmation|bill|payment|test)/i.test(cleaned)) return "Unknown merchant";
  if (/^[\d\s]+$/.test(cleaned)) return "Unknown merchant";

  return cleaned;
}

function guessMerchant(text, filename) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const preferred = lines
    .filter((line) => /[A-Za-z]/.test(line) && line.length > 3 && line.length < 60)
    .find((line) => !/(total|amount|date|invoice|receipt|payment|bill)/i.test(line));

  const candidate = preferred || filename.replace(/\.[^.]+$/, "");
  return cleanMerchantName(candidate);
}

function normalizeNumberString(value) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value)
    .replace(/[,$\s]/g, "")
    .replace(/[()]/g, (match) => (match === "(" ? "-" : ""));
  const numeric = Number.parseFloat(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function extractAzureResult(result) {
  const analyzeResult = result?.analyzeResult || result;
  const document = analyzeResult?.documents?.[0] || result?.documents?.[0] || {};
  const fields = document.fields || {};

  const merchant =
    fields.MerchantName?.content ||
    fields.MerchantName?.valueString ||
    fields.Merchant?.content ||
    fields.Merchant?.valueString ||
    fields.vendorName?.content ||
    fields.vendorName?.valueString ||
    "";

  const totalValue =
    fields.Total?.valueNumber ??
    normalizeNumberString(fields.Total?.content) ??
    normalizeNumberString(fields.Total?.valueString) ??
    null;

  const currency =
    fields.Total?.valueCurrency?.currencyCode ||
    fields.Total?.valueCurrency?.currencySymbol ||
    fields.Total?.currencyCode ||
    "USD";

  const dateValue =
    fields.TransactionDate?.valueDate ||
    fields.TransactionDate?.content ||
    fields.ReceiptDate?.valueDate ||
    fields.ReceiptDate?.content ||
    fields.Date?.valueDate ||
    fields.Date?.content ||
    null;

  const rawText = (analyzeResult?.pages || result?.pages || [])
    .map((page) => page.lines?.map((line) => line.content).join(" "))
    .filter(Boolean)
    .join("\n");

  return {
    raw_text: rawText,
    merchant: merchant || "Unknown merchant",
    total: totalValue,
    currency,
    receipt_date: dateValue,
  };
}

async function extractWithAzureDocumentIntelligence(buf) {
  if (!AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || !AZURE_DOCUMENT_INTELLIGENCE_KEY) {
    return null;
  }

  const url = new URL("/formrecognizer/documentModels/prebuilt-receipt:analyze?api-version=2023-07-31", AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_DOCUMENT_INTELLIGENCE_KEY,
      "Content-Type": "application/octet-stream",
    },
    body: buf,
  });

  if (!response.ok) {
    throw new Error(`Azure Document Intelligence request failed: ${response.status}`);
  }

  const operationLocation = response.headers.get("operation-location") || response.headers.get("Operation-Location");
  if (!operationLocation) {
    throw new Error("Azure Document Intelligence did not return an operation URL");
  }

  let result;
  for (let i = 0; i < 30; i++) {
    const poll = await fetch(operationLocation, {
      method: "GET",
      headers: { "Ocp-Apim-Subscription-Key": AZURE_DOCUMENT_INTELLIGENCE_KEY },
    });
    if (!poll.ok) {
      throw new Error(`Azure Document Intelligence polling failed: ${poll.status}`);
    }
    result = await poll.json();
    if (result.status === "succeeded" || result.status === "failed") {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (result?.status !== "succeeded") {
    throw new Error("Azure Document Intelligence did not finish successfully");
  }

  return extractAzureResult(result);
}

async function renderPdfToOcrText(buf) {
  try {
    installPdfjsLocalFontRead();
    const loadingTask = getDocument({
      data: new Uint8Array(buf),
      standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
    });
    const pdf = await loadingTask.promise;
    let pagesText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context, viewport }).promise;
      const { data } = await Tesseract.recognize(canvas.toBuffer("image/png"), "eng");
      if (data?.text) pagesText += `\n${data.text}`;
    }

    return pagesText.trim();
  } catch {
    return "";
  }
}

async function ocrBuffer(buf, mimeType) {
  if (mimeType === "application/pdf") {
    try {
      const parsed = await pdfParse(buf);
      if (parsed.text && parsed.text.trim()) return parsed.text;
      return await renderPdfToOcrText(buf);
    } catch {
      return await renderPdfToOcrText(buf);
    }
  }

  try {
    const { data } = await Tesseract.recognize(buf, "eng");
    return data.text || "";
  } catch {
    return "";
  }
}

// Extract structured fields from a downloaded file buffer.
async function extract(buf, mimeType, filename) {
  try {
    const azureResult = await extractWithAzureDocumentIntelligence(buf);
    if (azureResult) {
      return {
        ...azureResult,
        raw_text: (azureResult.raw_text || "").slice(0, 20000),
      };
    }
  } catch (error) {
    // Fall back to local OCR when Azure isn't configured or returns an error.
  }

  const text = await ocrBuffer(buf, mimeType);
  const normalized = text.replace(/\r/g, "\n").replace(/\s+/g, " ").trim();
  const total = firstMoney(normalized) ?? firstMoney(text);
  const currency = (normalized.match(/\$|€|£|USD|EUR|GBP|CHF|JPY|CAD|AUD/) || ["$"])[0] || "$";
  const receipt_date = firstDate(normalized) ?? firstDate(text);
  return {
    raw_text: text.slice(0, 20000),
    merchant: guessMerchant(normalized || text, filename),
    total,
    currency,
    receipt_date,
  };
}

module.exports = { extract, firstMoney, firstDate, extractAzureResult };
