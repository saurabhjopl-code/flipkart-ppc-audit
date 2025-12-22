<script src="js/app.js"></script>
const CONFIG = {
  ROI_BREAK_EVEN: 1.5,
  HIGH_RETURN_PCT: 20,
  ZERO_ORDER_CLICK_THRESHOLD: 50,
  HIGH_DEPENDENCY_PCT: 65
};
const HEADERS = {
  daily: [
    "Date", "Gross Units", "GMV", "Return (35%)", "Net",
    "PLA Spend", "Sale through PLA", "ROI", "RETURN %"
  ],
  fsn: [
    "FSN", "PLA Spend", "Sale through PLA", "GMV",
    "PLA Units Sold", "ROI", "PLA Unit Sold %"
  ],
  placement: [
    "Placement Type", "PLA Spend", "Sale through PLA",
    "Units Sold", "ROI"
  ],
  campaign: [
    "Campaign Name", "Clicks", "Orders", "Spend"
  ]
};
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i]?.trim() || "");
    return obj;
  });
  return { headers, rows };
}
function validateHeaders(actual, expected) {
  return expected.every(h => actual.includes(h));
}
function toNumber(val) {
  if (!val) return 0;
  return Number(val.replace(/₹|%|,/g, "").trim()) || 0;
}
const uploadedData = {};

function handleFileUpload(type, file) {
  const reader = new FileReader();
  reader.onload = e => {
    const parsed = parseCSV(e.target.result);

    if (!validateHeaders(parsed.headers, HEADERS[type])) {
      alert(`Invalid headers in ${type} report`);
      return;
    }

    uploadedData[type] = parsed.rows;
    checkAllFilesUploaded();
  };
  reader.readAsText(file);
}
function checkAllFilesUploaded() {
  const ready = ["daily", "fsn", "placement", "campaign"]
    .every(k => uploadedData[k]);

  if (ready) {
    document.getElementById("generateAudit").disabled = false;
    document.getElementById("validation-summary").classList.remove("hidden");
  }
}
function runAudit(data) {
  const audit = {
    summary: {},
    redFlags: [],
    fsnActions: [],
    placementActions: [],
    campaignIssues: [],
    score: 100
  };

  auditSpendLeakage(data, audit);
  auditFSN(data, audit);
  auditPlacement(data, audit);
  auditCampaigns(data, audit);

  return audit;
}
function auditSpendLeakage(data, audit) {
  data.fsn.forEach(row => {
    const spend = toNumber(row["PLA Spend"]);
    const revenue = toNumber(row["Sale through PLA"]);

    if (spend > 0 && revenue === 0) {
      audit.redFlags.push(
        `₹${spend.toLocaleString()} spent on FSN ${row.FSN} with zero sales`
      );
      audit.score -= 2;
    }
  });
}
function auditFSN(data, audit) {
  data.fsn.forEach(row => {
    const roi = toNumber(row["ROI"]);
    const spend = toNumber(row["PLA Spend"]);

    if (spend === 0) return;

    let action = "OPTIMIZE";

    if (roi < CONFIG.ROI_BREAK_EVEN) action = "PAUSE";
    if (roi >= 3) action = "SCALE";

    audit.fsnActions.push({
      fsn: row.FSN,
      spend,
      revenue: toNumber(row["Sale through PLA"]),
      roi,
      action
    });
  });
}
function auditPlacement(data, audit) {
  data.placement.forEach(row => {
    const roi = toNumber(row["ROI"]);
    let rec = "OPTIMIZE";

    if (roi < CONFIG.ROI_BREAK_EVEN) rec = "CUT";
    if (roi >= 3) rec = "SCALE";

    audit.placementActions.push({
      placement: row["Placement Type"],
      roi,
      recommendation: rec
    });
  });
}
function auditCampaigns(data, audit) {
  data.campaign.forEach(row => {
    const clicks = toNumber(row.Clicks);
    const orders = toNumber(row.Orders);
    const spend = toNumber(row.Spend);

    if (clicks >= CONFIG.ZERO_ORDER_CLICK_THRESHOLD && orders === 0) {
      audit.campaignIssues.push(
        `Campaign ${row["Campaign Name"]} spent ₹${spend} with ${clicks} clicks and zero orders`
      );
      audit.score -= 3;
    }
  });
}
function saveAudit(audit) {
  localStorage.setItem("ppcAudit", JSON.stringify(audit));
  window.location.href = "audit.html";
}

function loadAudit() {
  return JSON.parse(localStorage.getItem("ppcAudit"));
}
document.addEventListener("DOMContentLoaded", () => {
  const audit = loadAudit();
  if (!audit) return;

  document.querySelector(".audit-score").textContent =
    `Audit Score: ${audit.score}`;

  const ul = document.querySelector(".red-flags");
  audit.redFlags.forEach(f => {
    const li = document.createElement("li");
    li.textContent = f;
    ul.appendChild(li);
  });
});
