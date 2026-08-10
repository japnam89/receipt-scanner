// OCR + light field extraction. Uses Tesseract.js for images (local, no API
// key) and pdf-parse for PDF text. Total/merchant/date are pulled with simple
// heuristics — swap this module for Google Vision or an LLM later if you want
// higher accuracy.
const fs = require("fs");
const path = require("path");
const Tesseract = require("tesseract.js");
const pdfParse = require("pdf-parse");

const MONEY_RE = /(?:[$€£])\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/g;
const DATE_RE = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4})\b/i;

function firstMoney(text) {
  const matches = [...text.matchAll(MONEY_RE)];
  if (!matches.length) return null;
  // Prefer the largest amount (often the total).
  let best = null;
  for (const m of matches) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (!best || n > best) best = n;
  }
  return best;
}

function firstDate(text) {
  const m = text.match(DATE_RE);
  return m ? m[0] : null;
}

function guessMerchant(text, filename) {
  // Try a line near the top that looks like a store/brand name.
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const candidate = lines.find((l) => /[A-Z][A-Za-z&.'\- ]{3,}/.test(l) && l.length < 40);
  return candidate || filename.replace(/\.[^.]+$/, "");
}

async function ocrBuffer(buf, mimeType) {
  if (mimeType === "application/pdf") {
    try {
      const parsed = await pdfParse(buf);
      return parsed.text || "";
    } catch {
      return "";
    }
  }
  const { data } = await Tesseract.recognize(buf, "eng");
  return data.text || "";
}

// Extract structured fields from a downloaded file buffer.
async function extract(buf, mimeType, filename) {
  const text = await ocrBuffer(buf, mimeType);
  const total = firstMoney(text);
  const currency = (text.match(/\$|€|£/) || ["$"])[0];
  return {
    raw_text: text.slice(0, 20000),
    merchant: guessMerchant(text, filename),
    total,
    currency,
    receipt_date: firstDate(text),
  };
}

module.exports = { extract };
