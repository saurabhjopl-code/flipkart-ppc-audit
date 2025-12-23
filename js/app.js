/************************************************
 * COMMON
 ************************************************/
const num = v => Number(v) || 0;

/************************************************
 * UPLOAD PAGE LOGIC
 ************************************************/
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
  const rows = lines.slice(1).map(l => {
    const v = l.split(",");
    const o = {};
    headers.forEach((h,i)=>o[h]=v[i]?.trim()||"");
    return o;
  });
  return {headers, rows};
}

function validateHeaders(a,e){return e.every(h=>a.includes(h));}

function bindUpload(id,type,statusId){
  const input=document.getElementById(id);
  if(!input) return;
  input.addEventListener("change",e=>{
    const file=e.target.files[0];
    if(!file) return;
    const status=document.getElementById(statusId);
    status.textContent="Validating…";
    const r=new FileReader();
    r.onload=ev=>{
      const p=parseCSV(ev.target.result);
      if(!validateHeaders(p.headers,HEADERS[type])){
        status.textContent="Invalid header ✕";
        status.style.color="red";return;
      }
      uploadedData[type]=p.rows;
      status.textContent="Uploaded ✓";
      status.style.color="green";
      checkReady();
    };
    r.readAsText(file);
  });
}

function checkReady(){
  const ok=["daily","fsn","placement","campaign"].every(k=>uploadedData[k]);
  const btn=document.getElementById("generateAudit");
  if(btn) btn.disabled=!ok;
}

function runAudit(){
  localStorage.setItem("rawData",JSON.stringify(uploadedData));
  window.location.href="audit.html";
}

/************************************************
 * AUDIT PAGE LOGIC
 ************************************************/
function renderAudit(){
  const raw=localStorage.getItem("rawData");
  if(!raw) return;
  const data=JSON.parse(raw);

  /* SUMMARY */
  let totalSpend=0,totalRevenue=0,roiSum=0,roiCount=0;
  data.daily.forEach(r=>{
    totalSpend+=num(r["Ad Spend"]);
    totalRevenue+=num(r["Total Revenue (Rs.)"]);
    roiSum+=num(r["ROI"]);
    roiCount++;
  });
  const avgROI=roiCount?roiSum/roiCount:0;

  /* SKU PERFORMANCE */
  const skuMap={};
  let totalClicks=0;
  data.fsn.forEach(r=>{
    const sku=r["Sku Id"];
    if(!skuMap[sku]) skuMap[sku]={views:0,clicks:0,revenue:0,roiList:[]};
    const views=num(r["Views"]);
    const clicks=num(r["Clicks"]);
    skuMap[sku].views+=Math.max(views,clicks);
    skuMap[sku].clicks+=clicks;
    skuMap[sku].revenue+=num(r["Total Revenue (Rs.)"]); // ad-attributed only
    skuMap[sku].roiList.push(num(r["ROI"]));
    totalClicks+=clicks;
  });

  Object.values(skuMap).forEach(s=>{
    s.spend=totalClicks?(s.clicks/totalClicks)*totalSpend:0;
  });

  /* CAMPAIGN ORDER HEALTH (CORRECT) */
  const orderSet=new Set();
  let totalOrders=0;
  let campaignRevenue=0;

  data.campaign.forEach(r=>{
    const id=r["order_id"];
    if(!id||orderSet.has(id)) return;
    orderSet.add(id);
    totalOrders++;                 // COUNT orders, not units
    campaignRevenue+=num(r["Total Revenue (Rs.)"]);
  });

  /* RENDER SUMMARY */
  document.getElementById("summaryTable").innerHTML=`
    <tr><td><b>Total Ad Spend</b></td><td>₹${totalSpend.toLocaleString()}</td></tr>
    <tr><td><b>Total Revenue</b></td><td>₹${totalRevenue.toLocaleString()}</td></tr>
    <tr><td><b>Average ROI</b></td><td>${avgROI.toFixed(2)}</td></tr>
    <tr><td><b>Total Orders</b></td><td>${totalOrders}</td></tr>
    <tr><td><b>Total SKUs</b></td><td>${Object.keys(skuMap).length}</td></tr>
  `;

  document.getElementById("campaignSummary").innerHTML=`
    <p><b>Total Orders:</b> ${totalOrders}</p>
    <p><b>Campaign Revenue:</b> ₹${campaignRevenue.toLocaleString()}</p>
  `;
}

/************************************************
 * INIT
 ************************************************/
document.addEventListener("DOMContentLoaded",()=>{
  if(document.getElementById("dailyFile")){
    bindUpload("dailyFile","daily","dailyStatus");
    bindUpload("fsnFile","fsn","fsnStatus");
    bindUpload("placementFile","placement","placementStatus");
    bindUpload("campaignFile","campaign","campaignStatus");
    document.getElementById("generateAudit").onclick=runAudit;
  }
  if(document.getElementById("campaignSummary")){
    renderAudit();
  }
});
