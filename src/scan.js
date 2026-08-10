// Scan service: pulls receipt-like files from Drive, OCRs them, and upserts
// into the DB. Pure function of the drive + ocr + db modules so it's testable.
const fs = require("fs");
const path = require("path");
const { listReceiptFiles, downloadFile } = require("./drive");
const { extract } = require("./ocr");
const { upsertFromDrive } = require("./db");

const CACHE = process.env.RECEIPTS_DIR || path.join(__dirname, "..", ".receipts");
fs.mkdirSync(CACHE, { recursive: true });

async function scan() {
  const files = await listReceiptFiles();
  const results = [];
  for (const f of files) {
    try {
      const buf = await downloadFile(f.id);
      const ext = (f.name.split(".").pop() || "bin").toLowerCase();
      const local = path.join(CACHE, `${f.id}.${ext}`);
      fs.writeFileSync(local, buf);
      const fields = await extract(buf, f.mimeType, f.name);
      const saved = upsertFromDrive({
        drive_file_id: f.id,
        name: f.name,
        mime_type: f.mimeType,
        web_view_link: f.webViewLink,
        thumbnail_link: f.thumbnailLink,
        created_time: f.createdTime,
        ...fields,
      });
      results.push({ fileId: f.id, name: f.name, extracted: fields, saved });
    } catch (e) {
      results.push({ fileId: f.id, name: f.name, error: e.message });
    }
  }
  return { scanned: files.length, results };
}

module.exports = { scan };
