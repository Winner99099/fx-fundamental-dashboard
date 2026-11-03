const CCY=["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD"];
const LABEL={USD:"United States",EUR:"Euro area",GBP:"United Kingdom",JPY:"Japan",CHF:"Switzerland",CAD:"Canada",AUD:"Australia",NZD:"New Zealand"};
const $=id=>document.getElementById(id);let payload=null;
function fmt(t){return t?new Date(t).toLocaleString("en-SG",{timeZone:"Asia/Singapore"}):"Timestamp unavailable"}
function sign(v){return v>=1.5?"Bullish":v<=-1.5?"Bearish":"Neutral"}
function cls(v){return v>=1.5?"green":v<=-1.5?"red":"amber"}
async function load(){
 $("status").textContent="UPDATING";$("clock").textContent=new Date().toLocaleString("en-SG",{dateStyle:"full",timeStyle:"short",timeZone:"Asia/Singapore"});
 try{const r=await fetch("data/latest.json?ts="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);payload=await r.json();render();$("status").textContent="FEED UPDATED";$("updated").textContent="Last data build: "+fmt(payload.generated_at)+" · Page refreshed: "+fmt(new Date().toISOString())}
 catch(e){$("status").textContent="DATA UNAVAILABLE";$("updated").textContent="Could not load data/latest.json. "+e.message+" — showing fallback status.";renderFallback()}
}
function renderFallback(){ $("tiles").innerHTML=`<div class="tile"><div class="small">Data status</div><div class="metric amber">Offline</div></div><div class="tile"><div class="small">Currencies</div><div class="metric">8</div></div><div class="tile"><div class="small">Live score</div><div class="metric amber">N/A</div></div><div class="tile"><div class="small">Release alerts</div><div class="metric">N/A</div></div>`;$("scores").innerHTML=CCY.map(c=>`<tr><td><b>${c}</b></td><td>—</td><td class="amber">Unavailable</td><td>—</td><td>${LABEL[c]}</td></tr>`).join("");$("pairs").textContent="Pair ranking unavailable until data feed loads.";$("events").textContent="No feed data loaded.";$("sources").textContent="Check GitHub Actions workflow and data/latest.json."}
function render(){
 const rows=payload.currencies||[];let sorted=[...rows].sort((a,b)=>b.score-a.score),strong=sorted[0],weak=sorted[sorted.length-1];
 $("tiles").innerHTML=[["Strongest",strong?.code||"—", "green"],["Weakest",weak?.code||"—","red"],["Score spread",strong&&weak?(strong.score-weak.score).toFixed(1):"—","amber"],["Data coverage",`${rows.filter(x=>x.confidence!=="Low").length}/8`,`blue`]].map(x=>`<div class="tile"><div class="small">${x[0]}</div><div class="metric ${x[2]}">${x[1]}</div><div class="small">Rules-based · provisional</div></div>`).join("");
 $("scores").innerHTML=rows.map(x=>`<tr><td><b>${x.code}</b></td><td class="${cls(x.score)}"><b>${x.score>0?"+":""}${Number(x.score).toFixed(1)}</b></td><td class="${cls(x.score)}">${sign(x.score)}</td><td>${x.confidence||"Low"}</td><td>${x.summary||LABEL[x.code]}</td></tr>`).join("");
 let ps=[];for(let a of rows)for(let b of rows)if(a.code!==b.code)ps.push({pair:a.code+"/"+b.code,gap:a.score-b.score});
 ps.sort((a,b)=>b.gap-a.gap);$("pairs").innerHTML=ps.slice(0,6).map(p=>`<div class="pair"><b>${p.pair}</b><span class="${cls(p.gap)}">${p.gap>0?"+":""}${p.gap.toFixed(1)} gap</span></div>`).join("");
 const ev=payload.events||[];$("events").innerHTML=ev.length?ev.slice(0,30).map(e=>`<div class="event"><div class="small">${fmt(e.time)}</div><div><b>${e.currency||"MACRO"} · ${e.title}</b><div class="small">${e.summary||""} <a href="${e.url||"#"}" target="_blank" rel="noopener">Source</a></div></div><span class="badge ${String(e.impact||"low").toLowerCase()}">${e.impact||"Info"}</span></div>`).join(""):"No new official-source events in the feed window.";
 $("sources").innerHTML=(payload.sources||[]).map(s=>`<div>• <a href="${s.url}" target="_blank" rel="noopener">${s.name}</a> — ${s.status||"checked"} · ${fmt(s.checked_at)}</div>`).join("")+`<p>Build timestamp: ${fmt(payload.generated_at)}. Feed timestamps and availability vary by publisher.</p>`;
}
$("refresh").onclick=load;
$("export").onclick=()=>{if(!payload)return alert("No data loaded yet.");let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));a.download="fx-fundamental-snapshot.json";a.click();URL.revokeObjectURL(a.href)};
$("journal").value=localStorage.getItem("fxJournal")||"";$("journal").addEventListener("input",e=>localStorage.setItem("fxJournal",e.target.value));
load();setInterval(load,5*60*1000);