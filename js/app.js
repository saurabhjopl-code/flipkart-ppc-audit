const uploadedData = {};

const HEADERS = {
  daily: ["Campaign ID","Campaign Name","Date","Ad Spend","Views","Clicks","Total converted units","Total Revenue (Rs.)","ROI"],
  fsn: ["Campaign ID","Campaign Name","AdGroup ID","AdGroup Name","Sku Id","Product Name","Views","Clicks","Direct Units Sold","Indirect Units Sold","Total Revenue (Rs.)","Conversion Rate","ROI"],
  placement: ["Campaign ID","Campaign Name","AdGroup Name","Placement Type","Views","Clicks","Click Through Rate in %","Average CPC","Conversion Rate","Ad Spend","Direct Units Sold","Indirect Units Sold","Direct Revenue","Indirect Revenue","ROI"],
  campaign: ["Campaign ID","AdGroup Name","Listing ID","Product Name","Advertised FSN ID","Date","order_id","AdGroup CPC","Expected ROI","Purchased FSN ID","Total Revenue (Rs.)","Direct Units Sold","Indirect Units Sold"]
};

/* ---------- Helpers ---------- */
function parseCSV(text){
  const lines=text.trim().split(/\r?\n/);
  const headers=lines[0].split(",").map(h=>h.trim());
  const rows=lines.slice(1).map(l=>{
    const v=l.split(",");
    const o={};
    headers.forEach((h,i)=>o[h]=v[i]?.trim()||"");
    return o;
  });
  return {headers,rows};
}
function validateHeaders(a,e){return e.every(h=>a.includes(h));}
function num(v){return Number(v)||0;}

/* ---------- Upload ---------- */
function bind(id,type,statusId){
  document.getElementById(id).addEventListener("change",e=>{
    const s=document.getElementById(statusId);
    const r=new FileReader();
    s.textContent="Validating...";
    r.onload=x=>{
      const p=parseCSV(x.target.result);
      if(!validateHeaders(p.headers,HEADERS[type])){
        s.textContent="Invalid header ✕"; s.style.color="red"; return;
      }
      uploadedData[type]=p.rows;
      s.textContent="Uploaded ✓"; s.style.color="green";
      checkReady();
    };
    r.readAsText(e.target.files[0]);
  });
}
function checkReady(){
  const ok=["daily","fsn","placement","campaign"].every(k=>uploadedData[k]);
  document.getElementById("generateAudit").disabled=!ok;
  document.getElementById("validation-summary").classList.toggle("hidden",!ok);
}

/* ---------- AUDIT ENGINE (REAL FIX) ---------- */
function runAudit(){

  let totalSpend=0, totalRevenue=0, roiSum=0, roiCount=0;
  let criticalIssues=[], fsnTable=[], placementTable=[];
  let campaignOrders=0, campaignRevenue=0;
  let score=100;

  /* Daily Summary */
  uploadedData.daily.forEach(r=>{
    totalSpend+=num(r["Ad Spend"]);
    totalRevenue+=num(r["Total Revenue (Rs.)"]);
    roiSum+=num(r["ROI"]);
    roiCount++;
  });

  /* FSN Analysis */
  uploadedData.fsn.forEach(r=>{
    const roi=num(r["ROI"]);
    let status="Good";
    if(roi<1){status="Bad"; score-=3;}
    else if(roi<1.5){status="Needs Fix"; score-=1;}

    if(status!=="Good"){
      criticalIssues.push(`Low ROI FSN: ${r["Product Name"]} (ROI ${roi})`);
    }

    fsnTable.push({
      product:r["Product Name"],
      views:r["Views"],
      clicks:r["Clicks"],
      revenue:r["Total Revenue (Rs.)"],
      roi,
      status
    });
  });

  /* Placement Analysis */
  uploadedData.placement.forEach(r=>{
    const revenue=num(r["Direct Revenue"])+num(r["Indirect Revenue"]);
    placementTable.push({
      placement:r["Placement Type"],
      spend:r["Ad Spend"],
      revenue,
      roi:r["ROI"]
    });
  });

  /* Campaign Orders */
  uploadedData.campaign.forEach(r=>{
    campaignOrders+=num(r["Direct Units Sold"])+num(r["Indirect Units Sold"]);
    campaignRevenue+=num(r["Total Revenue (Rs.)"]);
  });

  const auditResult={
    score: Math.max(score,0),
    summary:{
      spend: totalSpend,
      revenue: totalRevenue,
      avgROI: roiCount? (roiSum/roiCount).toFixed(2):0
    },
    criticalIssues,
    fsnTable,
    placementTable,
    campaignSummary:{
      orders:campaignOrders,
      revenue:campaignRevenue
    }
  };

  localStorage.setItem("auditResult",JSON.stringify(auditResult));
  window.location.href="audit.html";
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded",()=>{

  /* Upload Page */
  if(document.getElementById("dailyFile")){
    bind("dailyFile","daily","dailyStatus");
    bind("fsnFile","fsn","fsnStatus");
    bind("placementFile","placement","placementStatus");
    bind("campaignFile","campaign","campaignStatus");
    document.getElementById("generateAudit").onclick=runAudit;
  }

  /* Audit Page */
  if(document.getElementById("summary")){
    const raw=localStorage.getItem("auditResult");
    if(!raw){
      document.body.innerHTML="<h2 style='padding:20px'>No audit data found</h2>";
      return;
    }
    const a=JSON.parse(raw);

    document.getElementById("summary").innerHTML=
      `<p><b>Total Spend:</b> ₹${a.summary.spend}</p>
       <p><b>Total Revenue:</b> ₹${a.summary.revenue}</p>
       <p><b>Avg ROI:</b> ${a.summary.avgROI}</p>`;

    document.getElementById("score").textContent=a.score;

    a.criticalIssues.forEach(i=>{
      const li=document.createElement("li");
      li.textContent=i;
      document.getElementById("redFlags").appendChild(li);
    });

    a.fsnTable.forEach(r=>{
      document.getElementById("fsnTable").innerHTML+=
        `<tr><td>${r.product}</td><td>${r.views}</td><td>${r.clicks}</td>
         <td>${r.revenue}</td><td>${r.roi}</td><td>${r.status}</td></tr>`;
    });

    a.placementTable.forEach(r=>{
      document.getElementById("placementTable").innerHTML+=
        `<tr><td>${r.placement}</td><td>${r.spend}</td>
         <td>${r.revenue}</td><td>${r.roi}</td></tr>`;
    });

    document.getElementById("campaignSummary").innerHTML=
      `<p><b>Total Orders:</b> ${a.campaignSummary.orders}</p>
       <p><b>Total Campaign Revenue:</b> ₹${a.campaignSummary.revenue}</p>`;

    document.getElementById("downloadPDF").onclick=()=>{
      html2pdf().from(document.getElementById("pdfContent"))
        .save("Flipkart_PPC_Audit_Report.pdf");
    };
  }
});
