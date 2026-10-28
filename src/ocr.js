// OCR + light field extraction. Uses Tesseract.js for images (local, no API
// key) and pdf-parse for PDF text. Total/merchant/date are pulled with simple
// heuristics — swap this module for Google Vision or an LLM later if you want
// higher accuracy.
const fs = require("fs");
const path = require("path");
const Tesseract = require("tesseract.js");
const { PDFParse } = require("pdf-parse");

const TESSERACT_OPTIONS = {
  langPath: path.join(__dirname, ".."),
  gzip: false,
};

const MONEY_RE = /(?:[$€£₹]|USD|EUR|GBP|AUD|CAD|CHF|JPY|SEK|NOK|DKK|CNY|RMB|INR|HKD)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/gi;
const NO_CURRENCY_MONEY_RE = /(?<!\d)(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)(?!\d)/g;
const DATE_RE = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:0?[1-9]|[12][0-9]|3[01])\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*\d{4})\b/gi;
const DATE_KEYWORDS = /date|issued|invoice date|receipt date|paid on/i;

function firstMoney(text) {
  const lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const strongTotal = /\b(?:grand\s+total|total\s+due|amount\s+due|balance\s+due|net\s+total)\b/i;
  const plainTotal = /\btotal\b/i;
  const parseValues = (line) => {
    const marked = [...line.matchAll(MONEY_RE)].map((match) => match[1]);
    const values = marked.length ? marked : [...line.matchAll(NO_CURRENCY_MONEY_RE)].map((match) => match[1]);
    return values.map((value) => Number(value.replace(/,/g, ""))).filter(Number.isFinite);
  };

  const labeledTotals = [];
  const plainTotals = [];
  const markedAmounts = [];
  const decimalAmounts = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const marked = [...line.matchAll(MONEY_RE)].map((match) => Number(match[1].replace(/,/g, ""))).filter(Number.isFinite);
    markedAmounts.push(...marked);
    decimalAmounts.push(...parseValues(line).filter((value) => !Number.isInteger(value)));

    let values = parseValues(line);
    if (!values.length && index + 1 < lines.length) values = parseValues(lines[index + 1]);
    if (strongTotal.test(line) && values.length) labeledTotals.push(values[values.length - 1]);
    else if (plainTotal.test(line) && !/\b(?:sub|line|tax)\s*total\b/i.test(line) && values.length) {
      plainTotals.push(values[values.length - 1]);
    }
  }

  if (labeledTotals.length) return labeledTotals[labeledTotals.length - 1];
  if (plainTotals.length) return plainTotals[plainTotals.length - 1];
  if (markedAmounts.length) return Math.max(...markedAmounts);
  return decimalAmounts.length ? Math.max(...decimalAmounts) : null;
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
  const lines = String(text).split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const rejectedLine = /\b(?:page|settlement|invoice|receipt|confirmation|order|reference|rma|date|total|amount|payment|balance|bill|account|customer|subtotal|tax|shipping address|billing address|gst|hst|paid in full)\b/i;
  const isCandidate = (line) => line.length > 3 &&
    line.length < 70 &&
    /[A-Za-z]{3}/.test(line) &&
    !rejectedLine.test(line) &&
    !/\d{3,}/.test(line) &&
    !/^[A-Z][A-Z'’-]+(?:\s+[A-Z][A-Z'’-]+){1,3}[,]?$/.test(line);

  const returnHeader = lines
    .map((line) => line.match(/shipping address\s+([A-Za-z][A-Za-z &'’-]+?)\s+return(?:\s+location)?\b/i)?.[1])
    .find(Boolean);
  if (returnHeader) return cleanMerchantName(returnHeader);

  const companyName = lines.find((line) =>
    /\b(?:incorporated|inc\.?|limited|ltd\.?|llc|corp\.?|corporation|gmbh)\b/i.test(line) && isCandidate(line),
  );
  if (companyName) return cleanMerchantName(companyName);

  const labeledName = lines
    .map((line) => line.match(/^(?:merchant|seller|sold by|billed by|vendor|store)\s*[:#-]?\s*(.{4,65})$/i)?.[1])
    .find((candidate) => candidate && isCandidate(candidate));
  if (labeledName) return cleanMerchantName(labeledName);

  const filenameStem = path.basename(filename || "", path.extname(filename || ""));
  const filenameCandidate = filenameStem
    .replace(/[_-]+/g, " ")
    .replace(/\b(?:email|receipt|invoice|order|confirmation|statement|bill|payment|download|scan)\b/gi, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(filenameStem) && isCandidate(filenameCandidate)) return cleanMerchantName(filenameCandidate);

  const domain = String(text).match(/(?:https?:\/\/)?(?:www\.)?(\d*[a-z][a-z0-9-]*)\.(?:com|ca|net|org)\b/i)?.[1];
  if (domain && /^\d+[a-z]+$/i.test(domain)) {
    const numericBrand = domain.match(/^(\d+)([a-z]+)$/i);
    return `${numericBrand[1]} ${numericBrand[2].toUpperCase()}`;
  }

  const preferred = lines.find(isCandidate);
  return preferred ? cleanMerchantName(preferred) : "Unknown merchant";
}

function detectDocumentType(text, filename = "") {
  const title = path.basename(filename || "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[._-]+/g, " ");
  const opening = String(text).split(/\r?\n/).slice(0, 8).join(" ").toLowerCase();
  const content = `${title}\n${opening}`;
  if (/\bauction sale\b|\bwinning bidders?\b|\bbidcard\b|\bbid card\b|\bauction\b.*\b(?:invoice|receipt|sale)\b/.test(content)) return "Auction";
  if (/order\s*confirmation/.test(title) || /\border confirmation\b/.test(opening)) return "Order";
  if (/\bbill\b|\bbilling period\b/.test(title) || /\b(?:bill date|billing period|monthly bill|utility bill|bill statement)\b/.test(opening)) return "Bill";
  if (/\binvoice\b/.test(title) || /\binvoice\b/.test(opening)) return "Invoice";
  if (/\bstatement\b/.test(title) || /\bstatement\b/.test(opening)) return "Statement";
  if (/\b(?:payment confirmation|payment receipt|receipt of payment|paid in full|payment received)\b/.test(opening)) return "Payment";
  if (/\breceipt\b/.test(title) || /\breceipt\b/.test(opening)) return "Receipt";
  if (/\bpayment\b/.test(opening)) return "Payment";
  return "Other";
}

async function ocrBuffer(buf, mimeType) {
  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buf });
    let text = "";
    try {
      const parsed = await parser.getText();
      text = parsed.text || "";
      if (firstMoney(text) !== null) return text;
      const screenshots = await parser.getScreenshot({ scale: 1.5, imageBuffer: true, imageDataUrl: false });
      const pagesText = [];
      for (const page of screenshots.pages) {
        const { data } = await Tesseract.recognize(page.data, "eng", TESSERACT_OPTIONS);
        if (data?.text) pagesText.push(data.text);
      }
      return [text, ...pagesText].filter(Boolean).join("\n");
    } catch {
      return text;
    } finally {
      await parser.destroy();
    }
  }

  try {
    const { data } = await Tesseract.recognize(buf, "eng", TESSERACT_OPTIONS);
    return data.text || "";
  } catch {
    return "";
  }
}

// Extract structured fields from a downloaded file buffer.
async function extract(buf, mimeType, filename) {
  const text = await ocrBuffer(buf, mimeType);
  const normalized = text.replace(/\r/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{2,}/g, "\n").trim();
  const total = firstMoney(normalized) ?? firstMoney(text);
  const currencyMatch = normalized.match(/₹|\$|€|£|USD|EUR|GBP|CHF|JPY|CAD|AUD|INR/i);
  const currency = currencyMatch?.[0] || "$";
  const receipt_date = firstDate(normalized) ?? firstDate(text);
  return {
    raw_text: text.slice(0, 20000),
    merchant: guessMerchant(normalized || text, filename),
    document_type: detectDocumentType(text, filename),
    total,
    currency,
    receipt_date,
  };
}

function getOcrInfo() {
  return {
    provider: "Local processing",
    model: "Tesseract.js English (eng) + PDFParse text extraction",
    pricing: "Runs locally; no per-page cloud charge",
  };
}

module.exports = { extract, firstMoney, firstDate, guessMerchant, detectDocumentType, getOcrInfo };
