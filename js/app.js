document.addEventListener("DOMContentLoaded", () => {

  const raw = localStorage.getItem("rawData");
  if (!raw || !document.getElementById("fsnTable")) return;

  const data = JSON.parse(raw);

  /* ---------- HELPERS ---------- */
  const num = v => Number(v) || 0;

  /* ---------- SUMMARY ---------- */
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

  const avgROI = roiCount ? (roiSum / roiCount).toFixed(2) : 0;

  const summaryRows = [
    ["Total Ad Spend", `₹${totalSpend.toLocaleString()}`],
    ["Total Revenue", `₹${totalRevenue.toLocaleString()}`],
    ["Average ROI", avgROI],
    ["Total FSNs", Object.keys(groupByFSN(data.fsn)).length]
  ];

  document.getElementById("summaryTable").innerHTML =
    summaryRows.map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td></tr>`).join("");

  /* ---------- FSN CONSOLIDATION ---------- */
  function groupByFSN(rows) {
    const map = {};
    rows.forEach(r => {
      const fsn = r["Sku Id"];
      if (!map[fsn]) {
        map[fsn] = {
          fsn,
          views: 0,
          clicks: 0,
          revenue: 0,
          roiList: []
        };
      }
      map[fsn].views += num(r["Views"]);
      map[fsn].clicks += num(r["Clicks"]);
      map[fsn].revenue += num(r["Total Revenue (Rs.)"]);
      map[fsn].roiList.push(num(r["ROI"]));
    });
    return map;
  }

  const fsnMap = groupByFSN(data.fsn);
  let auditScore = 100;

  Object.values(fsnMap).forEach(r => {
    const worstROI = Math.min(...r.roiList);
    let status = "Good";
    let cls = "status-good";

    if (worstROI < 1) {
      status = "Bad";
      cls = "status-bad";
      auditScore -= 3;
    } else if (worstROI < 1.5) {
      status = "Needs Fix";
      cls = "status-fix";
      auditScore -= 1;
    }

    document.getElementById("fsnTable").innerHTML += `
      <tr>
        <td>${r.fsn}</td>
        <td>${r.views}</td>
        <td>${r.clicks}</td>
        <td>${r.revenue.toLocaleString()}</td>
        <td>${worstROI.toFixed(2)}</td>
        <td class="${cls}">${status}</td>
      </tr>`;
  });

  /* ---------- AUDIT SCORE ---------- */
  auditScore = Math.max(auditScore, 0);
  document.getElementById("auditScore").textContent = auditScore;

});
