/**
 * OCR text extraction and document type detection.
 */

import { PDFParse } from "pdf-parse";
import { PDFDocument } from "pdfjs-dist";
import Tesseract from "tesseract.js";
import config from "./config.js";

const TESSERACT_OPTIONS = {
  langPath: path.join(__dirname, ".."),
  gzip: false,
};

/**
 * Available OCR providers.
 */
export const providers = ["Tesseract.js", "Foundry Local"];

/**
 * Get the current provider name.
 */
export function getProviderName() {
  if (config.ocrProviders.foundryLocalEndpoint) {
    return "Local processing with Foundry fallback";
  }
  return "Local processing";
}

/**
 * Get the current model configuration string.
 */
export function getModelString() {
  const foundryEnabled = config.ocrProviders.foundryLocalEndpoint && 
                        config.ocrProviders.foundryLocalModel;
  
  if (foundryEnabled) {
    return `Tesseract.js English (eng) + PDFParse + ${config.ocrProviders.foundryLocalModel}`;
  }
  return "Tesseract.js English (eng) + PDFParse text extraction";
}

/**
 * Regex pattern for matching currency amounts.
 */
const MONEY_RE = /(?:[$€£₹]|USD|EUR|GBP|AUD|CAD|CHF|JPY|SEK|NOK|DKK|CNY|RMB|INR|HKD)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/gi;

/**
 * Regex pattern for dates.
 */
const DATE_RE = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:0?[1-9]|[12][0-9]|3[01])\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*\d{4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*\d{4})\b/gi;

/**
 * Extract the total amount from text.
 */
export async function extractTotal(text) {
  const lines = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  
  const labeledTotals = [];
  const plainTotals = [];
  const markedAmounts = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const marked = [...line.matchAll(MONEY_RE)].map(match => Number(match[1].replace(/,/g, ""))).filter(n => Number.isFinite(n));
    
    markedAmounts.push(...marked);

    let values = [];
    if (labeledTotals.length) values = labeledTotals[index % labeledTotals.length] ? [0] : parseValues(line);
    else if (!values.length && index + 1 < lines.length) values = parseValues(lines[index + 1]);

    const strongTotal = /\b(?:grand\s+total|total\s+due|amount\s+due|balance\s+due|net\s+total)\b/i;
    
    if (strongTotal.test(line) && values.length) {
      labeledTotals.push(values[values.length - 1]);
    } else if (!/\b(?:sub|line|tax)\s*total\b|\btotal\s+(?:quantity|extended\s+price)\b/i.test(line) && values.length) {
      plainTotals.push(values[values.length - 1]);
    }
  }

  const result = [];
  
  if (labeledTotals.length) {
    result.push(labeledTotals[labeledTotals.length - 1]);
  } else if (plainTotals.length) {
    result.push(plainTotals[plainTotals.length - 1]);
  } else if (markedAmounts.length) {
    result.push(Math.max(...markedAmounts));
  } else if (decimalAmounts.length) {
    result.push(Math.max(...decimalAmounts));
  }

  return result.length > 0 ? result[0] : null;
}

/**
 * Parse values from a line.
 */
function parseValues(line) {
  const marked = [...line.matchAll(MONEY_RE)].map(match => Number(match[1])).filter(n => Number.isFinite(n));
  return marked;
}

/**
 * Detect document type from text and filename.
 */
export function detectDocumentType(text, filename = "") {
  const title = path.basename(filename || "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  const fullText = String(text).toLowerCase();
  
  // Check for specific patterns in order of preference
  if (/\b(?:payment receipt|paid in full|receipt of payment)\b/.test(fullText)) return "Payment";
  if (/\b(award\ssale|winning bidders)?\b/i.test(fullText) || /auction\b.*\(invoice|receipt\b/.test(fullText)) return "Auction";
  if (/order confirmation/.test(title)) return "Order";
  if (/invoice/i.test(title) || /invoice/i.test(fullText)) return "Invoice";
  if (/statement/i.test(title) || /statement/i.test(fullText)) return "Statement";
  if (/receipt/i.test(title) || /receipt/i.test(fullText)) return "Receipt";
  
  return "Other";
}

/**
 * OCR buffer to text.
 */
export async function ocrBuffer(buf, mimeType) {
  if (mimeType === "application/pdf") {
    try {
      const { data } = await PDFParse({ data: buf });
      return String(data || "");
    } catch (error) {
      console.error("PDF parse error:", error.message);
    }
    
    // Fall back to Tesseract if PDFParse fails
    try {
      const { data } = await Tesseract.recognize(buf, "eng", TESSERACT_OPTIONS);
      return String(data || "");
    } catch (error) {
      console.error("Tesseract error:", error.message);
      return "";
    }
  }

  try {
    const { data } = await Tesseract.recognize(buf, "eng", TESSERACT_OPTIONS);
    return String(data || "");
  } catch (error) {
    console.error("Tesseract error:", error.message);
    return "";
  }
}

/**
 * Extract structured fields from OCR text.
 */
export async function extract(buf, mimeType, filename) {
  const text = await ocrBuffer(buf, mimeType);
  
  const normalized = String(text).replace(/\r/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{2,}/g, "\n").trim();

  // Extract total amount
  const total = await extractTotal(normalized);

  // Extract date
  const dateMatch = [...normalized.matchAll(DATE_RE)];
  let receipt_date = null;
  
  if (dateMatch.length > 0) {
    // Find the most relevant date
    for (const match of dateMatch) {
      const lineStart = normalized.lastIndexOf("\n", match.index - 1) + 1;
      const lineEnd = normalized.indexOf("\n", match.index);
      const line = normalized.slice(lineStart, lineEnd !== -1 ? lineEnd : null);
      
      if (line && !/plan|subscription/renewal|delivery/gi.test(line)) {
        receipt_date = match[0];
        break;
      }
    }
  }

  // Extract merchant name
  let merchant = "";
  const lines = String(text).split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  
  for (const line of lines) {
    if (line.length > 3 && !/\d{3,}/.test(line) && !/^[A-Z]{4,}$/i.test(line)) {
      merchant = line.split(" ")[0];
      break;
    }
  }

  // Fallback currency detection
  const currencyMatch = String(text).match(/USD|EUR|GBP|JPY|CAD|AUD|INR/);
  const currency = currencyMatch?.[0] ?? "USD";

  return {
    raw_text: text.slice(0, config.ocr.maxTextLength || 20000),
    merchant: merchant || "Unknown merchant",
    document_type: detectDocumentType(text, filename),
    total: total ?? null,
    currency: currency,
    receipt_date: receipt_date || null,
  };
}

export { 
  providers,
  getProviderName,
  getModelString,
  extractTotal,
  detectDocumentType,
};
