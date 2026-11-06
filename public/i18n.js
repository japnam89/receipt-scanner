(() => {
  const messages = {
    en: {
      language: "Language", receiptScanner: "Receipt Scanner", driveHint: "Connect Google Drive once via", thenScan: ", then scan. CRUD works without Drive too.",
      scanGoogleDrive: "Scan Google Drive", uploadPdfs: "Upload PDFs", refreshList: "Refresh list", logOut: "Log out", displayCurrency: "Display currency",
      loadingModel: "Loading extraction model…", loadingReceipts: "Loading receipts…", id: "ID", type: "Type", name: "Name", merchant: "Merchant", total: "Total", date: "Date", link: "Link", actions: "Actions",
      receiptPages: "Receipt pages", previous: "Previous", next: "Next", unknownMerchant: "Unknown merchant", other: "Other", drive: "Drive", edit: "Edit", delete: "Delete",
      showing: "Showing {start}-{end} of {total}", page: "Page {current} of {total}", couldNotLoadModel: "Could not load extraction model information.", modelInfo: "{provider}: {model}. Pricing: {pricing}.",
      modelLoadError: "Could not load model information", exchangeRateError: "Exchange rate request failed", exchangeRatesUnavailable: "Exchange rates unavailable; showing original currencies.",
      editMerchant: "Edit merchant name", deleteReceipt: "Delete this receipt?", couldNotUpdate: "Could not update receipt.", couldNotDelete: "Could not delete receipt.",
      noReceiptsYet: "No receipts yet. Scan Google Drive or add one manually.", noReceiptsFound: "No receipts found.", loadedReceipts: "{count} receipt(s) loaded.", unableLoadReceipts: "Unable to load receipts.",
      scanning: "Scanning…", scannedFiles: "Scanned {count} file(s).", errorPrefix: "Error: {error}", scanFailed: "Scan failed.", couldNotLogOut: "Could not log out. Please try again.", logoutRequestFailed: "Logout request failed",
      uploadReceipts: "Upload receipts", backToList: "Back to receipt list", choosePdf: "Choose PDF files", uploadInstructions: "Upload up to five PDFs at a time. Each file can be up to 10 MB. Files are processed locally.",
      dropOrBrowse: "Drop PDF files here or browse", noFilesSelected: "No files selected", selectedCount: "{count} of 5 files selected", uploadAndScan: "Upload and scan", clearSelection: "Clear selection", remove: "Remove",
      chooseAtMostFive: "Choose no more than five PDFs.", notPdf: "{name} is not a PDF.", fileTooLarge: "{name} exceeds the 10 MB limit.", processing: "Processing…", uploadingLocally: "Uploading and scanning PDFs locally…",
      uploadFailedRetry: "Upload failed. Please try again.", processedFiles: "{succeeded} of {total} file(s) processed.", amountNotDetected: "Amount not detected", selectedFiles: "Selected files", uploadResults: "Upload results",
      accountName: "Google account", accountLoading: "Loading account…", signIn: "Sign in", signInTitle: "Sign in to Receipt Scanner", connectGoogle: "Connect your Google account to view and scan receipts in Drive.", continueGoogle: "Continue with Google", connectingGoogle: "Connecting to Google…",
      type_receipt: "Receipt", type_invoice: "Invoice", type_bill: "Bill", type_statement: "Statement", type_order: "Order", type_payment: "Payment", type_auction: "Auction"
    },
    hi: {
      language: "भाषा", receiptScanner: "रसीद स्कैनर", driveHint: "Google Drive को एक बार इससे जोड़ें", thenScan: ", फिर स्कैन करें। Drive के बिना भी रिकॉर्ड प्रबंधित किए जा सकते हैं।",
      scanGoogleDrive: "Google Drive स्कैन करें", uploadPdfs: "PDF अपलोड करें", refreshList: "सूची रीफ़्रेश करें", logOut: "लॉग आउट", displayCurrency: "मुद्रा दिखाएँ",
      loadingModel: "एक्सट्रैक्शन मॉडल लोड हो रहा है…", loadingReceipts: "रसीदें लोड हो रही हैं…", id: "आईडी", type: "प्रकार", name: "नाम", merchant: "विक्रेता", total: "कुल", date: "तारीख", link: "लिंक", actions: "कार्रवाई",
      receiptPages: "रसीद के पृष्ठ", previous: "पिछला", next: "अगला", unknownMerchant: "अज्ञात विक्रेता", other: "अन्य", drive: "Drive", edit: "बदलें", delete: "हटाएँ",
      showing: "{start}-{end} में से दिखाए जा रहे हैं; कुल {total}", page: "पृष्ठ {current}, कुल {total}", couldNotLoadModel: "एक्सट्रैक्शन मॉडल की जानकारी लोड नहीं हो सकी।", modelInfo: "{provider}: {model}। कीमत: {pricing}।",
      modelLoadError: "मॉडल की जानकारी लोड नहीं हो सकी", exchangeRateError: "विनिमय दर का अनुरोध विफल हुआ", exchangeRatesUnavailable: "विनिमय दरें उपलब्ध नहीं हैं; मूल मुद्रा दिखाई जा रही है।",
      editMerchant: "विक्रेता का नाम बदलें", deleteReceipt: "क्या यह रसीद हटाएँ?", couldNotUpdate: "रसीद अपडेट नहीं हो सकी।", couldNotDelete: "रसीद हटाई नहीं जा सकी।",
      noReceiptsYet: "अभी कोई रसीद नहीं है। Google Drive स्कैन करें या रसीद मैन्युअल रूप से जोड़ें।", noReceiptsFound: "कोई रसीद नहीं मिली।", loadedReceipts: "{count} रसीदें लोड हुईं।", unableLoadReceipts: "रसीदें लोड नहीं हो सकीं।",
      scanning: "स्कैन हो रहा है…", scannedFiles: "{count} फ़ाइलें स्कैन हुईं।", errorPrefix: "त्रुटि: {error}", scanFailed: "स्कैन विफल हुआ।", couldNotLogOut: "लॉग आउट नहीं हो सका। कृपया फिर कोशिश करें।", logoutRequestFailed: "लॉग आउट अनुरोध विफल हुआ",
      uploadReceipts: "रसीदें अपलोड करें", backToList: "रसीद सूची पर वापस जाएँ", choosePdf: "PDF फ़ाइलें चुनें", uploadInstructions: "एक बार में अधिकतम पाँच PDF अपलोड करें। हर फ़ाइल 10 MB तक हो सकती है। फ़ाइलें आपके डिवाइस पर प्रोसेस होती हैं।",
      dropOrBrowse: "PDF फ़ाइलें यहाँ छोड़ें या ब्राउज़ करें", noFilesSelected: "कोई फ़ाइल नहीं चुनी गई", selectedCount: "5 में से {count} फ़ाइलें चुनी गईं", uploadAndScan: "अपलोड करें और स्कैन करें", clearSelection: "चयन हटाएँ", remove: "हटाएँ",
      chooseAtMostFive: "अधिकतम पाँच PDF चुनें।", notPdf: "{name} PDF फ़ाइल नहीं है।", fileTooLarge: "{name} 10 MB की सीमा से बड़ी है।", processing: "प्रोसेस हो रहा है…", uploadingLocally: "PDF अपलोड और स्कैन हो रही हैं…",
      uploadFailedRetry: "अपलोड विफल हुआ। कृपया फिर कोशिश करें।", processedFiles: "{total} में से {succeeded} फ़ाइलें प्रोसेस हुईं।", amountNotDetected: "राशि नहीं मिली", selectedFiles: "चुनी गई फ़ाइलें", uploadResults: "अपलोड के परिणाम",
      accountName: "Google खाता", accountLoading: "खाता लोड हो रहा है…", signIn: "साइन इन", signInTitle: "रसीद स्कैनर में साइन इन करें", connectGoogle: "Drive में रसीदें देखने और स्कैन करने के लिए अपना Google खाता जोड़ें।", continueGoogle: "Google के साथ जारी रखें", connectingGoogle: "Google से जुड़ रहा है…",
      type_receipt: "रसीद", type_invoice: "इनवॉइस", type_bill: "बिल", type_statement: "स्टेटमेंट", type_order: "ऑर्डर", type_payment: "भुगतान", type_auction: "नीलामी"
    },
    pa: {
      language: "ਭਾਸ਼ਾ", receiptScanner: "ਰਸੀਦ ਸਕੈਨਰ", driveHint: "Google Drive ਨੂੰ ਇੱਕ ਵਾਰ ਇੱਥੋਂ ਜੋੜੋ", thenScan: ", ਫਿਰ ਸਕੈਨ ਕਰੋ। Drive ਤੋਂ ਬਿਨਾਂ ਵੀ ਰਿਕਾਰਡ ਸੰਭਾਲੇ ਜਾ ਸਕਦੇ ਹਨ।",
      scanGoogleDrive: "Google Drive ਸਕੈਨ ਕਰੋ", uploadPdfs: "PDF ਅੱਪਲੋਡ ਕਰੋ", refreshList: "ਸੂਚੀ ਤਾਜ਼ਾ ਕਰੋ", logOut: "ਲੌਗ ਆਉਟ", displayCurrency: "ਮੁਦਰਾ ਦਿਖਾਓ",
      loadingModel: "ਐਕਸਟ੍ਰੈਕਸ਼ਨ ਮਾਡਲ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…", loadingReceipts: "ਰਸੀਦਾਂ ਲੋਡ ਹੋ ਰਹੀਆਂ ਹਨ…", id: "ਆਈਡੀ", type: "ਕਿਸਮ", name: "ਨਾਮ", merchant: "ਵਪਾਰੀ", total: "ਕੁੱਲ", date: "ਤਾਰੀਖ਼", link: "ਲਿੰਕ", actions: "ਕਾਰਵਾਈਆਂ",
      receiptPages: "ਰਸੀਦ ਪੰਨੇ", previous: "ਪਿਛਲਾ", next: "ਅਗਲਾ", unknownMerchant: "ਅਣਜਾਣ ਵਪਾਰੀ", other: "ਹੋਰ", drive: "Drive", edit: "ਸੋਧੋ", delete: "ਮਿਟਾਓ",
      showing: "{total} ਵਿੱਚੋਂ {start}-{end} ਦਿਖਾਏ ਜਾ ਰਹੇ ਹਨ", page: "ਪੰਨਾ {current}, ਕੁੱਲ {total}", couldNotLoadModel: "ਐਕਸਟ੍ਰੈਕਸ਼ਨ ਮਾਡਲ ਦੀ ਜਾਣਕਾਰੀ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ।", modelInfo: "{provider}: {model}। ਕੀਮਤ: {pricing}।",
      modelLoadError: "ਮਾਡਲ ਦੀ ਜਾਣਕਾਰੀ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ", exchangeRateError: "ਵਟਾਂਦਰਾ ਦਰ ਦੀ ਬੇਨਤੀ ਅਸਫਲ ਹੋਈ", exchangeRatesUnavailable: "ਵਟਾਂਦਰਾ ਦਰਾਂ ਉਪਲਬਧ ਨਹੀਂ; ਅਸਲ ਮੁਦਰਾ ਦਿਖਾਈ ਜਾ ਰਹੀ ਹੈ।",
      editMerchant: "ਵਪਾਰੀ ਦਾ ਨਾਮ ਸੋਧੋ", deleteReceipt: "ਕੀ ਇਹ ਰਸੀਦ ਮਿਟਾਉਣੀ ਹੈ?", couldNotUpdate: "ਰਸੀਦ ਅੱਪਡੇਟ ਨਹੀਂ ਹੋ ਸਕੀ।", couldNotDelete: "ਰਸੀਦ ਮਿਟਾਈ ਨਹੀਂ ਜਾ ਸਕੀ।",
      noReceiptsYet: "ਹਾਲੇ ਕੋਈ ਰਸੀਦ ਨਹੀਂ। Google Drive ਸਕੈਨ ਕਰੋ ਜਾਂ ਰਸੀਦ ਖੁਦ ਜੋੜੋ।", noReceiptsFound: "ਕੋਈ ਰਸੀਦ ਨਹੀਂ ਮਿਲੀ।", loadedReceipts: "{count} ਰਸੀਦਾਂ ਲੋਡ ਹੋਈਆਂ।", unableLoadReceipts: "ਰਸੀਦਾਂ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀਆਂ।",
      scanning: "ਸਕੈਨ ਹੋ ਰਿਹਾ ਹੈ…", scannedFiles: "{count} ਫ਼ਾਈਲਾਂ ਸਕੈਨ ਹੋਈਆਂ।", errorPrefix: "ਗਲਤੀ: {error}", scanFailed: "ਸਕੈਨ ਅਸਫਲ ਹੋਇਆ।", couldNotLogOut: "ਲੌਗ ਆਉਟ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", logoutRequestFailed: "ਲੌਗ ਆਉਟ ਬੇਨਤੀ ਅਸਫਲ ਹੋਈ",
      uploadReceipts: "ਰਸੀਦਾਂ ਅੱਪਲੋਡ ਕਰੋ", backToList: "ਰਸੀਦ ਸੂਚੀ ਵੱਲ ਵਾਪਸ ਜਾਓ", choosePdf: "PDF ਫ਼ਾਈਲਾਂ ਚੁਣੋ", uploadInstructions: "ਇੱਕ ਵਾਰ ਵਿੱਚ ਵੱਧ ਤੋਂ ਵੱਧ ਪੰਜ PDF ਅੱਪਲੋਡ ਕਰੋ। ਹਰ ਫ਼ਾਈਲ 10 MB ਤੱਕ ਹੋ ਸਕਦੀ ਹੈ। ਫ਼ਾਈਲਾਂ ਤੁਹਾਡੀ ਡਿਵਾਈਸ ਉੱਤੇ ਹੀ ਪ੍ਰੋਸੈਸ ਹੁੰਦੀਆਂ ਹਨ।",
      dropOrBrowse: "PDF ਫ਼ਾਈਲਾਂ ਇੱਥੇ ਛੱਡੋ ਜਾਂ ਬ੍ਰਾਊਜ਼ ਕਰੋ", noFilesSelected: "ਕੋਈ ਫ਼ਾਈਲ ਨਹੀਂ ਚੁਣੀ", selectedCount: "5 ਵਿੱਚੋਂ {count} ਫ਼ਾਈਲਾਂ ਚੁਣੀਆਂ", uploadAndScan: "ਅੱਪਲੋਡ ਕਰੋ ਅਤੇ ਸਕੈਨ ਕਰੋ", clearSelection: "ਚੋਣ ਸਾਫ਼ ਕਰੋ", remove: "ਹਟਾਓ",
      chooseAtMostFive: "ਵੱਧ ਤੋਂ ਵੱਧ ਪੰਜ PDF ਚੁਣੋ।", notPdf: "{name} PDF ਨਹੀਂ ਹੈ।", fileTooLarge: "{name} 10 MB ਦੀ ਹੱਦ ਤੋਂ ਵੱਡੀ ਹੈ।", processing: "ਪ੍ਰੋਸੈਸ ਹੋ ਰਿਹਾ ਹੈ…", uploadingLocally: "PDF ਅੱਪਲੋਡ ਅਤੇ ਸਕੈਨ ਹੋ ਰਹੀਆਂ ਹਨ…",
      uploadFailedRetry: "ਅੱਪਲੋਡ ਅਸਫਲ ਹੋਇਆ। ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", processedFiles: "{total} ਵਿੱਚੋਂ {succeeded} ਫ਼ਾਈਲਾਂ ਪ੍ਰੋਸੈਸ ਹੋਈਆਂ।", amountNotDetected: "ਰਕਮ ਨਹੀਂ ਮਿਲੀ", selectedFiles: "ਚੁਣੀਆਂ ਫ਼ਾਈਲਾਂ", uploadResults: "ਅੱਪਲੋਡ ਨਤੀਜੇ",
      accountName: "Google ਖਾਤਾ", accountLoading: "ਖਾਤਾ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…", signIn: "ਸਾਈਨ ਇਨ", signInTitle: "ਰਸੀਦ ਸਕੈਨਰ ਵਿੱਚ ਸਾਈਨ ਇਨ ਕਰੋ", connectGoogle: "Drive ਵਿੱਚ ਰਸੀਦਾਂ ਦੇਖਣ ਅਤੇ ਸਕੈਨ ਕਰਨ ਲਈ ਆਪਣਾ Google ਖਾਤਾ ਜੋੜੋ।", continueGoogle: "Google ਨਾਲ ਜਾਰੀ ਰੱਖੋ", connectingGoogle: "Google ਨਾਲ ਜੁੜ ਰਿਹਾ ਹੈ…",
      type_receipt: "ਰਸੀਦ", type_invoice: "ਚਲਾਨ", type_bill: "ਬਿੱਲ", type_statement: "ਖਾਤਾ ਵੇਰਵਾ", type_order: "ਆਰਡਰ", type_payment: "ਭੁਗਤਾਨ", type_auction: "ਨਿਲਾਮੀ"
    }
  };

  const supported = Object.keys(messages);
  const localeTags = { en: "en-CA", hi: "hi-IN", pa: "pa-IN" };
  let locale = localStorage.getItem("receiptLanguage");
  if (!supported.includes(locale)) locale = "en";

  function t(key, values = {}) {
    const template = messages[locale][key] || messages.en[key] || key;
    return template.replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? ""));
  }

  function documentType(value) {
    const key = `type_${String(value || "").toLowerCase()}`;
    return messages[locale][key] || value || t("other");
  }

  function formatDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    let year;
    let month;
    let day;
    let match = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (match) {
      [, year, month, day] = match;
    } else if ((match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/))) {
      const first = Number(match[1]);
      const second = Number(match[2]);
      month = first > 12 ? second : first;
      day = first > 12 ? first : second;
      year = match[3];
    } else {
      const monthNumbers = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      match = raw.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/) || raw.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
      if (match && /^[A-Za-z]/.test(match[1])) {
        month = monthNumbers[match[1].slice(0, 3).toLowerCase()];
        day = match[2];
        year = match[3];
      } else if (match) {
        day = match[1];
        month = monthNumbers[match[2].slice(0, 3).toLowerCase()];
        year = match[3];
      } else {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return raw;
        year = parsed.getUTCFullYear();
        month = parsed.getUTCMonth() + 1;
        day = parsed.getUTCDate();
      }
    }

    year = Number(year);
    month = Number(month);
    day = Number(day);
    if (year < 100) year += 2000;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return raw;
    if (locale === "pa") {
      const monthNames = ["ਜਨਵਰੀ", "ਫ਼ਰਵਰੀ", "ਮਾਰਚ", "ਅਪ੍ਰੈਲ", "ਮਈ", "ਜੂਨ", "ਜੁਲਾਈ", "ਅਗਸਤ", "ਸਤੰਬਰ", "ਅਕਤੂਬਰ", "ਨਵੰਬਰ", "ਦਸੰਬਰ"];
      return `${day} ${monthNames[month - 1]} ${year}`;
    }
    return new Intl.DateTimeFormat(localeTags[locale], { dateStyle: "long", timeZone: "UTC" }).format(date);
  }

  function apply() {
    document.documentElement.lang = locale;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });
    const select = document.getElementById("language-select");
    if (select) select.value = locale;
  }

  document.addEventListener("change", (event) => {
    if (event.target.id !== "language-select" || !supported.includes(event.target.value)) return;
    locale = event.target.value;
    localStorage.setItem("receiptLanguage", locale);
    apply();
    window.dispatchEvent(new CustomEvent("receipt-locale-change", { detail: { locale } }));
  });

  window.receiptI18n = { t, apply, documentType, formatDate, getLocale: () => locale, localeTag: () => localeTags[locale] };
  apply();
})();
