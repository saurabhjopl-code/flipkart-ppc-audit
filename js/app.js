const uploadedData = {};

const HEADERS = {
  daily: ["Campaign ID","Campaign Name","Date","Ad Spend","Views","Clicks","Total converted units","Total Revenue (Rs.)","ROI"],
  fsn: ["Campaign ID","Campaign Name","AdGroup ID","AdGroup Name","Sku Id","Product Name","Views","Clicks","Direct Units Sold","Indirect Units Sold","Total Revenue (Rs.)","Conversion Rate","ROI"],
  placement: ["Campaign ID","Campaign Name","AdGroup Name","Placement Type","Views","Clicks","Click Through Rate in %","Average CPC","Conversion Rate","Ad Spend","Direct Units Sold","Indirect Units Sold","Direct Revenue","Indirect Revenue","ROI"],
  campaign: ["Campaign ID","AdGroup Name","Listing ID","Product Name","Advertised FSN ID","Date","order_id","AdGroup CPC","Expected ROI","Purchased FSN ID","Total Revenue (Rs.)","Direct Units Sold","Indirect Units Sold"]
};

/* ---------- CSV ---------- */

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

function validateHeaders(a,e){ return e.every(h=>a.includes(h)); }
function num(v){ return Number(v)||0; }

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

/* ---------- AUDIT ---------- */

function runAudit(){
  const flags=[];
  uploadedData.fsn.forEach(r=>{
    if(num(r["ROI"])<1.5) flags.push(`Low ROI: ${r["Product Name"]}`);
  });

  // 🔒 GUARANTEED SAVE
  localStorage.setItem("rawData",JSON.stringify(uploadedData));
  localStorage.setItem("audit",JSON.stringify({
    flags,
    generatedAt:new Date().toISOString()
  }));

  // 🔁 NAVIGATE AFTER SAVE
  window.location.href="audit.html";
}

/* ---------- INIT ---------- */

document.addEventListener("DOMContentLoaded",()=>{

  /* Upload page */
  if(document.getElementById("dailyFile")){
    bind("dailyFile","daily","dailyStatus");
    bind("fsnFile","fsn","fsnStatus");
    bind("placementFile","placement","placementStatus");
    bind("campaignFile","campaign","campaignStatus");
    document.getElementById("generateAudit").onclick=runAudit;
  }

  /* Audit page */
  if(document.getElementById("summary")){
    const raw=localStorage.getItem("rawData");
    const aud=localStorage.getItem("audit");

    if(!raw||!aud){
      document.getElementById("summarySection").style.display="none";
      document.getElementById("noData").style.display="block";
      return;
    }

    const data=JSON.parse(raw);
    const audit=JSON.parse(aud);

    let spend=0,rev=0,roiSum=0;
    data.daily.forEach(r=>{
      spend+=num(r["Ad Spend"]);
      rev+=num(r["Total Revenue (Rs.)"]);
      roiSum+=num(r["ROI"]);
    });

    document.getElementById("summary").innerHTML=
      `<p><b>Total Spend:</b> ₹${spend}</p>
       <p><b>Total Revenue:</b> ₹${rev}</p>
       <p><b>Avg ROI:</b> ${(roiSum/data.daily.length).toFixed(2)}</p>`;

    audit.flags.forEach(f=>{
      const li=document.createElement("li");
      li.textContent=f;
      document.getElementById("redFlags").appendChild(li);
    });

    data.fsn.forEach(r=>{
      const roi=num(r["ROI"]);
      const status=roi>=2?"Good":roi>=1?"Needs Fix":"Bad";
      document.getElementById("fsnTable").innerHTML+=
        `<tr><td>${r["Product Name"]}</td><td>${r["Views"]}</td><td>${r["Clicks"]}</td>
        <td>${r["Total Revenue (Rs.)"]}</td><td>${roi}</td><td>${status}</td></tr>`;
    });

    data.placement.forEach(r=>{
      const rrev=num(r["Direct Revenue"])+num(r["Indirect Revenue"]);
      document.getElementById("placementTable").innerHTML+=
        `<tr><td>${r["Placement Type"]}</td><td>${r["Ad Spend"]}</td><td>${rrev}</td><td>${r["ROI"]}</td></tr>`;
    });

    let orders=0,cRev=0;
    data.campaign.forEach(r=>{
      orders+=num(r["Direct Units Sold"])+num(r["Indirect Units Sold"]);
      cRev+=num(r["Total Revenue (Rs.)"]);
    });

    document.getElementById("campaignSummary").innerHTML=
      `<p><b>Total Orders:</b> ${orders}</p>
       <p><b>Total Campaign Revenue:</b> ₹${cRev}</p>`;

    document.getElementById("downloadPDF").onclick=()=>{
      html2pdf().from(document.getElementById("pdfContent"))
        .save("Flipkart_PPC_Audit_Report.pdf");
    };
  }
});
