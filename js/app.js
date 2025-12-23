/************************************************
 * COMMON HELPERS
 ************************************************/
const num = v => Number(v) || 0;

/************************************************
 * UPLOAD PAGE LOGIC (index.html)
 ************************************************/
const uploadedData = {};

const HEADERS = {
  daily: ["Campaign ID","Campaign Name","Date","Ad Spend","Views","Clicks","Total converted units","Total Revenue (Rs.)","ROI"],
  fsn: ["Campaign ID","Campaign Name","AdGroup ID","AdGroup Name","Sku Id","Product Name","Views","Clicks","Direct Units Sold","Indirect Units Sold","Total Revenue (Rs.)","Conversion Rate","ROI"],
  placement: ["Campaign ID","Campaign Name","AdGroup Name","Placement Type","Views","Clicks","Click Through Rate in %","Average CPC","Conversion Rate","Ad Spend","Direct Units Sold","Indirect Units Sold","Direct Revenue","Indirect Revenue","ROI"],
  campaign: ["Campaign ID","AdGroup Name","Listing ID","Product Name","Advertised FSN ID","Date","order_id","AdGroup CPC","Expected ROI","Purchased FSN ID","Total Revenue (Rs.)","Direct Units Sold","Indirect Units Sold"]
};

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(l => {
    const v = l.split(",");
    const o = {};
    headers.forEach((h, i) => o[h] = v[i]?.trim() || "");
    return o;
  });
  return { headers, rows };
}

function validateHeaders(actual, expected) {
  return expected.every(h => actual.includes(h));
}

function bindUpload(inputId, type, statusId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    const status = document.getElementById(statusId);
    status.textContent = "Validating…";
    status.style.color = "#555";

    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target.result);
      if (!validateHeaders(parsed.headers, HEADERS[type])) {
        status.textContent = "Invalid header ✕";
        status.style.color = "red";
        return;
      }
      uploadedData[type] = parsed.rows;
      status.textContent = "Uploaded ✓";
      status.style.color = "green";
      checkReady();
    };
    reader.readAsText(file);
  });
}

function checkReady() {
  const ready = ["daily","fsn","placement","campaign"].every(k => uploadedData[k]);
  const btn = document.getElementById("generateAudit");
  const summary = document.getElementById("validation-summary");
  if (btn) btn.disabled = !ready;
  if (summary) summary.classList.toggle("hidden", !ready);
}

function runAudit() {
  localStorage.setItem("rawData", JSON.stringify(uploadedData));
  window.location.href = "audit.html";
}

/************************************************
 * AUDIT PAGE LOGIC (audit.html)
 ************************************************/
