/***********************
 * UPLOAD PAGE LOGIC
 ***********************/
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

function bindUpload(inputId, type, statusId) {
  document.getElementById(inputId).addEventListener("change", e => {
    const file = e.target.files[0];
    const status = document.getElementById(statusId);
    if (!file) return;

    status.textContent = "Validating...";
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
  document.getElementById("generateAudit").disabled = !ready;
  document.getElementById("validation-summary").classList.toggle("hidden", !ready);
}

function runAudit() {
  localStorage.setItem("rawData", JSON.stringify(uploadedData));
  window.location.href = "audit.html";
}

/***********************
 * AUDIT PAGE LOGIC
 ***********************/
document.addEventListener("DOMContentLoaded", () => {

  /* Upload page bindings */
  if (document.getElementById("dailyFile")) {
    bindUpload("dailyFile","daily","dailyStatus");
    bindUpload("fsnFile","fsn","fsnStatus");
    bindUpload("placementFile","placement","placementStatus");
    bindUpload("campaignFile","campaign","campaignStatus");
    document.getElementById("generateAudit").onclick = runAudit;
  }

  /* Audit page rendering */
  if (!document.getElementById("fsnTable")) return;

  const raw = localStorage.getItem("rawData");
  if (!raw) return;

  const data = JSON.parse(raw);
  const num = v => Number(v) || 0;

  /* SUMMARY */
  let spend = 0, revenue = 0, roiSum = 0, roiCount = 0;
  data.daily.forEach(r => {
    spend += num(r["Ad Spend"]);
    revenue += num(r["Total Revenue (Rs.)"]);
    roiSum += num(r["ROI"]);
    roiCount++;
  });

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

  document.getElementById("summaryTable").innerHTML = `
    <tr><td><b>Total Ad Spend</b></td><td>₹${spend.toLocaleString()}</td></tr>
    <tr><td><b>Total Revenue</b></td><td>₹${revenue.toLocaleString()}</td></tr>
    <tr><td><b>Average ROI</b></td><td>${(roiSum/roiCount).toFixed(2)}</td></tr>
    <tr><td><b>Total FSNs</b></td><td>${Object.keys(fsnMap).length}</td></tr>
  `;

  /* FSN TABLE + AUDIT SCORE */
  let auditScore = 100;
  Object.entries(fsnMap).forEach(([fsn, r]) => {
    const worstROI = Math.min(...r.roiList);
    let status = "Good", cls = "status-good";

    if (worstROI < 1) {
      status = "Bad"; cls = "status-bad"; auditScore -= 3;
    } else if (worstROI < 1.5) {
      status = "Needs Fix"; cls = "status-fix"; auditScore -= 1;
    }

    document.getElementById("fsnTable").innerHTML += `
      <tr>
        <td>${fsn}</td>
        <td>${r.views}</td>
        <td>${r.clicks}</td>
        <td>${r.revenue.toLocaleString()}</td>
        <td>${worstROI.toFixed(2)}</td>
        <td class="${cls}">${status}</td>
      </tr>
    `;
  });

  document.getElementById("auditScore").textContent = Math.max(auditScore, 0);
});
