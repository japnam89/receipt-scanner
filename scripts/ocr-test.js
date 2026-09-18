const assert = require("assert");
const { firstMoney, firstDate, extractAzureResult } = require("../src/ocr");

assert.strictEqual(firstMoney("AMOUNT DUE 42.50 USD"), 42.5);
assert.strictEqual(firstMoney("TOTAL: $1,245.55"), 1245.55);
assert.strictEqual(firstDate("20 Sep 2026"), "20 Sep 2026");
assert.strictEqual(firstDate("Sep 20, 2026"), "Sep 20, 2026");

const azure = extractAzureResult({
  analyzeResult: {
    documents: [{
      fields: {
        MerchantName: { content: "Bargain Depot Canada Inc.", valueString: "Bargain Depot Canada Inc." },
        Total: { valueNumber: 5.56, valueCurrency: { currencyCode: "CAD" } },
        TransactionDate: { valueDate: "2026-09-18" },
      },
    }],
    pages: [{ lines: [{ content: "BARGAIN DEPOT CANADA INC." }, { content: "TOTAL ($5.56)" }] }],
  },
});

assert.strictEqual(azure.merchant, "Bargain Depot Canada Inc.");
assert.strictEqual(azure.total, 5.56);
assert.strictEqual(azure.currency, "CAD");
assert.strictEqual(azure.receipt_date, "2026-09-18");

console.log("ocr-test: ok");
