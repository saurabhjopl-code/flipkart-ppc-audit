const num = v => Number(v) || 0;
const uploadedData = {};

const HEADERS = {
  daily:["Campaign ID","Campaign Name","Date","Ad Spend","Views","Clicks","Total converted units","Total Revenue (Rs.)","ROI"],
  fsn:["Campaign ID","Campaign Name","AdGroup ID","AdGroup Name","Sku Id","Product Name","Views","Clicks","Direct Units Sold","Indirect Units Sold","Total Revenue (Rs.)","Conversion Rate","ROI"],
  placement:["Campaign ID","Campaign Name","AdGroup Name","Placement Type","Views","Clicks","Click Through Rate in %","Average CPC","Conversion Rate","Ad Spend","Direct Units Sold","Indirect Units Sold","Direct Revenue","Indirect Revenue","ROI"],
  campaign:["Campaign ID","AdGroup Name","Listing ID","Product Name","Advertised FSN ID","Date","order_id","AdGroup CPC","Expected ROI","Purchased FSN ID","Total Revenue (Rs.)","Direct Units Sold","Indirect Units Sold"]
};

function parseCSV(text){
  const l=text.trim().split(/\r?\n/);
  const h=l[0].split(",");
  const r=l.slice(1).map(x=>{
    const v=x.split(","), o={};
    h.forEach((k,i)=>o[k]=v[i]||"");
    return o;
  });
  return {h,r};
}

function bind(id,type,status){
  const el=document.getElementById(id);
  if(!el) return;
  el.onchange=e=>{
    const f=e.target.files[0];
    const s=document.getElementById(status);
    const rd=new FileReader();
    rd.onload=ev=>{
      const p=parseCSV(ev.target.result);
      if(!HEADERS[type].every(x=>p.h.includes(x))){
        s.textContent="Invalid header"; return;
      }
      uploadedData[type]=p.r;
      s.textContent="Uploaded ✓";
      document.getElementById("generateAudit").disabled =
        !Object.keys(HEADERS).every(k=>uploadedData[k]);
    };
    rd.readAsText(f);
  };
}

function exportCSV(rows){
  const csv=[Object.keys(rows[0]).join(",")]
    .concat(rows.map(r=>Object.values(r).join(","))).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="Flipkart_PPC_Recommendations.csv";
  a.click();
}

function renderAudit(){
  const data=JSON.parse(localStorage.getItem("rawData"));
  if(!data) return;

  let spend=0, revenue=0;
  data.daily.forEach(r=>{
    spend+=num(r["Ad Spend"]);
    revenue+=num(r["Total Revenue (Rs.)"]);
  });

  const sku={}, placement={};
  let clicks=0;

  data.fsn.forEach(r=>{
    const k=r["Sku Id"];
    if(!sku[k]) sku[k]={views:0,clicks:0,revenue:0,roi:[]};
    sku[k].views+=Math.max(num(r["Views"]),num(r["Clicks"]));
    sku[k].clicks+=num(r["Clicks"]);
    sku[k].revenue+=num(r["Total Revenue (Rs.)"]);
    sku[k].roi.push(num(r["ROI"]));
    clicks+=num(r["Clicks"]);
  });

  Object.values(sku).forEach(s=>s.spend=(s.clicks/clicks)*spend);

  const recs=[];

  Object.entries(sku).forEach(([k,v])=>{
    const roi=Math.min(...v.roi);
    const action=roi<1?"Pause / Fix":"Scale";
    recs.push({
      Type:"SKU",
      Entity:k,
      Spend:v.spend.toFixed(2),
      Revenue:v.revenue.toFixed(2),
      ROI:roi.toFixed(2),
      Recommendation:action
    });
  });

  document.getElementById("downloadRecommendations").onclick=
    ()=>exportCSV(recs);
}

document.addEventListener("DOMContentLoaded",()=>{
  if(document.getElementById("dailyFile")){
    bind("dailyFile","daily","dailyStatus");
    bind("fsnFile","fsn","fsnStatus");
    bind("placementFile","placement","placementStatus");
    bind("campaignFile","campaign","campaignStatus");
    document.getElementById("generateAudit").onclick=()=>{
      localStorage.setItem("rawData",JSON.stringify(uploadedData));
      window.location.href="audit.html";
    };
  }
  if(document.getElementById("downloadRecommendations")) renderAudit();
});
