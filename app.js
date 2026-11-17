const CURRENCIES = ["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD"];
const $ = (id) => document.getElementById(id);
let snapshot = null;

function safeText(value, fallback="—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}
function fmtDate(value) {
  if (!value || value.includes("Awaiting")) return "No successful build yet";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-SG",{timeZone:"Asia/Singapore",dateStyle:"medium",timeStyle:"short"})+" SGT";
}
function setStatus(ok, message) {
  $("data-status").textContent = message;
  $("status-dot").style.background = ok ? "var(--green)" : "var(--amber)";
  $("pipeline-label").textContent = ok ? "Snapshot loaded" : "Data needs attention";
}
function metric(value, suffix="") { return value === null || value === undefined ? "N/A" : `${value}${suffix}`; }
function metric2(value) {
  if (value === null || value === undefined || value === "") return "N/A";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) + "%" : "N/A";
}
function currencyRows(targetId) {
  const rows = (snapshot?.currencies || []).map(c => `<tr>
    <td>${safeText(c.code)}</td><td class="score-na">${c.score === null || c.score === undefined ? "N/A" : Number(c.score).toFixed(2)}</td>
    <td>${safeText(c.policy_rate_display || (c.policy_rate == null ? null : Number(c.policy_rate).toFixed(2) + "%"))}</td><td>${metric2(c.inflation)} <small>${c.inflation_period||c.inflation_year||""}</small></td><td>${metric2(c.gdp_growth)} <small>${c.gdp_growth_period||c.gdp_growth_year||""}</small></td><td>${metric2(c.unemployment)} <small>${c.unemployment_year||""}</small></td>
    <td>${safeText(c.confidence,"Low")} · ${safeText(c.data_status,"Not connected")}</td></tr>`).join("");
  $(targetId).innerHTML = rows || `<tr><td colspan="7" class="empty">No currency data in snapshot.</td></tr>`;
}
function newsSummary(e) {
  if (e.source === "Forex Factory") {
    const actual=e.actual || "Pending";
    const forecast=e.forecast || "Not supplied";
    const previous=e.previous || "Not supplied";
    return `Economic calendar · ${e.impact||"Unrated"} impact. Actual: ${actual} · Forecast: ${forecast} · Previous: ${previous}. Compare the actual result with the forecast; the previous figure is context, not the consensus.`;
  }
  const supplied=String(e.summary||"").trim();
  if(supplied && supplied.toLowerCase()!=="no summary supplied.") return supplied;
  const title=String(e.title||"This release").toLowerCase();
  const topic=/rate decision|policy rate|interest rate|monetary policy/.test(title)?"monetary policy and interest rates":
    /inflation|consumer price|cpi|price index/.test(title)?"inflation and price developments":
    /gdp|gross domestic product|growth/.test(title)?"economic growth":
    /employment|unemployment|labour|labor|wage|payroll/.test(title)?"employment and wages":
    /financial stability|financial conditions|credit/.test(title)?"financial conditions and stability":
    /outlook|forecast|projection/.test(title)?"the economic outlook":"economic and central-bank developments";
  return (e.source||"The central bank")+" published an update concerning "+topic+". The feed did not include a detailed explanation; open the original release for figures, context and policy implications.";
}
function renderNews(targetId, filter="ALL", limit=100) {
  const items = (snapshot?.events || []).filter(e => (filter==="ALL" || e.currency===filter) && (targetId!=="calendar-list" || e.source==="Forex Factory")).slice(0,limit);
  $(targetId).innerHTML = items.length ? items.map(e => {
    const href = /^https?:\/\//i.test(e.url || "") ? e.url : "#";
    const calendarFigures = e.source === "Forex Factory" ? `<div class="ff-figures"><span class="ff-figure ff-actual"><small>ACTUAL</small><b>${escapeHtml(e.actual || "Pending")}</b></span><span class="ff-figure ff-forecast"><small>FORECAST</small><b>${escapeHtml(e.forecast || "—")}</b></span><span class="ff-figure ff-previous"><small>PREVIOUS</small><b>${escapeHtml(e.previous || "—")}</b></span></div>` : "";
    const summary = e.source === "Forex Factory" ? "Compare the actual result with the forecast. The previous figure is context, not the market consensus." : newsSummary(e);
    return `<article class="news-item ${e.source === "Forex Factory" ? "ff-calendar-item" : ""}"><div class="news-meta"><span class="ccy-pill">${safeText(e.currency)}</span><span>${safeText(e.time ? fmtDate(e.time) : "Time not supplied")}</span><span>${safeText(e.source,"Official source")}</span><span class="impact-pill impact-${String(e.impact||"Low").toLowerCase()}">${safeText(e.impact,"Low")} impact</span></div><a href="${href}" target="_blank" rel="noopener noreferrer">${safeText(e.title,"Untitled release")}</a>${calendarFigures}<div class="news-bias">${safeText(e.bias,"No clear policy bias")} · ${safeText(e.direction,"Context only")}</div><p>${safeText(summary)}</p></article>`;
  }).join("") : `<div class="empty">No matching official releases in the current snapshot.</div>`;
}
function pairResearchLink(pair) { return `<a class="text-button" href="./pair-research.html?pair=${encodeURIComponent(pair.replace("/","-"))}">View Fundamental Analysis ↗</a>`; }
const PAIR_ORDER=["EUR","GBP","AUD","NZD","USD","CAD","CHF","JPY"];
const PAIR_RANK=Object.fromEntries(PAIR_ORDER.map((code,index)=>[code,index]));
function canonicalPair(raw){
  const parts=String(raw||"").toUpperCase().split(/[/-]/);
  if(parts.length!==2||!(parts[0] in PAIR_RANK)||!(parts[1] in PAIR_RANK)||parts[0]===parts[1])return null;
  return PAIR_RANK[parts[0]]<PAIR_RANK[parts[1]]?parts[0]+"/"+parts[1]:parts[1]+"/"+parts[0];
}
function readSelectedPairs(){try{const v=JSON.parse(localStorage.getItem("macropulse-selected-pairs")||"[]");return Array.isArray(v)?[...new Set(v.map(canonicalPair).filter(Boolean))]:[]}catch{return[]}}
function saveSelectedPairs(items){localStorage.setItem("macropulse-selected-pairs",JSON.stringify([...new Set(items.map(canonicalPair).filter(Boolean))]));}
function renderPairs() {
  const all=(snapshot?.currencies||[]).filter(c=>CURRENCIES.includes(c.code));
  if (all.length < 2) {
    const msg = `<div class="empty">Currency list is incomplete. Pair research pages remain available once the currency snapshot loads.</div>`;
    $("overview-pairs").innerHTML = msg; $("pair-table").innerHTML = msg; return;
  }
  const selected=readSelectedPairs();
  const byCode=Object.fromEntries(all.map(c=>[c.code,c]));
  const orderedCodes=PAIR_ORDER.filter(code=>byCode[code]);
  const pairs=[];
  for(let i=0;i<orderedCodes.length;i++){
    for(let j=i+1;j<orderedCodes.length;j++){
      const base=byCode[orderedCodes[i]],quote=byCode[orderedCodes[j]];
      pairs.push({pair:base.code+"/"+quote.code,spread:Number.isFinite(Number(base.score))&&base.score!==null&&Number.isFinite(Number(quote.score))&&quote.score!==null?Number(base.score)-Number(quote.score):null});
    }
  }
  pairs.sort((a,b)=>a.spread===null?1:b.spread===null?-1:b.spread-a.spread);
  $("overview-pairs").innerHTML=pairs.slice(0,5).map(p=>`<div class="source-row"><div><b>${p.pair}</b><small>${p.spread===null?"Score unavailable":(p.spread>0?"+":"")+p.spread.toFixed(1)}</small></div>${pairResearchLink(p.pair)}</div>`).join("");
  $("pair-table").innerHTML=`<div class="pair-toolbar"><div><b id="pair-selected-count">${selected.length} pairs selected</b><small>Your selections are saved in this browser only.</small></div><div class="pair-toolbar-actions"><label class="pair-filter"><input type="checkbox" id="pair-selected-filter"> Show selected only</label><button type="button" class="text-button" id="pair-clear-selection">Clear selection</button></div></div><div class="table-wrap"><table class="pair-select-table"><thead><tr><th>Select</th><th>Pair</th><th>Relative score spread</th><th>Directional read</th><th>Fundamental research</th></tr></thead><tbody>${pairs.map(p=>`<tr data-pair-row="${p.pair}"><td><input class="pair-pick" type="checkbox" value="${p.pair}" aria-label="Select ${p.pair}" ${selected.includes(p.pair)?"checked":""}></td><td>${p.pair}</td><td>${p.spread===null?"N/A":(p.spread>0?"+":"")+p.spread.toFixed(2)}</td><td>${p.spread===null?"No verified score":p.spread>0.35?"Base stronger":p.spread< -0.35?"Quote stronger":"Close / neutral"}</td><td>${pairResearchLink(p.pair)}</td></tr>`).join("")}</tbody></table></div><div class="notice"><b>My selected pairs</b><p id="pair-selection-summary">${selected.length?selected.join(" · "):"Tick the box beside any pair you want to monitor. Your shortlist will remain saved on this device and browser."}</p></div><div class="notice"><b>Pair Intelligence</b><p>Open any of the 28 standardised currency pairs for a currency-by-currency macro comparison, geopolitical and commodity sensitivities, latest dashboard news, and bullish/bearish scenario checklist. Research pages are separate from the provisional score ranking.</p></div>`;
  const updateSelection=()=>{const picks=[...document.querySelectorAll(".pair-pick:checked")].map(x=>x.value);saveSelectedPairs(picks);$("pair-selected-count").textContent=picks.length+" pairs selected";$("pair-selection-summary").textContent=picks.length?picks.join(" · "):"Tick the box beside any pair you want to monitor. Your shortlist will remain saved on this device and browser.";};
  document.querySelectorAll(".pair-pick").forEach(box=>box.addEventListener("change",()=>{updateSelection();applyPairFilter();}));
  const filter=$("pair-selected-filter");filter.addEventListener("change",applyPairFilter);
  $("pair-clear-selection").addEventListener("click",()=>{document.querySelectorAll(".pair-pick").forEach(x=>x.checked=false);saveSelectedPairs([]);updateSelection();applyPairFilter();});
  function applyPairFilter(){const only=filter.checked;document.querySelectorAll("[data-pair-row]").forEach(row=>{row.hidden=only&&!row.querySelector(".pair-pick").checked;});}
}function renderSources() {
  const sources=snapshot?.sources||[];
  $("source-directory").innerHTML=sources.length?sources.map(s=>`<div class="source-row"><div><b>${safeText(s.name)}</b><small>${safeText(s.status)} · checked ${fmtDate(s.checked_at)}</small></div><a href="${s.url}" target="_blank" rel="noopener">Open ↗</a></div>`).join(""):`<div class="empty">No source metadata.</div>`;
}
async function loadSnapshot() {
  $("refresh-btn").disabled=true; $("refresh-btn").textContent="↻ Loading";
  try {
    const response=await fetch(`data/latest.json?ts=${Date.now()}`,{cache:"no-store"});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!data || !Array.isArray(data.currencies) || !Array.isArray(data.events)) throw new Error("Snapshot schema is invalid");
    snapshot=data;
    currencyRows("currency-rows"); currencyRows("currency-rows-full");
    renderNews("overview-news","ALL",5); renderNews("news-list",$("news-filter").value); renderNews("calendar-list","ALL",100);
    renderPairs(); renderSources();
    $("metric-news").textContent=data.events.length;
    const ok=(data.sources||[]).filter(s=>s.status==="ok").length;
    const macro=(data.sources||[]).filter(s=>(String(s.name||"").includes("World Bank") || String(s.name||"").startsWith("OECD")));
    const macroOk=macro.filter(s=>s.status==="ok"||s.status==="partial").length;
    $("metric-feeds").textContent=`${ok}/${(data.sources||[]).length}`;
    $("updated-at").textContent=`Built ${fmtDate(data.generated_at)}`;
    $("footer-model").textContent=`Snapshot model: ${safeText(data.model)}`;
    const isStale=!data.generated_at || Date.now()-new Date(data.generated_at).getTime()>8*3600*1000;
    setStatus(!isStale && ok>0, isStale ? "Snapshot is stale or awaiting build" : `${ok} news feeds responding · ${macroOk}/${macro.length} macro sources available`);
  } catch(error) {
    setStatus(false,`Unable to load data snapshot: ${error.message}`);
    $("updated-at").textContent="Check GitHub Pages deployment and data/latest.json";
    $("currency-rows").innerHTML=`<tr><td colspan="7" class="empty">Data unavailable. ${error.message}</td></tr>`;
  } finally { $("refresh-btn").disabled=false; $("refresh-btn").textContent="↻ Refresh"; }
}
const titles={overview:"Market overview",currencies:"Currency strength",pairs:"FX pair analysis",news:"News intelligence",calendar:"Event watch",positioning:"CFTC positioning",journal:"Trading journal"};
function navigate(view) {
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("page-title").textContent=titles[view]||"Market overview";
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
$("refresh-btn").addEventListener("click",loadSnapshot);
$("news-filter").addEventListener("change",()=>renderNews("news-list",$("news-filter").value));
function clock(){ $("clock").textContent=new Date().toLocaleTimeString("en-SG",{timeZone:"Asia/Singapore",hour12:false})+" SGT"; }
clock(); setInterval(clock,1000); loadSnapshot(); setInterval(loadSnapshot,5*60*1000);

// Local-only trading journal
function journalRead(){try{return JSON.parse(localStorage.getItem("macropulse-journal")||"[]")}catch{return[]}}
function journalRender(){
  const entries=journalRead();
  $("journal-list").innerHTML=entries.length?entries.map((e,i)=>`<div class="journal-entry"><div><b>${escapeHtml(e.pair)} · ${escapeHtml(e.bias)}</b><small class="news-meta">${escapeHtml(e.date)}</small><p>${escapeHtml(e.thesis)}</p></div><button class="text-button" data-delete="${i}">Delete</button></div>`).join(""):`<div class="empty">No journal entries yet.</div>`;
  document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{const a=journalRead();a.splice(Number(b.dataset.delete),1);localStorage.setItem("macropulse-journal",JSON.stringify(a));journalRender()}));
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("journal-add").addEventListener("click",()=>{
  const pair=$("journal-pair").value.trim().toUpperCase(), thesis=$("journal-thesis").value.trim();
  if(!pair||!thesis){alert("Please enter a pair and a trading thesis.");return;}
  const entries=journalRead();entries.unshift({pair,bias:$("journal-bias").value,thesis,date:new Date().toLocaleString()});
  localStorage.setItem("macropulse-journal",JSON.stringify(entries));$("journal-pair").value="";$("journal-thesis").value="";journalRender();
});
$("journal-export").addEventListener("click",()=>{
  const rows=[["Date","Pair","Bias","Thesis"],...journalRead().map(e=>[e.date,e.pair,e.bias,e.thesis])];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download="macropulse-journal.csv";a.click();URL.revokeObjectURL(url);
});
journalRender();
