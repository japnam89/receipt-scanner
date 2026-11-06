const assert = require("assert");
const { firstMoney, firstDate, guessMerchant, detectDocumentType } = require("../src/ocr");

assert.strictEqual(firstMoney("AMOUNT DUE 42.50 USD"), 42.5);
assert.strictEqual(firstMoney("TOTAL: $1,245.55"), 1245.55);
assert.strictEqual(firstMoney("Subtotal\n$10.00\nTax\n$2.00\nTotal\n$12.00"), 12);
assert.strictEqual(firstMoney("Grand Total\n$42.50"), 42.5);
assert.strictEqual(firstMoney("Reference 60472236\n2200 2450\n1 0 6"), null);
assert.strictEqual(firstDate("20 Sep 2026"), "20 Sep 2026");
assert.strictEqual(firstDate("Sep 20, 2026"), "Sep 20, 2026");
assert.strictEqual(firstDate("February 13, 2026 07:00 p.m.\nPlan End Date: Feb. 12, 2029"), "February 13, 2026");
assert.strictEqual(firstDate("Plan End Date: Feb. 12, 2029\nInvoice Date: February 13, 2026"), "February 13, 2026");
assert.strictEqual(guessMerchant("Settlement\nJAPNAM SINGH\n2450 Main Street\nBargain Depot Canada Inc.", "invoice.pdf"), "Bargain Depot Canada Inc.");
assert.strictEqual(guessMerchant("Shipping Address Seagate Return\nLocation\nJAPNAM SINGH", "OrderConfirmation.pdf"), "Seagate");
assert.strictEqual(guessMerchant("Account statement\n407etr.com\nTotal amount due", "statement.pdf"), "407 ETR");
assert.strictEqual(guessMerchant("", "1jpFC-9x6eTCiipW_nwGlpq2uK2Let3QD.pdf"), "Unknown merchant");
assert.strictEqual(detectDocumentType("Auction Sale - returned items\nInvoice # 123", "invoice.pdf"), "Auction");
assert.strictEqual(detectDocumentType("Bill date: Oct 18\nBilling period: September", "statement.pdf"), "Bill");
assert.strictEqual(detectDocumentType("Payment confirmation\nPaid in full", "receipt.pdf"), "Payment");
assert.strictEqual(detectDocumentType("Total $12.00", "invoice-1.pdf"), "Invoice");
assert.strictEqual(detectDocumentType("RMA number and shipping address", "OrderConfirmation.pdf"), "Order");
assert.strictEqual(detectDocumentType("Apple Markville Shopping Centre", "EmailReceipt_20260213.pdf"), "Receipt");

console.log("ocr-test: ok");
