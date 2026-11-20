/**
 * REST API routes for receipts: OCR info, CRUD operations, and scans.
 */

import { Router } from "express";
import multer from "multer";
import config from "./config.js";

const router = Router();

// Mount point for these routes in parent module
export const apiRoutesPath = "/api";

/**
 * Multer configuration for file uploads.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    files: config.uploads.maxFiles || 5,
    fileSize: config.uploads.maxSize || 10 * 1024 * 1024,
    parts: config.uploads.maxFiles || 5,
  },
});

/**
 * Get available OCR field types.
 */
router.get("/ocr-info", (req, res) => {
  const provider = ocr.getProviderName();
  const model = ocr.getModelString();
  
  res.json({
    provider: ocr.getProviderName(),
    model: ocr.getModelString(),
    pricing: "Runs locally; no per-page cloud charge",
  });
});

/**
 * List all receipts with detected document types.
 */
router.get("/receipts", (req, res) => {
  const receipts = db.listAll();
  
  res.json(receipts.map(r => ({
    ...r,
    document_type: ocr.detectDocumentType(r.raw_text || "", r.name),
  })));
});

/**
 * Get a single receipt by ID.
 */
router.get("/receipts/:id", (req, res) => {
  const receipt = db.getById(req.params.id);
  
  if (!receipt) {
    return res.status(404).json({ error: "not found" });
  }
  
  res.json(receipt);
});

/**
 * Create a new receipt.
 */
router.post("/receipts", async (req, res) => {
  try {
    const b = req.body;
    
    if (!b.name) {
      return res.status(400).json({ error: "name is required" });
    }

    // Validate file type if mime_type is provided
    if (b.mime_type && !b.mime_type.startsWith("application/")) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    const info = await db.insert({
      drive_file_id: b.drive_file_id ?? null,
      name: b.name,
      mime_type: b.mime_type ?? null,
      web_view_link: b.web_view_link ?? null,
      thumbnail_link: b.thumbnail_link ?? null,
      created_time: b.created_time ?? null,
      raw_text: b.raw_text ?? null,
      merchant: b.merchant ?? null,
      total: b.total ?? null,
      currency: b.currency ?? null,
      receipt_date: b.receipt_date ?? null,
    });

    res.status(201).json({ ...info, id: info.id });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create receipt" });
  }
});

/**
 * Update an existing receipt.
 */
router.put("/receipts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const existing = await db.getById(id);
    
    if (!existing) {
      return res.status(404).json({ error: "not found" });
    }

    const b = req.body;
    
    const fields = {
      name: b.name ?? existing.name,
      merchant: b.merchant ?? existing.merchant,
      total: b.total ?? existing.total,
      currency: b.currency ?? existing.currency,
      receipt_date: b.receipt_date ?? existing.receipt_date,
      category: b.category ?? existing.category,
      notes: b.notes ?? existing.notes,
    };

    await db.update(id, fields);
    
    res.json(await db.getById(id));
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update receipt" });
  }
});

/**
 * Delete a receipt.
 */
router.delete("/receipts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    await db.delete(id);
    
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete receipt" });
  }
});

/**
 * Scan Google Drive for receipts and OCR them.
 */
router.post("/scan", async (req, res) => {
  try {
    const result = await db.scanAll();
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Upload files and extract OCR fields.
 */
router.post("/uploads", async (req, res) => {
  noCache(res);
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Choose at least one file to upload." });
    }

    const results = [];

    for (const file of req.files) {
      const name = path.basename(file.originalname || "upload.pdf");
      const ext = (name.split(".").pop() || "bin").toLowerCase();
      
      // Validate file is PDF if mimetype is application/pdf
      if (file.mimetype !== "application/pdf" && !name.toLowerCase().endsWith(".pdf")) {
        results.push({ name, error: "This file is not a valid PDF." });
        continue;
      }

      const localPath = path.join(process.env.RECEIPTS_DIR || "./.receipts", `${file.filename}.${ext}`);
      
      try {
        // Read and process the file
        const buf = Buffer.from(file.buffer);
        const fields = await ocr.extract(buf, file.mimetype, name);

        const saved = await db.upsert({
          drive_file_id: null,
          name: name,
          mime_type: file.mimetype,
          web_view_link: null,
          thumbnail_link: null,
          created_time: null,
          ...fields,
        });

        results.push({ 
          id: parseInt(saved.id),
          name, 
          merchant: fields.merchant,
          document_type: fields.document_type,
          total: fields.total,
          currency: fields.currency,
          receipt_date: fields.receipt_date,
        });
      } catch (error) {
        results.push({ name, error: error.message || "Could not process this file." });
      }
    }

    res.status(200).json({ results });
  } catch (error) {
    noCache(res);
    return res.status(500).json({ error: error.message });
  }
});

export { 
  router,
  apiRoutesPath,
  upload,
};
