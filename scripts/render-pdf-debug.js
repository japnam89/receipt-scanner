const fs = require("fs");
const path = require("path");
const { getDocument } = require("pdfjs-dist/legacy/build/pdf.mjs");
const { createCanvas } = require("canvas");

(async () => {
  const files = fs.readdirSync("./.receipts");
  const pdf = files.find((f) => f.toLowerCase().endsWith(".pdf"));

  if (!pdf) {
    throw new Error("No PDF found in .receipts");
  }

  const buf = fs.readFileSync(path.join(".receipts", pdf));
  const pdfDoc = await getDocument({ data: new Uint8Array(buf) }).promise;
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;
  fs.writeFileSync("debug-render.png", canvas.toBuffer("image/png"));
  console.log(JSON.stringify({ pdf, width: viewport.width, height: viewport.height }));
})();
