const num = v => Number(v) || 0;
const uploaded = {};
const recommendations = [];

/* ---------- CSV PARSER ---------- */
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

/* ---------- UPLOAD ---------- */
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

      const ready = ["daily","fsn","placement","campaign"]
        .every(k => uploaded[k] && uploaded[k].length > 0);

      document.getElementById("generateAudit").disabled = !ready;
    };
    reader.readAsText(file);
  });
}

function initIndex() {
  bindUpload("dailyFile","daily","dailyStatus");
  bindUpload("fsnFile","fsn","fsnStatus");
  bindUpload("placementFile","placement","placementStatus");
  bindUpload("campaignFile","campaign","campaignStatus");

  document.getElementById("generateAudit").onclick = () => {
    localStorage.setItem("auditData", JSON.stringify(uploaded));
    window.location.href = "audit.html";
  };
}

/* ---------- AUDIT ---------- */
function renderAudit() {
  const data = JSON.parse(localStorage.getItem("auditData"));
  if (!data) return;

  /* ===== CAMPAIGN ===== */
  const camp = {};
  data.campaign.forEach(r => {
    const k = r["Campaign ID"] || r["Campaign Name"];
    if (!k) return;
    if (!camp[k]) camp[k] = { d:0,i:0,o:new Set(),rev:0,v:0,c:0 };
    camp[k].d += num(r["Direct Units Sold"]);
    camp[k].i += num(r["Indirect Units Sold"]);
    camp[k].rev += num(r["Total Revenue (Rs.)"]);
    if (r.order_id) camp[k].o.add(r.order_id);
  });

  data.daily.forEach(r => {
    const k = r["Campaign ID"] || r["Campaign Name"];
    if (!camp[k]) return;
    camp[k].v += num(r["Views"]);
    camp[k].c += num(r["Clicks"]);
  });

  Object.entries(camp).forEach(([k,v]) => {
    campaignPerformance.innerHTML +=
      `<tr><td>${k}</td><td>${v.d}</td><td>${v.i}</td><td>${v.o.size}</td><td>${v.rev}</td></tr>`;

    const tot = v.d + v.i;
    const dp = tot ? (v.d/tot*100).toFixed(1) : "0";
    const ip = (100-dp).toFixed(1);
    const type = dp>=60?"Closing-heavy":(ip>=60?"Halo-heavy":"Balanced");

    directIndirect.innerHTML +=
      `<tr><td>${k}</td><td>${dp}%</td><td>${ip}%</td><td>${type}</td></tr>`;

    let issue="Healthy";
    if(v.o.size===0 && v.c>0) issue="Click Leakage";
    else if(v.o.size===0) issue="Zero Orders";

    campaignFunnel.innerHTML +=
      `<tr><td>${k}</td><td>${v.v}</td><td>${v.c}</td><td>${v.o.size}</td><td>${issue}</td></tr>`;

    recommendations.push({Type:"Campaign",Name:k,Action:issue});
  });

  /* ===== SKU ===== */
  const sku={}; let totalClicks=0;
  data.fsn.forEach(r=>{
    const s=r["Sku Id"]; if(!s) return;
    if(!sku[s]) sku[s]={c:0,o:0,r:0};
    sku[s].c+=num(r.Clicks);
    sku[s].o+=num(r["Direct Units Sold"])+num(r["Indirect Units Sold"]);
    sku[s].r+=num(r["Total Revenue (Rs.)"]);
    totalClicks+=num(r.Clicks);
  });

  let spend=0;
  data.daily.forEach(r=>spend+=num(r["Ad Spend"]));

  Object.entries(sku).forEach(([s,v])=>{
    const sp=totalClicks?(v.c/totalClicks)*spend:0;
    const roi=sp? v.r/sp:0;
    skuTable.innerHTML+=
      `<tr><td>${s}</td><td>${v.c}</td><td>${v.o}</td><td>${v.r}</td><td>${sp.toFixed(0)}</td><td>${roi.toFixed(2)}</td></tr>`;
  });

  /* ===== PLACEMENT ===== */
  const place={};
  data.placement.forEach(r=>{
    const p=(r["Placement Type"]||"UNKNOWN").trim().toUpperCase();
    if(!place[p]) place[p]={v:0,c:0,s:0,r:0};
    place[p].v+=num(r.Views);
    place[p].c+=num(r.Clicks);
    place[p].s+=num(r["Ad Spend"]);
    place[p].r+=num(r["Direct Revenue"])+num(r["Indirect Revenue"]);
  });

  Object.entries(place).forEach(([p,v])=>{
    const roas=v.s?v.r/v.s:0;
    const act=roas>=1?"Scale":"Reduce";
    placementTable.innerHTML+=
      `<tr><td>${p}</td><td>${v.v}</td><td>${v.c}</td><td>${v.s}</td><td>${v.r}</td><td>${roas.toFixed(2)}</td><td>${act}</td></tr>`;
    recommendations.push({Type:"Placement",Name:p,Action:act});
  });

  /* ===== DAILY ===== */
  const day={};
  data.daily.forEach(r=>{
    const d=r.Date;
    if(!day[d]) day[d]={t:0,a:0,o:0};
    day[d].t+=num(r["Total Revenue (Rs.)"]);
  });

  data.campaign.forEach(r=>{
    const d=r.Date;
    if(!day[d]) return;
    day[d].a+=num(r["Total Revenue (Rs.)"]);
    if(r.order_id) day[d].o++;
  });

  Object.entries(day).forEach(([d,v])=>{
    dailyTrend.innerHTML+=
      `<tr><td>${d}</td><td>${v.t}</td><td>${v.a}</td><td>${v.o}</td></tr>`;
  });

  const totRev=Object.values(day).reduce((a,b)=>a+b.t,0);
  const adsRev=Object.values(day).reduce((a,b)=>a+b.a,0);

  adsSummary.innerHTML=
    `<tr><td>Total Revenue</td><td>${totRev}</td></tr>
     <tr><td>Ads Revenue</td><td>${adsRev}</td></tr>
     <tr><td>Ads %</td><td>${((adsRev/totRev)*100).toFixed(2)}%</td></tr>`;

  /* ===== EXPORT ===== */
  downloadReco.onclick=()=>{
    const csv="Type,Name,Action\n"+recommendations.map(r=>`${r.Type},${r.Name},${r.Action}`).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download="Flipkart_PPC_Recommendations.csv";
    a.click();
  };
}

/* ---------- BOOT ---------- */
document.addEventListener("DOMContentLoaded",()=>{
  if(document.getElementById("dailyFile")) initIndex();
  else renderAudit();
});
