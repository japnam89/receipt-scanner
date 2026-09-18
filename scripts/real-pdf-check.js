const fs = require("fs");
const { extract } = require("../src/ocr");

(async () => {
  const files = fs.readdirSync("./.receipts");
  const pdf = files.find((file) => file.toLowerCase().endsWith(".pdf"));

  if (!pdf) {
    throw new Error("No PDF found in .receipts");
  }

  const buf = fs.readFileSync(`./.receipts/${pdf}`);
  const result = await extract(buf, "application/pdf", pdf);
  console.log(JSON.stringify(result, null, 2));
})();
