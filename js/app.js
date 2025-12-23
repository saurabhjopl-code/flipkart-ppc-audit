const num = v => Number(v) || 0;
const uploaded = {};
const reco = [];

function parseCSV(text){
  const l=text.trim().split(/\r?\n/);
  const h=l[0].split(",");
  return l.slice(1).map(r=>{
    const v=r.split(",");
    const o={};
    h.forEach((k,i)=>o[k]=v[i]||"");
    return o;
  });
}

function bind(id,key,status){
  const el=document.getElementById(id);
  el.onchange=e=>{
    const r=new FileReader();
    r.onload=ev=>{
      uploaded[key]=parseCSV(ev.target.result);
      document.getElementById(status).textContent="Uploaded ✓";
      document.getElementById("generateAudit").disabled =
        !["daily","fsn","placement","campaign"].every(k=>uploaded[k]);
    };
    r.readAsText(e.target.files[0]);
  };
}

document.addEventListener("DOMContentLoaded",()=>{
  if(document.getElementById("dailyFile")){
    bind("dailyFile","daily","dailyStatus");
    bind("fsnFile","fsn","fsnStatus");
    bind("placementFile","placement","placementStatus");
    bind("campaignFile","campaign","campaignStatus");
    document.getElementById("generateAudit").onclick=()=>{
      localStorage.setItem("auditData",JSON.stringify(uploaded));
      window.location="audit.html";
    };
  } else {
    renderAudit();
  }
});

function renderAudit(){
  const data=JSON.parse(localStorage.getItem("auditData"));

  /* ================= PHASE 1 – CAMPAIGN ================= */
  const camp={};
  data.campaign.forEach(r=>{
    const c=r["Campaign ID"];
    if(!camp[c]) camp[c]={orders:new Set(),direct:0,indirect:0,revenue:0};
    camp[c].direct+=num(r["Direct Units Sold"]);
    camp[c].indirect+=num(r["Indirect Units Sold"]);
    camp[c].revenue+=num(r["Total Revenue (Rs.)"]);
    if(r["order_id"]) camp[c].orders.add(r["order_id"]);
  });

  Object.entries(camp).forEach(([c,v])=>{
    document.getElementById("campaignPerformance").innerHTML+=
      `<tr><td>${c}</td><td>${v.direct}</td><td>${v.indirect}</td><td>${v.orders.size}</td><td>${v.revenue}</td></tr>`;
  });

  /* ================= PHASE 2 – SKU / PLACEMENT ================= */
  const sku={};
  data.fsn.forEach(r=>{
    const s=r["Sku Id"];
    if(!sku[s]) sku[s]={clicks:0,revenue:0};
    sku[s].clicks+=num(r["Clicks"]);
    sku[s].revenue+=num(r["Total Revenue (Rs.)"]);
  });

  Object.entries(sku).forEach(([s,v])=>{
    document.getElementById("skuTable").innerHTML+=
      `<tr><td>${s}</td><td>${v.clicks}</td><td>${v.revenue}</td></tr>`;
  });

  const place={};
  data.placement.forEach(r=>{
    const p=r["Placement Type"];
    if(!place[p]) place[p]={spend:0,revenue:0};
    place[p].spend+=num(r["Ad Spend"]);
    place[p].revenue+=num(r["Direct Revenue"])+num(r["Indirect Revenue"]);
  });

  Object.entries(place).forEach(([p,v])=>{
    document.getElementById("placementTable").innerHTML+=
      `<tr><td>${p}</td><td>${v.spend}</td><td>${v.revenue}</td></tr>`;
  });

  /* ================= PHASE 3 – STRATEGIC ================= */
  let totalRev=0, adsRev=0;
  data.daily.forEach(r=>totalRev+=num(r["Total Revenue (Rs.)"]));
  data.campaign.forEach(r=>adsRev+=num(r["Total Revenue (Rs.)"]));

  document.getElementById("summaryTable").innerHTML+=
    `<tr><td>Total Revenue</td><td>${totalRev}</td></tr>
     <tr><td>Ads Revenue</td><td>${adsRev}</td></tr>
     <tr><td>Ads %</td><td>${((adsRev/totalRev)*100).toFixed(2)}%</td></tr>`;

  document.getElementById("execSummary").innerHTML+=
    `<li>Ads contribute ${(adsRev/totalRev*100).toFixed(1)}% of revenue.</li>`;
}
