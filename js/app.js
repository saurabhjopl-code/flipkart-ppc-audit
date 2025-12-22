const CONFIG = {
  ROI_BREAK_EVEN: 1.5,
  ZERO_ORDER_CLICK_THRESHOLD: 50
};

const uploadedData = {};

const HEADERS = {
  daily: ["Date"],
  fsn: ["FSN","PLA Spend","Sale through PLA","ROI"],
  placement: ["Placement Type","PLA Spend","ROI"],
  campaign: ["Campaign Name","Clicks","Orders","Spend"]
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
  return Number(String(val).replace(/₹|%|,/g,"")) || 0;
}

function handleFileUpload(type, file) {
  const reader = new FileReader();
  reader.onload = e => {
    const parsed = parseCSV(e.target.result);
    if (!validateHeaders(parsed.headers, HEADERS[type])) {
      alert(`Invalid headers in ${type} file`);
      return;
    }
    uploadedData[type] = parsed.rows;
    checkAllFilesUploaded();
  };
  reader.readAsText(file);
}

function bindFile(inputId, type, statusId) {
  const input = document.getElementById(inputId);
  const status = document.getElementById(statusId);

  input.addEventListener("change", e => {
    const file = e.target.files[0];
    status.textContent = "Uploading...";
    handleFileUpload(type, file);
    status.textContent = "Uploaded ✓";
    status.style.color = "green";
  });
}

function checkAllFilesUploaded() {
  const ready = ["daily","fsn","placement","campaign"].every(k => uploadedData[k]);
  if (ready) {
    document.getElementById("generateAudit").disabled = false;
    document.getElementById("validation-summary").classList.remove("hidden");
  }
}

function runAudit() {
  const audit = { redFlags: [], fsn: [], score: 100 };

  uploadedData.fsn.forEach(r => {
    const spend = toNumber(r["PLA Spend"]);
    const roi = toNumber(r["ROI"]);
    if (spend > 0 && roi < CONFIG.ROI_BREAK_EVEN) {
      audit.redFlags.push(`FSN ${r.FSN} low ROI (${roi})`);
      audit.fsn.push({ fsn: r.FSN, roi, spend });
      audit.score -= 2;
    }
  });

  uploadedData.campaign.forEach(r => {
    if (toNumber(r.Clicks) >= CONFIG.ZERO_ORDER_CLICK_THRESHOLD && toNumber(r.Orders) === 0) {
      audit.redFlags.push(`Campaign ${r["Campaign Name"]} has clicks but no orders`);
      audit.score -= 3;
    }
  });

  localStorage.setItem("audit", JSON.stringify(audit));
  window.location.href = "audit.html";
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("dailyFile")) {
    bindFile("dailyFile","daily","dailyStatus");
    bindFile("fsnFile","fsn","fsnStatus");
    bindFile("placementFile","placement","placementStatus");
    bindFile("campaignFile","campaign","campaignStatus");
    document.getElementById("generateAudit").onclick = runAudit;
  }

  if (document.getElementById("redFlags")) {
    const audit = JSON.parse(localStorage.getItem("audit"));
    document.getElementById("score").textContent = audit.score;

    audit.redFlags.forEach(f => {
      const li = document.createElement("li");
      li.textContent = f;
      document.getElementById("redFlags").appendChild(li);
    });

    new Chart(document.getElementById("roiChart"), {
      type: "bar",
      data: {
        labels: audit.fsn.map(f => f.fsn),
        datasets: [{
          label: "ROI",
          data: audit.fsn.map(f => f.roi),
          backgroundColor: "#2563eb"
        }]
      }
    });

    new Chart(document.getElementById("leakageChart"), {
      type: "pie",
      data: {
        labels: audit.fsn.map(f => f.fsn),
        datasets: [{
          data: audit.fsn.map(f => f.spend),
          backgroundColor: "#dc2626"
        }]
      }
    });

    document.getElementById("downloadPDF").onclick = () => {
      html2pdf().from(document.getElementById("pdfContent")).save("Flipkart_PPC_Audit.pdf");
    };
  }
});
