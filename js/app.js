const num = v => Number(v) || 0;
const recommendations = [];

function renderAudit() {
  const data = JSON.parse(localStorage.getItem("auditData"));

  /* ================= CAMPAIGN ================= */
  const camp = {};
  data.campaign.forEach(r => {
    const c = r["Campaign Name"];
    if (!camp[c]) camp[c] = { d:0,i:0,o:new Set(),rev:0,views:0,clicks:0 };
    camp[c].d += num(r["Direct Units Sold"]);
    camp[c].i += num(r["Indirect Units Sold"]);
    camp[c].rev += num(r["Total Revenue (Rs.)"]);
    if (r.order_id) camp[c].o.add(r.order_id);
  });

  data.daily.forEach(r=>{
    const c = r["Campaign Name"];
    if (!camp[c]) return;
    camp[c].views += num(r.Views);
    camp[c].clicks += num(r.Clicks);
  });

  Object.entries(camp).forEach(([c,v])=>{
    campaignPerformance.innerHTML +=
      `<tr><td>${c}</td><td>${v.d}</td><td>${v.i}</td><td>${v.o.size}</td><td>${v.rev}</td></tr>`;

    const tot = v.d + v.i;
    const dp = tot ? (v.d/tot*100).toFixed(1) : 0;
    const ip = (100-dp).toFixed(1);
    const type = dp>=60?"Closing":"Halo";

    directIndirect.innerHTML +=
      `<tr><td>${c}</td><td>${dp}%</td><td>${ip}%</td><td>${type}</td></tr>`;

    let issue = "Healthy";
    if (v.o.size===0 && v.clicks>0) issue="Click Leakage";
    else if (v.o.size===0) issue="Zero Orders";

    campaignFunnel.innerHTML +=
      `<tr><td>${c}</td><td>${v.views}</td><td>${v.clicks}</td><td>${v.o.size}</td><td>${issue}</td></tr>`;

    recommendations.push({Type:"Campaign",Name:c,Action:issue});
  });

  /* ================= SKU ================= */
  const sku = {};
  let spend = 0;
  data.daily.forEach(r=>spend+=num(r["Ad Spend"]));

  data.fsn.forEach(r=>{
    const s = r["Sku Id"];
    if (!sku[s]) sku[s]={clicks:0,orders:0,rev:0};
    sku[s].clicks+=num(r.Clicks);
    sku[s].orders+=num(r["Direct Units Sold"])+num(r["Indirect Units Sold"]);
    sku[s].rev+=num(r["Total Revenue (Rs.)"]);
  });

  let rows = Object.entries(sku).map(([s,v])=>{
    const sp = spend*(v.clicks/Object.values(sku).reduce((a,b)=>a+b.clicks,0));
    const roi = sp? v.rev/sp:0;
    return {s,...v,sp,roi};
  }).sort((a,b)=>a.roi-b.roi);

  let showAll=false;
  const drawSku=()=>{
    skuTable.innerHTML="";
    rows.slice(0,showAll?rows.length:20).forEach(r=>{
      skuTable.innerHTML+=
        `<tr><td>${r.s}</td><td>${r.clicks}</td><td>${r.orders}</td><td>${r.rev}</td><td>${r.sp.toFixed(0)}</td><td>${r.roi.toFixed(2)}</td></tr>`;
    });
  };
  toggleSku.onclick=()=>{showAll=!showAll;toggleSku.innerText=showAll?"Collapse":"Show all SKUs";drawSku();}
  drawSku();

  /* ================= PLACEMENT ================= */
  const place={};
  data.placement.forEach(r=>{
    const p=r["Placement Type"];
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

  /* ================= DAILY ================= */
  const day={};
  data.daily.forEach(r=>{
    const d=r.Date;
    if(!day[d]) day[d]={t:0};
    day[d].t+=num(r["Total Revenue (Rs.)"]);
  });

  data.campaign.forEach(r=>{
    const d=r.Date;
    if(!day[d]) return;
    day[d].a=(day[d].a||0)+num(r["Total Revenue (Rs.)"]);
    day[d].o=(day[d].o||0)+1;
  });

  Object.entries(day).forEach(([d,v])=>{
    dailyTrend.innerHTML+=
      `<tr><td>${d}</td><td>${v.t}</td><td>${v.a||0}</td><td>${v.o||0}</td></tr>`;
  });

  /* ================= ADS SUMMARY ================= */
  const tot=Object.values(day).reduce((a,b)=>a+b.t,0);
  const ads=Object.values(day).reduce((a,b)=>a+(b.a||0),0);
  adsSummary.innerHTML=
    `<tr><td>Total Revenue</td><td>${tot}</td></tr>
     <tr><td>Ads Revenue</td><td>${ads}</td></tr>
     <tr><td>Ads %</td><td>${(ads/tot*100).toFixed(2)}%</td></tr>`;

  /* ================= EXPORT ================= */
  downloadReco.onclick=()=>{
    const csv="Type,Name,Action\n"+recommendations.map(r=>`${r.Type},${r.Name},${r.Action}`).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download="Flipkart_PPC_Recommendations.csv";
    a.click();
  };
}

document.addEventListener("DOMContentLoaded",renderAudit);
