document.addEventListener("DOMContentLoaded", () => {

  const raw = localStorage.getItem("rawData");
  if (!raw) return;

  const data = JSON.parse(raw);
  const num = v => Number(v) || 0;

  /* =========================
     SUMMARY (DAILY)
  ========================== */
  let totalSpend = 0;
  let totalRevenue = 0;
  let roiSum = 0;
  let roiCount = 0;

  data.daily.forEach(r => {
    totalSpend += num(r["Ad Spend"]);
    totalRevenue += num(r["Total Revenue (Rs.)"]);
    roiSum += num(r["ROI"]);
    roiCount++;
  });

  const avgROI = roiCount ? roiSum / roiCount : 0;

  /* =========================
     SKU PERFORMANCE (FSN FILE)
  ========================== */
  const skuMap = {};
  let totalClicks = 0;
  let anomalyCount = 0;

  data.fsn.forEach(r => {
    const sku = r["Sku Id"];
    if (!skuMap[sku]) {
      skuMap[sku] = {
        views: 0,
        clicks: 0,
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
    skuMap[sku].revenue += num(r["Total Revenue (Rs.)"]);
    skuMap[sku].roiList.push(num(r["ROI"]));

    totalClicks += clicks;
  });

  /* =========================
     DISTRIBUTE AD SPEND TO SKU
     (PROPORTIONAL TO CLICKS)
  ========================== */
  Object.values(skuMap).forEach(sku => {
    sku.spend = totalClicks > 0
      ? (sku.clicks / totalClicks) * totalSpend
      : 0;
  });

  /* =========================
     PLACEMENT PERFORMANCE
  ========================== */
  const placementMap = {};
  data.placement.forEach(r => {
    const p = r["Placement Type"];
    if (!placementMap[p]) {
      placementMap[p] = { spend: 0, revenue: 0 };
    }
    placementMap[p].spend += num(r["Ad Spend"]);
    placementMap[p].revenue +=
      num(r["Direct Revenue"]) + num(r["Indirect Revenue"]);
  });

  /* =========================
     CAMPAIGN ORDERS (CORRECT)
  ========================== */
  const orderSet = new Set();
  let totalOrders = 0;
  let campaignRevenue = 0;

  data.campaign.forEach(r => {
    const orderId = r["order_id"];
    if (!orderId || orderSet.has(orderId)) return;

    orderSet.add(orderId);
    totalOrders +=
      num(r["Direct Units Sold"]) + num(r["Indirect Units Sold"]);
    campaignRevenue += num(r["Total Revenue (Rs.)"]);
  });

  /* =========================
     AUDIT SCORE + ISSUES
  ========================== */
  let auditScore = 100;
  const issues = [];

  Object.values(skuMap).forEach(s => {
    const worstROI = Math.min(...s.roiList);
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
    issues.push(`${anomalyCount} SKUs show clicks without recorded views`);
  }

  auditScore = Math.max(auditScore, 30);

  /* =========================
     RENDER SUMMARY
  ========================== */
  document.getElementById("summaryTable").innerHTML = `
    <tr><td><b>Total Ad Spend</b></td><td>₹${totalSpend.toLocaleString()}</td></tr>
    <tr><td><b>Total Revenue</b></td><td>₹${totalRevenue.toLocaleString()}</td></tr>
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
    .map(([sku, s]) => {
      const roi = Math.min(...s.roiList);
      let status = "Good", cls = "status-good";
      if (roi < 1) { status = "Bad"; cls = "status-bad"; }
      else if (roi < 1.5) { status = "Needs Fix"; cls = "status-fix"; }
      return { sku, ...s, roi, status, cls };
    })
    .sort((a, b) => a.roi - b.roi);

  const skuTable = document.getElementById("skuTable");
  let expanded = false;

  function renderSku() {
    skuTable.innerHTML = "";
    const rows = expanded ? skuEntries : skuEntries.slice(0, 15);
    rows.forEach(r => {
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

  document.getElementById("toggleSku").onclick = () => {
    expanded = !expanded;
    document.getElementById("toggleSku").textContent =
      expanded ? "Show top 15 only" : "Show all SKUs";
    renderSku();
  };

  renderSku();

  /* =========================
     PLACEMENT TABLE
  ========================== */
  const placementTable = document.getElementById("placementTable");
  Object.entries(placementMap).forEach(([p, r]) => {
    const roi = r.spend ? r.revenue / r.spend : 0;
    placementTable.innerHTML += `
      <tr>
        <td>${p}</td>
        <td>${r.spend.toLocaleString()}</td>
        <td>${r.revenue.toLocaleString()}</td>
        <td>${roi.toFixed(2)}</td>
        <td>${roi >= avgROI ? "Scale" : "Reduce"}</td>
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