function renderAudit() {
  const raw = localStorage.getItem("rawData");
  if (!raw) return;

  const data = JSON.parse(raw);

  /* ---------- SUMMARY ---------- */
  let totalSpend = 0, totalRevenue = 0, roiSum = 0, roiCount = 0;

  data.daily.forEach(r => {
    totalSpend += num(r["Ad Spend"]);
    totalRevenue += num(r["Total Revenue (Rs.)"]);
    roiSum += num(r["ROI"]);
    roiCount++;
  });

  const avgROI = roiCount ? roiSum / roiCount : 0;

  /* ---------- SKU PERFORMANCE ---------- */
  const skuMap = {};
  let totalClicks = 0;
  let anomalyCount = 0;

  data.fsn.forEach(r => {
    const sku = r["Sku Id"];
    if (!skuMap[sku]) {
      skuMap[sku] = { views: 0, clicks: 0, revenue: 0, roiList: [] };
    }

    const views = num(r["Views"]);
    const clicks = num(r["Clicks"]);
    const effectiveViews = views === 0 && clicks > 0 ? clicks : views;
    if (views === 0 && clicks > 0) anomalyCount++;

    skuMap[sku].views += effectiveViews;
    skuMap[sku].clicks += clicks;
    skuMap[sku].revenue += num(r["Total Revenue (Rs.)"]);
    skuMap[sku].roiList.push(num(r["ROI"]));

    totalClicks += clicks;
  });

  Object.values(skuMap).forEach(sku => {
    sku.spend = totalClicks ? (sku.clicks / totalClicks) * totalSpend : 0;
  });

  /* ---------- PLACEMENTS ---------- */
  const placementMap = {};
  data.placement.forEach(r => {
    const p = r["Placement Type"];
    if (!placementMap[p]) placementMap[p] = { spend: 0, revenue: 0 };
    placementMap[p].spend += num(r["Ad Spend"]);
    placementMap[p].revenue += num(r["Direct Revenue"]) + num(r["Indirect Revenue"]);
  });

  /* ---------- CAMPAIGN ORDERS ---------- */
  const orderSet = new Set();
  let totalOrders = 0, campaignRevenue = 0;

  data.campaign.forEach(r => {
    const id = r["order_id"];
    if (!id || orderSet.has(id)) return;
    orderSet.add(id);
    totalOrders += num(r["Direct Units Sold"]) + num(r["Indirect Units Sold"]);
    campaignRevenue += num(r["Total Revenue (Rs.)"]);
  });

  /* ---------- AUDIT SCORE ---------- */
  let auditScore = 100;
  const issues = [];

  Object.values(skuMap).forEach(s => {
    const roi = Math.min(...s.roiList);
    if (roi < 1) auditScore -= 2;
    else if (roi < 1.5) auditScore -= 1;
  });

  Object.entries(placementMap).forEach(([p, r]) => {
    const roi = r.spend ? r.revenue / r.spend : 0;
    if (roi < avgROI) {
      issues.push(`Placement "${p}" underperforming vs account average`);
      auditScore -= 2;
    }
  });

  if (anomalyCount) {
    issues.push(`${anomalyCount} SKUs show clicks without views`);
  }

  auditScore = Math.max(auditScore, 30);

  /* ---------- RENDER ---------- */
  document.getElementById("auditScore").textContent = auditScore;

  document.getElementById("summaryTable").innerHTML = `
    <tr><td><b>Total Ad Spend</b></td><td>₹${totalSpend.toLocaleString()}</td></tr>
    <tr><td><b>Total Revenue</b></td><td>₹${totalRevenue.toLocaleString()}</td></tr>
    <tr><td><b>Average ROI</b></td><td>${avgROI.toFixed(2)}</td></tr>
    <tr><td><b>Total Orders</b></td><td>${totalOrders}</td></tr>
    <tr><td><b>Total SKUs</b></td><td>${Object.keys(skuMap).length}</td></tr>
  `;

  const issueBox = document.getElementById("criticalIssues");
  issues.slice(0,8).forEach(i => {
    const li = document.createElement("li");
    li.textContent = i;
    issueBox.appendChild(li);
  });

  /* ---------- SKU TABLE ---------- */
  const skuEntries = Object.entries(skuMap)
    .map(([sku, s]) => {
      const roi = Math.min(...s.roiList);
      let status = "Good", cls = "status-good";
      if (roi < 1) { status="Bad"; cls="status-bad"; }
      else if (roi < 1.5) { status="Needs Fix"; cls="status-fix"; }
      return { sku, ...s, roi, status, cls };
    })
    .sort((a,b)=>a.roi-b.roi);

  const skuTable = document.getElementById("skuTable");
  let expanded = false;

  function renderSku() {
    skuTable.innerHTML = "";
    const rows = expanded ? skuEntries : skuEntries.slice(0,15);
    rows.forEach(r=>{
      skuTable.innerHTML += `
        <tr>
          <td>${r.sku}</td>
          <td>${r.views}</td>
          <td>${r.clicks}</td>
          <td>${r.spend.toFixed(2)}</td>
          <td>${r.revenue.toLocaleString()}</td>
          <td>${r.roi.toFixed(2)}</td>
          <td class="${r.cls}">${r.status}</td>
        </tr>`;
    });
  }

  document.getElementById("toggleSku").onclick = ()=>{
    expanded=!expanded;
    document.getElementById("toggleSku").textContent =
      expanded ? "Show top 15 only" : "Show all SKUs";
    renderSku();
  };

  renderSku();

  /* ---------- PLACEMENT TABLE ---------- */
  const placementTable = document.getElementById("placementTable");
  Object.entries(placementMap).forEach(([p,r])=>{
    const roi = r.spend ? r.revenue / r.spend : 0;
    placementTable.innerHTML += `
      <tr>
        <td>${p}</td>
        <td>${r.spend.toLocaleString()}</td>
        <td>${r.revenue.toLocaleString()}</td>
        <td>${roi.toFixed(2)}</td>
        <td>${roi>=avgROI?"Scale":"Reduce"}</td>
      </tr>`;
  });

  document.getElementById("campaignSummary").innerHTML = `
    <p><b>Total Orders:</b> ${totalOrders}</p>
    <p><b>Campaign Revenue:</b> ₹${campaignRevenue.toLocaleString()}</p>
  `;
}

/************************************************
 * INIT
 ************************************************/
document.addEventListener("DOMContentLoaded", () => {

  // Upload page
  if (document.getElementById("dailyFile")) {
    bindUpload("dailyFile","daily","dailyStatus");
    bindUpload("fsnFile","fsn","fsnStatus");
    bindUpload("placementFile","placement","placementStatus");
    bindUpload("campaignFile","campaign","campaignStatus");
    document.getElementById("generateAudit").onclick = runAudit;
  }

  // Audit page
  if (document.getElementById("skuTable")) {
    renderAudit();
  }
});
