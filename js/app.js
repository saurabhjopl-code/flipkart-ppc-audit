const uploadedData = {};

const HEADERS = {
  daily: [
    "Campaign ID","Campaign Name","Date","Ad Spend","Views",
    "Clicks","Total converted units","Total Revenue (Rs.)","ROI"
  ],
  fsn: [
    "Campaign ID","Campaign Name","AdGroup ID","AdGroup Name",
    "Sku Id","Product Name","Views","Clicks",
    "Direct Units Sold","Indirect Units Sold",
    "Total Revenue (Rs.)","Conversion Rate","ROI"
  ],
  placement: [
    "Campaign ID","Campaign Name","AdGroup Name","Placement Type",
    "Views","Clicks","Click Through Rate in %",
    "Average CPC","Conversion Rate","Ad Spend",
    "Direct Units Sold","Indirect Units Sold",
    "Direct Revenue","Indirect Revenue","ROI"
  ],
  campaign: [
    "Campaign ID","AdGroup Name","Listing ID","Product Name",
    "Advertised FSN ID","Date","order_id",
    "AdGroup CPC","Expected ROI","Purchased FSN ID",
    "Total Revenue (Rs.)","Direct Units Sold","Indirect Units Sold"
  ]
};

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map(l => {
    const vals = l.split(",");
    const obj = {};
    headers.forEach((h,i)=>obj[h]=vals[i]?.trim()||"");
    return obj;
  });
  return { headers, rows };
}

function validateHeaders(actual, expected) {
  return expected.every(h => actual.includes(h));
}

function handleFile(type, file, status) {
  const reader = new FileReader();
  reader.onload = e => {
    const parsed = parseCSV(e.target.result);
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
}

function bind(id,type,statusId){
  document.getElementById(id).addEventListener("change",e=>{
    const s=document.getElementById(statusId);
    s.textContent="Validating...";
    handleFile(type,e.target.files[0],s);
  });
}

function checkReady(){
  const ok=["daily","fsn","placement","campaign"].every(k=>uploadedData[k]);
  document.getElementById("generateAudit").disabled=!ok;
  document.getElementById("validation-summary").classList.toggle("hidden",!ok);
}

function runAudit(){
  const flags=[];
  uploadedData.fsn.forEach(r=>{
    if(+r["ROI"]<1.5) flags.push(`Low ROI: ${r["Product Name"]}`);
  });
  localStorage.setItem("audit",JSON.stringify({flags,score:100-flags.length*2}));
  location.href="audit.html";
}

document.addEventListener("DOMContentLoaded",()=>{
  if(document.getElementById("dailyFile")){
    bind("dailyFile","daily","dailyStatus");
    bind("fsnFile","fsn","fsnStatus");
    bind("placementFile","placement","placementStatus");
    bind("campaignFile","campaign","campaignStatus");
    document.getElementById("generateAudit").onclick=runAudit;
  }

  if(document.getElementById("redFlags")){
    const a=JSON.parse(localStorage.getItem("audit"));
    document.getElementById("score").textContent=a.score;
    a.flags.forEach(f=>{
      const li=document.createElement("li");
      li.textContent=f;
      document.getElementById("redFlags").appendChild(li);
    });
    document.getElementById("downloadPDF").onclick=()=>{
      html2pdf().from(document.getElementById("pdfContent"))
        .save("Flipkart_PPC_Audit_Report.pdf");
    };
  }
});
