const num = v => Number(v) || 0;
const uploadedData = {};

const HEADERS = {
  daily: ["Campaign ID","Campaign Name","Date","Ad Spend","Views","Clicks","Total converted units","Total Revenue (Rs.)","ROI"],
  fsn: ["Campaign ID","Campaign Name","AdGroup ID","AdGroup Name","Sku Id","Product Name","Views","Clicks","Direct Units Sold","Indirect Units Sold","Total Revenue (Rs.)","Conversion Rate","ROI"],
  placement: ["Campaign ID","Campaign Name","AdGroup Name","Placement Type","Views","Clicks","Click Through Rate in %","Average CPC","Conversion Rate","Ad Spend","Direct Units Sold","Indirect Units Sold","Direct Revenue","Indirect Revenue","ROI"],
  campaign: ["Campaign ID","AdGroup Name","Listing ID","Product Name","Advertised FSN ID","Date","order_id","AdGroup CPC","Expected ROI","Purchased FSN ID","Total Revenue (Rs.)","Direct Units Sold","Indirect Units Sold"]
};

function parseCSV(text){
  const lines=text.trim().split(/\r?\n/);
  const headers=lines[0].split(",").map(h=>h.trim());
  const rows=lines.slice(1).map(l=>{
    const v=l.split(",");
    const o={}; headers.forEach((h,i)=>o[h]=v[i]||"");
    return o;
  });
  return {headers,rows};
}

function bindUpload(id,type,statusId){
  const input=document.getElementById(id);
  if(!input) return;
  input.onchange=e=>{
    const file=e.target.files[0];
    if(!file) return;
    const status=document.getElementById(statusId);
    status.textContent="Validating…";
    const r=new FileReader();
    r.onload=ev=>{
      const p=parseCSV(ev.target.result);
      if(!HEADERS[type].every(h=>p.headers.includes(h))){
        status.textContent="Invalid header";
        status.style.color="red";return;
      }
      uploadedData[type]=p.rows;
      status.textContent="Uploaded ✓";
      status.style.color="green";
      document.getElementById("generateAudit").disabled =
        !["daily","fsn","placement","campaign"].every(k=>uploadedData[k]);
    };
    r.readAsText(file);
  };
}

function renderAudit(){
  const data=JSON.parse(localStorage.getItem("rawData"));
  if(!data) return;

  let spend=0,revenue=0;
  data.daily.forEach(r=>{
    spend+=num(r["Ad Spend"]);
    revenue+=num(r["Total Revenue (Rs.)"]);
  });

  const skuMap={}, placementMap={};
  let totalClicks=0;

  data.fsn.forEach(r=>{
    const s=r["Sku Id"];
    if(!skuMap[s]) skuMap[s]={views:0,clicks:0,revenue:0,roi:[]};
    const v=num(r["Views"]), c=num(r["Clicks"]);
    skuMap[s].views+=Math.max(v,c);
    skuMap[s].clicks+=c;
    skuMap[s].revenue+=num(r["Total Revenue (Rs.)"]);
    skuMap[s].roi.push(num(r["ROI"]));
    totalClicks+=c;
  });

  Object.values(skuMap).forEach(s=>{
    s.spend=totalClicks?(s.clicks/totalClicks)*spend:0;
  });

  data.placement.forEach(r=>{
    const p=r["Placement Type"];
    if(!placementMap[p]) placementMap[p]={spend:0,revenue:0};
    placementMap[p].spend+=num(r["Ad Spend"]);
    placementMap[p].revenue+=num(r["Direct Revenue"])+num(r["Indirect Revenue"]);
  });

  const orderSet=new Set();
  let orders=0, campRev=0;
  data.campaign.forEach(r=>{
    const id=r["order_id"];
    if(id && !orderSet.has(id)){
      orderSet.add(id);
      orders++;
      campRev+=num(r["Total Revenue (Rs.)"]);
    }
  });

  document.getElementById("summaryTable").innerHTML=`
    <tr><td>Total Ad Spend</td><td>₹${spend.toLocaleString()}</td></tr>
    <tr><td>Total Revenue</td><td>₹${revenue.toLocaleString()}</td></tr>
    <tr><td>Total Orders</td><td>${orders}</td></tr>
    <tr><td>Total SKUs</td><td>${Object.keys(skuMap).length}</td></tr>
  `;

  const skuTable=document.getElementById("skuTable");
  Object.entries(skuMap).forEach(([k,v])=>{
    const roi=Math.min(...v.roi);
    skuTable.innerHTML+=`
      <tr>
        <td>${k}</td><td>${v.views}</td><td>${v.clicks}</td>
        <td>${v.spend.toFixed(2)}</td><td>${v.revenue.toLocaleString()}</td>
        <td>${roi.toFixed(2)}</td><td>${roi<1?"Bad":"OK"}</td>
      </tr>`;
  });

  const pt=document.getElementById("placementTable");
  Object.entries(placementMap).forEach(([k,v])=>{
    const roi=v.spend?v.revenue/v.spend:0;
    pt.innerHTML+=`
      <tr>
        <td>${k}</td><td>${v.spend.toLocaleString()}</td>
        <td>${v.revenue.toLocaleString()}</td>
        <td>${roi.toFixed(2)}</td><td>${roi>=1?"Scale":"Reduce"}</td>
      </tr>`;
  });

  document.getElementById("campaignSummary").innerHTML=
    `<b>Total Orders:</b> ${orders}<br><b>Campaign Revenue:</b> ₹${campRev.toLocaleString()}`;
}

document.addEventListener("DOMContentLoaded",()=>{
  if(document.getElementById("dailyFile")){
    bindUpload("dailyFile","daily","dailyStatus");
    bindUpload("fsnFile","fsn","fsnStatus");
    bindUpload("placementFile","placement","placementStatus");
    bindUpload("campaignFile","campaign","campaignStatus");
    document.getElementById("generateAudit").onclick=()=>{
      localStorage.setItem("rawData",JSON.stringify(uploadedData));
      window.location.href="audit.html";
    };
  }
  if(document.getElementById("skuTable")) renderAudit();
});
