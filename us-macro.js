const $ = id => document.getElementById(id);
const charts = {};
const fields = ["cpi","pce","nfp","ust2","ust10","dxy"];
function setChange(id, value, suffix="% vs prior") {
  const el=$(id); if(value===null || value===undefined){el.textContent="Change: unavailable";el.className="change neutral";return;}
  const n=Number(value);el.textContent=(n>0?"+":"")+n.toFixed(2)+suffix;el.className="change "+(n>0?"up":n<0?"down":"neutral");
}
function renderChart(id, series) {
  const canvas=$(id+"-chart"); if(!canvas || !window.Chart || !series?.length)return;
  if(charts[id])charts[id].destroy();
  charts[id]=new Chart(canvas,{type:"line",data:{labels:series.map(x=>x.date),datasets:[{data:series.map(x=>x.value),borderColor:"#72a9ff",backgroundColor:"#72a9ff18",borderWidth:2,pointRadius:0,tension:.25,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{displayColors:false}},scales:{x:{display:false,grid:{display:false}},y:{display:false,grid:{display:false}}},interaction:{intersect:false,mode:"index"}}});
}
function renderMetric(key, data, opts={}) {
  $(key).textContent=data?.value==null?"N/A":Number(data.value).toFixed(opts.decimals??2)+(opts.suffix??"");
  $(key+"-date").textContent="Observation: "+(data?.date||"not available");
  setChange(key+"-change",data?.change,opts.changeSuffix??" vs prior");
  renderChart(key,data?.history);
}
async function load() {
  $("refresh").disabled=true;$("state").textContent="Fetching latest snapshot…";
  try {
    const r=await fetch("./data/us_macro.json?ts="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const d=await r.json();
    renderMetric("cpi",d.indicators.core_cpi,{suffix:"%",changeSuffix:" pp vs prior"});
    renderMetric("pce",d.indicators.core_pce,{suffix:"%",changeSuffix:" pp vs prior"});
    renderMetric("nfp",d.indicators.nfp,{decimals:0,suffix:"K",changeSuffix:"K jobs vs prior month"});
    renderMetric("ust2",d.indicators.treasury_2y,{suffix:"%",changeSuffix:" pp vs prior day"});
    renderMetric("ust10",d.indicators.treasury_10y_real,{suffix:"%",changeSuffix:" pp vs prior day"});
    renderMetric("dxy",d.indicators.dxy,{decimals:2,suffix:"",changeSuffix:" pts vs prior close"});
    const spread=d.indicators.yield_spread;
    $("spread").textContent=spread?.value==null?"N/A":(Number(spread.value)>0?"+":"")+Number(spread.value).toFixed(2)+" pp";
    $("spread-date").textContent="Latest common observation: "+(spread?.date||"not available");
    $("spread-note").textContent=spread?.value==null?"Spread unavailable":Number(spread.value)<0?"Inverted yield curve · 10Y below 2Y":"Positive spread · 10Y above 2Y";
    $("updated").textContent="Snapshot built: "+(d.generated_at||"—")+" UTC";
    $("state").textContent="Snapshot loaded · "+(d.source_status||"data status unavailable");
    $("dot").style.background=d.source_status==="OK"?"#36c995":"#f4bd58";
  } catch(e) {
    $("state").textContent="Unable to load data · "+e.message;$("dot").style.background="#ff727d";
  } finally {$("refresh").disabled=false;}
}
$("refresh").addEventListener("click",load);load();setInterval(load,5*60*1000);