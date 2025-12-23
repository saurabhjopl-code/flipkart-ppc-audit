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
     SKU CONSOLIDATION
  ========================== */
  const skuMap = {};
  let anomalyCount = 0;

  data.fsn.forEach(r => {
    const sku = r["Sku Id"];
    if (!skuMap[sku]) {
      skuMap[sku] = {
        views: 0,
        clicks: 0,
        spend: 0,
        revenue: 0,
        roiList: []
      };
    }

    const views = num(r["Views"]);
    const clicks = num(r["Clicks"]);
    const effectiveViews = views === 0 && clicks > 0 ? clicks : views;

    if (views === 0 && clicks > 0) anomalyCount++;

    skuMap[sku].views += effectiveViews;
    skuMap[sku].clicks += clicks;
    skuMap[sku].spend += num(r["Ad Spend"] || 0);
    skuMap[sku].revenue += num(r["Total Revenue (Rs.)"]);
    skuMap[sku].roiList.push(num(r["ROI"]));
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
     CAMPAIGN ORDERS (NO DEDUP)
  ========================== */
  let totalOrders = 0;
  let campaignRevenue = 0;

  data.campaign.forEach(r => {
    totalOrders += num(r["Direct Units Sold"]) + num(r["Indirect Units Sold"]);
    campaignRevenue += num(r["Total Revenue (Rs.)"]);
  });

  /* =========================
     AUDIT SCORE + ISSUES
  ========================== */
  let auditScore = 100;
  const issues = [];

  Object.values(skuMap).forEach(r => {
    const worstROI = Math.min(...r.roiList);
    if (worstROI < 1) auditScore -= 2;
    else if (worstROI < 1.5) auditScore -= 1;
  });

  Object.entries(placementMap).forEach(([p, r]) => {
    const roi = r.spend ? r.revenue / r.spend : 0;
    if (roi < avgROI) {
      issues.push(`Placement "${p}" underperforming vs account average`);
      auditScore -= 2;
    }
  });

  if (anomalyCount > 0) {
    issues.push(`${anomalyCount} SKUs show clicks without recorded views (reporting anomaly)`);
  }

  auditScore = Math.max(auditScore, 25);

  /* =========================
     RENDER SUMMARY
  ========================== */
  document.getElementById("summaryTable").innerHTML = `
    <tr><td><b>Total Ad Spend</b></td><td>₹${spend.toLocaleString()}</td></tr>
    <tr><td><b>Total Revenue</b></td><td>₹${revenue.toLocaleString()}</td></tr>
    <tr><td><b>Average ROI</b></td><td>${avgROI.toFixed(2)}</td></tr>
    <tr><td><b>Total Orders</b></td><td>${totalOrders}</td></tr>
    <tr><td><b>Total SKUs</b></td><td>${Object.keys(skuMap).length}</td></tr>
  `;

  document.getElementById("auditScore").textContent = auditScore;

  /* =========================
     CRITICAL ISSUES
  ========================== */
  const issueBox = document.getElementById("criticalIssues");
  issues.slice(0, 8).forEach(i => {
    const li = document.createElement("li");
    li.textContent = i;
    issueBox.appendChild(li);
  });

  /* =========================
     SKU TABLE (EXPAND / COLLAPSE)
  ========================== */
  const skuEntries = Object.entries(skuMap)
    .map(([sku, r]) => {
      const worstROI = Math.min(...r.roiList);
      let status = "Good", cls = "status-good";
      if (worstROI < 1) { status = "Bad"; cls = "status-bad"; }
      else if (worstROI < 1.5) { status = "Needs Fix"; cls = "status-fix"; }

      return { sku, ...r, roi: worstROI, status, cls };
    })
    .sort((a, b) => a.roi - b.roi);

  const skuTable = document.getElementById("skuTable");
  let expanded = false;

  function renderSkuTable() {
    skuTable.innerHTML = "";
    const rows = expanded ? skuEntries : skuEntries.slice(0, 15);
    rows.forEach(r => {
      skuTable.innerHTML += `
        <tr>
          <td>${r.sku}</td>
          <td>${r.views}</td>
          <td>${r.clicks}</td>
          <td>${r.spend.toLocaleString()}</td>
          <td>${r.revenue.toLocaleString()}</td>
          <td>${r.roi.toFixed(2)}</td>
          <td class="${r.cls}">${r.status}</td>
        </tr>`;
    });
  }

  document.getElementById("toggleSku").onclick = () => {
    expanded = !expanded;
    document.getElementById("toggleSku").textContent =
      expanded ? "Show top 15 only" : "Show all SKUs";
    renderSkuTable();
  };

  renderSkuTable();

  /* =========================
     PLACEMENT TABLE
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
