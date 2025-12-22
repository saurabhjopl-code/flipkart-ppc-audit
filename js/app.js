const CONFIG = {
  ROI_BREAK_EVEN: 1.5,
  ZERO_ORDER_CLICK_THRESHOLD: 50
};

const uploadedData = {};

/* ---------- HEADER DEFINITIONS (LOGICAL MATCHING) ---------- */

const HEADER_MAP = {
  daily: ["date"],
  fsn: ["fsn", "pla spend", "sale through pla", "roi"],
  placement: ["placement", "pla spend", "roi"],
  campaign: ["campaign", "clicks", "orders", "spend"]
};

/* ---------- HELPERS ---------- */

function normalizeHeader(h) {
  return h
    .toLowerCase()
    .replace(/₹|\(|\)|%/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h] = values[i]?.trim() || ""));
    return obj;
  });
  return { headers, rows };
}

function validateHeaders(actualHeaders, requiredKeys) {
  const normalized = actualHeaders.map(normalizeHeader);
  return requiredKeys.every(req =>
    normalized.some(h => h.includes(req))
  );
}

function toNumber(v) {
  return Number(String(v).replace(/₹|%|,/g, "")) || 0;
}

/* ---------- FILE UPLOAD ---------- */

function handleFileUpload(type, file, statusEl) {
  const reader = new FileReader();

  reader.onload = e => {
    const parsed = parseCSV(e.target.result);

    if (!validateHeaders(parsed.headers, HEADER_MAP[type])) {
      statusEl.textContent = "Invalid header ✕";
      statusEl.style.color = "red";
      delete uploadedData[type];
      checkAllFilesUploaded();
      return;
    }

    uploadedData[type] = parsed.rows;

    statusEl.textContent = "Uploaded ✓";
    statusEl.style.color = "green";

    checkAllFilesUploaded();
  };

  reader.onerror = () => {
    statusEl.textContent = "Read error ✕";
    statusEl.style.color = "red";
  };

  reader.readAsText(file);
}

function bindFile(inputId, type, statusId) {
  const input = document.getElementById(inputId);
  const status = document.getElementById(statusId);

  if (!input || !status) return;

  input.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    status.textContent = "Validating...";
    status.style.color = "#f59e0b";

    handleFileUpload(type, file, status);
  });
}

function checkAllFilesUploaded() {
  const ready = ["daily", "fsn", "placement", "campaign"].every(
    k => uploadedData[k]
  );

  const btn = document.getElementById("generateAudit");
  const summary = document.getElementById("validation-summary");

  if (ready) {
    btn.disabled = false;
    summary.classList.remove("hidden");
  } else {
    btn.disabled = true;
    summary.classList.add("hidden");
  }
}

/* ---------- AUDIT LOGIC ---------- */

function runAudit() {
  const audit = {
    redFlags: [],
    score: 100
  };

  uploadedData.fsn.forEach(r => {
    const spend = toNumber(r["PLA Spend"] || r["PLA Spend (₹)"]);
    const roi = toNumber(r["ROI"] || r["ROI (%)"]);

    if (spend > 0 && roi < CONFIG.ROI_BREAK_EVEN) {
      audit.redFlags.push(`Low ROI FSN detected (ROI ${roi})`);
      audit.score -= 2;
    }
  });

  uploadedData.campaign.forEach(r => {
    if (
      toNumber(r.Clicks) >= CONFIG.ZERO_ORDER_CLICK_THRESHOLD &&
      toNumber(r.Orders) === 0
    ) {
      audit.redFlags.push("Campaign with clicks but zero orders");
      audit.score -= 3;
    }
  });

  localStorage.setItem("audit", JSON.stringify(audit));
  window.location.href = "audit.html";
}

/* ---------- INIT ---------- */

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("dailyFile")) {
    bindFile("dailyFile", "daily", "dailyStatus");
    bindFile("fsnFile", "fsn", "fsnStatus");
    bindFile("placementFile", "placement", "placementStatus");
    bindFile("campaignFile", "campaign", "campaignStatus");

    document.getElementById("generateAudit").onclick = runAudit;
  }

  if (document.getElementById("redFlags")) {
    const audit = JSON.parse(localStorage.getItem("audit"));
    if (!audit) return;

    document.getElementById("score").textContent = audit.score;

    audit.redFlags.forEach(f => {
      const li = document.createElement("li");
      li.textContent = f;
      document.getElementById("redFlags").appendChild(li);
    });

    document.getElementById("downloadPDF").onclick = () => {
      html2pdf()
        .from(document.getElementById("pdfContent"))
        .save("Flipkart_PPC_Audit_Report.pdf");
    };
  }
});
