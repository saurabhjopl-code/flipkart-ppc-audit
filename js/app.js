document.addEventListener("DOMContentLoaded", () => {

  const raw = localStorage.getItem("rawData");
  if (!raw) return;

  const data = JSON.parse(raw);
  const num = v => Number(v) || 0;

  /* =========================
     SUMMARY
  ========================== */
  let spend = 0, revenue = 0, roiSum = 0, roiCount = 0;
  data.daily.forEach(r => {
    spend += num(r["Ad Spend"]);
    revenue += num(r["Total Revenue (Rs.)"]);
    roiSum += num(r["ROI"]);
    roiCount++;
  });
  const avgROI = roiCount ? roiSum / roiCount : 0;

  /* =========================
     FSN CONSOLIDATION
  ========================== */
  const fsnMap = {};
  data.fsn.forEach(r => {
    const fsn = r["Sku Id"];
    if (!fsnMap[fsn]) {
      fsnMap[fsn] = { views: 0, clicks: 0, revenue: 0, roiList: [] };
    }
    fsnMap[fsn].views += num(r["Views"]);
    fsnMap[fsn].clicks += num(r["Clicks"]);
    fsnMap[fsn].revenue += num(r["Total Revenue (Rs.)"]);
    fsnMap[fsn].roiList.push(num(r["ROI"]));
  });

  /* =========================
     PLACEMENT CONSOLIDATION
  ========================== */
  const placementMap = {};
  data.placement.forEach(r => {
    const p = r["Placement Type"];
    if (!placementMap[p]) {
      placementMap[p] = { spend: 0, revenue: 0 };
    }
    placementMap[p].spend += num(r["Ad Spend"]);
    placementMap[p].revenue += num(r["Direct Revenue"]) + num(r["Indirect Revenue"]);
  });

  /* =========================
     CAMPAIGN ORDERS
  ========================== */
  let totalOrders = 0, campaignRevenue = 0;
  const orderSet = new Set();

  data.campaign.forEach(r => {
    const key = r["order_id"] || `${r["Campaign ID"]}_${r["Date"]}_${r["Purchased FSN ID"]}`;
    if (!orderSet.has(key)) {
      orderSet.add(key);
      totalOrders += num(r["Direct Units Sold"]) + num(r["Indirect Units Sold"]);
      campaignRevenue += num(r["Total Revenue (Rs.)"]);
    }
  });

  /* =========================
     AUDIT SCORE + ISSUES
  ========================== */
  let auditScore = 100;
  const issues = [];

  Object.values(fsnMap).forEach(r => {
    const worstROI = Math.min(...r.roiList);
    if (worstROI < 1) {
      auditScore -= 2;
    } else if (worstROI < 1.5) {
      auditScore -= 1;
    }
  });

  Object.entries(placementMap).forEach(([p, r]) => {
    const roi = r.spend ? r.revenue / r.spend : 0;
    if (roi < avgROI) {
      issues.push(`Placement "${p}" underperforming vs account average`);
      auditScore -= 2;
    }
  });

  if (avgROI < 1.5) {
    issues.push("Overall account ROI below healthy benchmark");
    auditScore -= 5;
  }

  auditScore = Math.max(auditScore, 20);

  /* =========================
     RENDER SUMMARY
  ========================== */
  document.getElementById("summaryTable").innerHTML = `
    <tr><td><b>Total Ad Spend</b></td><td>₹${spend.toLocaleString()}</td></tr>
    <tr><td><b>Total Revenue</b></td><td>₹${revenue.toLocaleString()}</td></tr>
    <tr><td><b>Average ROI</b></td><td>${avgROI.toFixed(2)}</td></tr>
    <tr><td><b>Total Orders</b></td><td>${totalOrders}</td></tr>
    <tr><td><b>Total FSNs</b></td><td>${Object.keys(fsnMap).length}</td></tr>
  `;

  document.getElementById("auditScore").textContent = auditScore;

  /* =========================
     RENDER CRITICAL ISSUES
  ========================== */
  const issueBox = document.getElementById("criticalIssues");
  issues.slice(0, 8).forEach(i => {
    const li = document.createElement("li");
    li.textContent = i;
    issueBox.appendChild(li);
  });

  /* =========================
     RENDER FSN TABLE
  ========================== */
  const fsnTable = document.getElementById("fsnTable");
  Object.entries(fsnMap).forEach(([fsn, r]) => {
    const worstROI = Math.min(...r.roiList);
    let status = "Good", cls = "status-good";
    if (worstROI < 1) { status = "Bad"; cls = "status-bad"; }
    else if (worstROI < 1.5) { status = "Needs Fix"; cls = "status-fix"; }

    fsnTable.innerHTML += `
      <tr>
        <td>${fsn}</td>
        <td>${r.views}</td>
        <td>${r.clicks}</td>
        <td>${r.revenue.toLocaleString()}</td>
        <td>${worstROI.toFixed(2)}</td>
        <td class="${cls}">${status}</td>
      </tr>`;
  });

  /* =========================
     RENDER PLACEMENT TABLE
  ========================== */
  const placementTable = document.getElementById("placementTable");
  Object.entries(placementMap).forEach(([p, r]) => {
    const roi = r.spend ? r.revenue / r.spend : 0;
    const rec = roi >= avgROI ? "Scale" : "Reduce";

    placementTable.innerHTML += `
      <tr>
        <td>${p}</td>
        <td>${r.spend.toLocaleString()}</td>
        <td>${r.revenue.toLocaleString()}</td>
        <td>${roi.toFixed(2)}</td>
        <td>${rec}</td>
      </tr>`;
  });

  /* =========================
     CAMPAIGN SUMMARY
  ========================== */
  document.getElementById("campaignSummary").innerHTML = `
    <p><b>Total Orders:</b> ${totalOrders}</p>
    <p><b>Campaign Revenue:</b> ₹${campaignRevenue.toLocaleString()}</p>
  `;
});
