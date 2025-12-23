/***********************
  GLOBAL HELPERS
************************/
const num = v => Number(v) || 0;
const uploaded = {};
const recommendations = [];

/***********************
  CSV PARSER
************************/
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(row => {
    const values = row.split(",");
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || "");
    return obj;
  });
}

/***********************
  FILE UPLOAD BINDING
************************/
function bindUpload(inputId, key, statusId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      uploaded[key] = parseCSV(ev.target.result);
      document.getElementById(statusId).textContent = "Uploaded ✓";
      document.getElementById(statusId).style.color = "green";

      // enable button only when all files uploaded
      const ready = ["daily", "fsn", "placement", "campaign"]
        .every(k => uploaded[k] && uploaded[k].length > 0);

      const btn = document.getElementById("generateAudit");
      if (btn) btn.disabled = !ready;
    };
    reader.readAsText(file);
  });
}

/***********************
  INDEX PAGE INIT
************************/
function initIndexPage() {
  bindUpload("dailyFile", "daily", "dailyStatus");
  bindUpload("fsnFile", "fsn", "fsnStatus");
  bindUpload("placementFile", "placement", "placementStatus");
  bindUpload("campaignFile", "campaign", "campaignStatus");

  const btn = document.getElementById("generateAudit");
  if (!btn) return;

  btn.addEventListener("click", () => {
    localStorage.setItem("auditData", JSON.stringify(uploaded));
    window.location.href = "audit.html";
  });
}

/***********************
  AUDIT PAGE RENDER
************************/
function renderAudit() {
  const raw = localStorage.getItem("auditData");
  if (!raw) {
    alert("No data found. Please upload files again.");
    window.location.href = "index.html";
    return;
  }

  const data = JSON.parse(raw);

  /* =========================
     CAMPAIGN PERFORMANCE
  ========================== */
  const campaignMap = {};

  data.campaign.forEach(r => {
    const c = r["Campaign Name"] || r["Campaign ID"];
    if (!campaignMap[c]) {
      campaignMap[c] = {
        direct: 0,
        indirect: 0,
        orders: new Set(),
        revenue: 0,
        views: 0,
        clicks: 0
      };
    }
    campaignMap[c].direct += num(r["Direct Units Sold"]);
    campaignMap[c].indirect += num(r["Indirect Units Sold"]);
    campaignMap[c].revenue += num(r["Total Revenue (Rs.)"]);
    if (r.order_id) campaignMap[c].orders.add(r.order_id);
  });

  data.daily.forEach(r => {
    const c = r["Campaign Name"] || r["Campaign ID"];
    if (!campaignMap[c]) return;
    campaignMap[c].views += num(r["Views"]);
    campaignMap[c].clicks += num(r["Clicks"]);
  });

  const cp = document.getElementById("campaignPerformance");
  const di = document.getElementById("directIndirect");
  const cf = document.getElementById("campaignFunnel");

  Object.entries(campaignMap).forEach(([c, v]) => {
    cp.innerHTML += `
      <tr>
        <td>${c}</td>
        <td>${v.direct}</td>
        <td>${v.indirect}</td>
        <td>${v.orders.size}</td>
        <td>${v.revenue.toLocaleString()}</td>
      </tr>`;

    const totalUnits = v.direct + v.indirect;
    const dPct = totalUnits ? (v.direct / totalUnits * 100).toFixed(1) : "0.0";
    const iPct = (100 - dPct).toFixed(1);
    const type = dPct >= 60 ? "Closing-heavy" : (iPct >= 60 ? "Halo-heavy" : "Balanced");

    di.innerHTML += `
      <tr>
        <td>${c}</td>
        <td>${dPct}%</td>
        <td>${iPct}%</td>
        <td>${type}</td>
      </tr>`;

    let issue = "Healthy";
    if (v.orders.size === 0 && v.clicks > 0) issue = "Click Leakage";
    else if (v.orders.size === 0) issue = "Zero Orders";

    cf.innerHTML += `
      <tr>
        <td>${c}</td>
        <td>${v.views}</td>
        <td>${v.clicks}</td>
        <td>${v.orders.size}</td>
        <td>${issue}</td>
      </tr>`;

    recommendations.push({ Type: "Campaign", Name: c, Action: issue });
  });

  /* =========================
     DOWNLOAD RECOMMENDATIONS
  ========================== */
  const dl = document.getElementById("downloadReco");
  if (dl) {
    dl.onclick = () => {
      const csv =
        "Type,Name,Action\n" +
        recommendations.map(r => `${r.Type},${r.Name},${r.Action}`).join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Flipkart_PPC_Recommendations.csv";
      a.click();
    };
  }
}

/***********************
  BOOTSTRAP
************************/
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("dailyFile")) {
    initIndexPage();          // index.html
  } else {
    renderAudit();            // audit.html
  }
});
