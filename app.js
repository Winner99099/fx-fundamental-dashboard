const CURRENCIES = ["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD"];
const $ = (id) => document.getElementById(id);
let snapshot = null;
let aiReview = null;

function safeText(value, fallback="—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}
function fmtDate(value) {
  if (!value || value.includes("Awaiting")) return "No successful build yet";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString().replace("T"," ").replace(/\.\d{3}Z$/," +00:00");
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
function eventReleaseSummary(r) {
  const when=r.time?new Date(r.time).toLocaleString("en-SG",{timeZone:"Asia/Singapore",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}):"time unavailable";
  return `Latest ${escapeHtml(r.title)} · ${when} SGT · Previous: ${escapeHtml(r.previous||"N/A")} · Forecast: ${escapeHtml(r.forecast||"N/A")} · Actual: ${escapeHtml(r.actual||"Not captured")}`;
}
function structuralUpdateSummary(c) {
  const status=c.structural_update_status||"baseline";
  const rawDate=c.structural_update_date;
  let dateText=rawDate||"date unavailable";
  if(rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const d=new Date(rawDate+"T00:00:00Z");
    dateText=d.toLocaleDateString("en-SG",{timeZone:"UTC",day:"2-digit",month:"short",year:"numeric"});
  }
  if(status==="core_data_updated") return "Core data updated · "+dateText+" · "+safeText(c.structural_update_note,"Core indicator changed");
  if(status==="relative_score_changed") return "Relative score recalculated · "+dateText;
  if(status==="baseline") return "Baseline recorded · awaiting next core-data change";
  return (rawDate?"No new core-data update · last change "+dateText:"No new core-data update recorded");
}
function scoreHistory(c) {
  const current=c.score===null||c.score===undefined?null:Number(c.score);
  const previous=c.previous_structural_score===null||c.previous_structural_score===undefined?current:Number(c.previous_structural_score);
  if(current===null||!Number.isFinite(current)) return "N/A";
  const delta=previous===null||!Number.isFinite(previous)?null:current-previous;
  const deltaText=delta===null?"—":(delta>0?"+":"")+delta.toFixed(2);
  const deltaClass=delta===null||delta===0?"score-na":delta>0?"score-positive":"score-negative";
  return '<span class="score-current">'+current.toFixed(2)+'</span><small class="score-history">Previous '+(previous===null?"—":previous.toFixed(2))+' <span class="'+deltaClass+'">Δ '+deltaText+'</span></small>';
}
function selectedStrengthCurrencies(){return [...document.querySelectorAll('.strength-currency-check:checked')].map(x=>x.value);}
function updateStrengthSelectionCount(){const count=$('strength-selection-count'),selected=selectedStrengthCurrencies().length;if(count)count.textContent=selected+' / 8 SELECTED';}
function setupStrengthCurrencyFilter(){
 const checks=[...document.querySelectorAll('.strength-currency-check')];if(!checks.length||checks[0].dataset.ready)return;
 checks.forEach(box=>{box.dataset.ready='1';box.addEventListener('change',()=>{updateStrengthSelectionCount();renderCurrencyStrengthRows();});});
 $('strength-select-all')?.addEventListener('click',()=>{checks.forEach(x=>x.checked=true);updateStrengthSelectionCount();renderCurrencyStrengthRows();});
 $('strength-clear-all')?.addEventListener('click',()=>{checks.forEach(x=>x.checked=false);updateStrengthSelectionCount();renderCurrencyStrengthRows();});
 updateStrengthSelectionCount();
}
// One shared snapshot feeds every view. Overview displays the core macro readings;
// Currency Strength displays derived interpretation only.
function renderOverviewCoreRows() {
  const rows=(snapshot?.currencies||[]).map(c=>`<tr>
    <td>${safeText(c.code)}</td>
    <td class="structural-score-cell">${scoreHistory(c)}</td>
    <td class="${c.event_score==null?"score-na":Number(c.event_score)>=0?"score-positive":"score-negative"}">${c.event_score==null?"No scored release":Number(c.event_score).toFixed(2)}<small>${c.last_release_reference?eventReleaseSummary(c.last_release_reference):"No completed data release in feed"} · ${Number(c.event_surprise_count||0)} scored</small></td>
    <td class="${c.short_term_score==null?"score-na":Number(c.short_term_score)>=0?"score-positive":"score-negative"}">${c.short_term_score==null?"N/A":Number(c.short_term_score).toFixed(2)}<small>${c.short_term_score_status==="Structural baseline only · no verified event surprise captured"?"Structural baseline": "Event-adjusted"}</small></td>
    <td>${safeText(c.policy_rate_display || (c.policy_rate == null ? null : Number(c.policy_rate).toFixed(2) + "%"))}</td>
    <td>${metric2(c.inflation)}<small>${safeText(c.inflation_period||c.inflation_year,"")}</small></td>
    <td>${metric2(c.gdp_growth)}<small>${safeText(c.gdp_growth_period||c.gdp_growth_year,"")}</small></td>
    <td>${metric2(c.unemployment)}<small>${safeText(c.unemployment_period||c.unemployment_year,"")}</small></td>
    <td>${safeText(c.confidence,"Low")} · ${safeText(c.data_status,"Not connected")}</td>
  </tr>`).join("");
  const target=$("currency-rows");
  if(target) target.innerHTML=rows||'<tr><td colspan="9" class="empty">No core currency data in snapshot.</td></tr>';
}
function renderCurrencyStrengthRows() {
  const selected=selectedStrengthCurrencies();
  const visible=(snapshot?.currencies||[]).filter(c=>selected.includes(c.code));
  const rows=visible.map(c=>{
    const structural=c.score==null?null:Number(c.score);
    const momentum=c.fundamental_trend_score==null?null:Number(c.fundamental_trend_score);
    const momentumLabel=momentum==null?"N/A":momentum>=0.75?"Strong":momentum<=-0.75?"Weak":"Neutral";
    const momentumClass=momentumLabel==="Strong"?"score-positive":momentumLabel==="Weak"?"score-negative":"score-na";
    const persistence=c.fundamental_trend_persistence||"Unconfirmed";
    const persistenceClass=/Persistent|Building/.test(persistence)?"score-positive":/Mixed/.test(persistence)?"score-negative":"score-na";
    return `<tr>
      <td>${safeText(c.code)}</td>
      <td class="structural-score-cell"><span class="${structural==null?"score-na":structural>0?"score-positive":structural<0?"score-negative":"score-na"}">${structural==null||!Number.isFinite(structural)?"N/A":structural.toFixed(2)}</span><small>${structural==null?"Structural score unavailable":structural>0?"Structural strength":structural<0?"Structural weakness":"Neutral"} · ${escapeHtml(structuralUpdateSummary(c))}</small></td>
      <td><span class="${momentumClass}">${momentumLabel}</span></td>
      <td><span class="${persistenceClass}">${escapeHtml(persistence)}</span><small>${escapeHtml(c.fundamental_trend_detail||"Insufficient recent macro history")}</small></td>
    </tr>`;
  }).join("");
  const target=$("currency-rows-full");
  if(target) target.innerHTML=rows||'<tr><td colspan="4" class="empty">No currencies selected. Tick one or more currencies above.</td></tr>';
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
function hasRecentScoreUpdate(c) {
  if(!c || c.score===null || c.score===undefined || c.previous_structural_score===null || c.previous_structural_score===undefined) return false;
  if(Number(c.score)===Number(c.previous_structural_score)) return false;
  if(!c.structural_update_date) return false;
  const stamp=new Date(/^\\d{4}-\\d{2}-\\d{2}$/.test(c.structural_update_date)?c.structural_update_date+"T00:00:00Z":c.structural_update_date).getTime();
  const age=Date.now()-stamp;
  return Number.isFinite(stamp) && age>=0 && age<=7*24*60*60*1000;
}
function pairScoreHistory(c) {
  const current=c?.score===null||c?.score===undefined?null:Number(c.score);
  const previous=c?.previous_structural_score===null||c?.previous_structural_score===undefined?current:Number(c.previous_structural_score);
  if(current===null||!Number.isFinite(current)) return safeText(c?.code)+" N/A";
  const delta=previous===null||!Number.isFinite(previous)?null:current-previous;
  const deltaText=delta===null?"—":(delta>0?"+":"")+delta.toFixed(2);
  const cls=delta===null||delta===0?"score-na":delta>0?"score-positive":"score-negative";
  const recent=hasRecentScoreUpdate(c)?"pair-score-recent":"";
  return '<span class="'+recent+'">'+safeText(c.code)+' '+(previous===null?"—":previous.toFixed(2))+' → '+current.toFixed(2)+' <b class="'+cls+'">('+deltaText+')</b></span>';
}
function recentScoreChangeAlert(currencies) {
  const alerts=[];
  const now=Date.now();
  for(const c of currencies) {
    if(c.score===null||c.score===undefined||c.previous_structural_score===null||c.previous_structural_score===undefined) continue;
    if(Number(c.score)===Number(c.previous_structural_score)) continue;
    const rawDate=c.structural_update_date;
    if(!rawDate) continue;
    const stamp=new Date(/^\d{4}-\d{2}-\d{2}$/.test(rawDate)?rawDate+"T00:00:00Z":rawDate).getTime();
    if(!Number.isFinite(stamp)) continue;
    const age=now-stamp;
    if(age>=0 && age<=7*24*60*60*1000) {
      const date=new Date(stamp).toLocaleDateString("en-SG",{timeZone:"UTC",day:"2-digit",month:"short"});
      alerts.push(c.code+" "+Number(c.previous_structural_score).toFixed(2)+" → "+Number(c.score).toFixed(2)+" · "+date);
    }
  }
  return alerts.length?'<small class="pair-score-alert">⚠ SCORE CHANGED · '+alerts.map(safeText).join(" / ")+'</small>':"";
}

function ccyMap(){return Object.fromEntries((snapshot?.currencies||[]).map(c=>[c.code,c]));}
function biasDrivers(c,role){
 const labels={policy_rate_level:"Policy rate",inflation_vs_target:"Inflation vs target",gdp_growth:"GDP growth",employment:"Employment",economic_surprises:"Economic surprises"};
 const items=Object.entries(c?.score_components||{}).filter(([k,v])=>labels[k]&&v!=null&&Number.isFinite(Number(v))).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,3);
 const drivers=items.length?items.map(([k,v])=>'<span class="driver-chip '+(Number(v)>=0?'driver-positive':'driver-negative')+'">'+labels[k]+' '+(Number(v)>0?'+':'')+Number(v).toFixed(2)+'</span>').join(''):'<small class="driver-empty">No scored driver components available</small>';
 return '<div class="driver-currency"><b>'+safeText(c?.code,'Unknown')+' · '+role+'</b><div class="driver-wrap-inner">'+drivers+'</div></div>';
}
function selectedBiasCurrencies(){return [...document.querySelectorAll('.bias-currency-check:checked')].map(x=>x.value);}
function updateBiasCurrencyCount(){const count=$('bias-selection-count'),selected=selectedBiasCurrencies().length;if(count)count.textContent=selected+' / 8 SELECTED';}
function setupBiasCurrencyFilter(){
 const checks=[...document.querySelectorAll('.bias-currency-check')];if(!checks.length||checks[0].dataset.ready)return;
 checks.forEach(box=>{box.dataset.ready='1';box.addEventListener('change',()=>{updateBiasCurrencyCount();renderBiasCards();});});
 $('bias-select-all')?.addEventListener('click',()=>{checks.forEach(x=>x.checked=true);updateBiasCurrencyCount();renderBiasCards();});
 $('bias-clear-all')?.addEventListener('click',()=>{checks.forEach(x=>x.checked=false);updateBiasCurrencyCount();renderBiasCards();});
 updateBiasCurrencyCount();
}
function currencyMomentumLabel(c){const n=c?.fundamental_trend_score==null?null:Number(c.fundamental_trend_score);return n==null||!Number.isFinite(n)?"N/A":n>=0.75?"Strong":n<=-0.75?"Weak":"Neutral";}

function selectedAICurrencies(){return [...document.querySelectorAll('.ai-currency-check:checked')].map(x=>x.value);}
function selectedAIPairs(){
 const selected=selectedAICurrencies(),pairs=[];
 for(let i=0;i<PAIR_ORDER.length;i++)for(let j=i+1;j<PAIR_ORDER.length;j++){
  const base=PAIR_ORDER[i],quote=PAIR_ORDER[j];
  if(selected.includes(base)&&selected.includes(quote))pairs.push(base+'/'+quote);
 }
 return pairs;
}
function setupAICurrencyFilter(){
 const root=$('ai-review-panel');if(!root||root.dataset.aiEvents)return;
 root.dataset.aiEvents='1';
 root.addEventListener('change',event=>{
  if(event.target?.classList?.contains('ai-currency-check'))renderAIReview();
 });
 root.addEventListener('click',async event=>{
  const id=event.target?.id;
  if(id==='ai-select-all'||id==='ai-clear-all'){
   root.querySelectorAll('.ai-currency-check').forEach(x=>x.checked=id==='ai-select-all');
   renderAIReview();
  }
  if(id==='ai-run-selected'){
   const pairs=selectedAIPairs(),target=$('ai-copy-status'),button=$('ai-run-selected');
   if(!pairs.length){if(target)target.textContent='Select at least two currencies first.';return;}
   const endpoint=$('ai-worker-url')?.value.trim()||localStorage.getItem('macropulse-ai-worker-url')||'';
   if(!endpoint){if(target)target.textContent='Please enter your Cloudflare Worker URL first.';return;}
   localStorage.setItem('macropulse-ai-worker-url',endpoint);
   let pin=sessionStorage.getItem('macropulse-ai-worker-pin')||'';
   if(!pin){pin=window.prompt('Enter your private AI Review access PIN:')||'';if(!pin)return;sessionStorage.setItem('macropulse-ai-worker-pin',pin);}
   const previousGenerated=aiReview?.generated_at||'';
   if(button){button.disabled=true;button.textContent='Submitting analysis…';}
   if(target)target.textContent='Sending '+pairs.length+' selected pair(s) securely…';
   try{
    const response=await fetch(endpoint.replace(/\/$/, '')+'/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pairs,pin})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||('Worker returned HTTP '+response.status));
    if(target)target.textContent='Analysis started. Waiting for ChatGPT to finish…';
    const started=Date.now();let completed=false;
    while(Date.now()-started<240000){
     await new Promise(resolve=>setTimeout(resolve,7000));
     const r=await fetch('data/ai_review.json?ts='+Date.now(),{cache:'no-store'});
     if(r.ok){
      const fresh=await r.json(),requested=fresh.last_requested_pairs||[];
      const newer=!previousGenerated||new Date(fresh.generated_at).getTime()>new Date(previousGenerated).getTime();
      const matches=pairs.every(p=>requested.includes(p));
      if(fresh.status==='ok'&&newer&&matches){aiReview=fresh;renderAIReview();completed=true;break;}
      if(fresh.status==='error'&&newer){aiReview=fresh;renderAIReview();throw new Error(fresh.last_error||'AI review failed');}
     }
     if(target)target.textContent='ChatGPT is analysing '+pairs.join(', ')+' · checking for results…';
    }
    if(!completed)throw new Error('The workflow has not finished within four minutes. Leave this page open and refresh AI Review shortly.');
    if(target)target.textContent='Analysis completed. Results updated below.';
   }catch(error){
    if(target)target.textContent='Analysis could not be completed: '+error.message;
    if(/401|403|PIN/i.test(error.message))sessionStorage.removeItem('macropulse-ai-worker-pin');
   }finally{if(button){button.disabled=false;button.textContent='Analyse Selected Pair(s)';}}
  }
 });
}
function renderAIReviewText(value){
 const safe=escapeHtml(value||"Not available");
 return safe.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br>");
}
function renderAIReview(){
 const root=$("ai-review-panel");if(!root)return;
 setupAICurrencyFilter();
 const providers=aiReview&&aiReview.providers?aiReview.providers:{},chat=providers.chatgpt||{};
 const label=s=>s==="ok"?"Ready":s==="not_configured"?"API key needed":s==="error"?"Error":"Pending";
 const provider=(p)=>'<div class="bias-signal"><small>CHATGPT</small><b>'+label(p.status)+'</b><span>'+escapeHtml(p.model||"Model pending")+' · '+escapeHtml(p.message||"No review yet")+'</span></div>';
 if(!aiReview){root.innerHTML='<div class="panel"><div class="panel-head"><b>ChatGPT AI Momentum Review</b><span class="tag tag-neutral">AWAITING FIRST RUN</span></div><p>Currency momentum will refresh automatically. Select pairs below and use the GitHub Actions workflow to request pair analysis.</p>'+provider(chat)+'</div>';return;}
 const currencyReviews=aiReview.currency_reviews||chat.review?.currency_reviews||{};
 const pairReviews=aiReview.pair_reviews||chat.review?.pair_reviews||{};
 const currencyRows=CURRENCIES.map(code=>{const c=currencyReviews[code]||{};return '<article class="bias-signal"><b>'+code+' · ChatGPT: '+escapeHtml(c.bias||"N/A")+'</b><small>CONFIDENCE · '+escapeHtml(c.confidence||"—")+'</small><span>'+escapeHtml(c.summary||"No currency review available.")+'</span></article>';}).join("");
 const selected=selectedAICurrencies(),selectedPairs=selectedAIPairs();
 const pairRows=selectedPairs.map(pair=>{
  const c=pairReviews[pair]||{};
  const hasReview=!!(c.overall_conclusion||c.chatgpt_assessment||c.fundamental_view||c.momentum_view);
  return '<article class="bias-card bias-neutral"><div class="bias-card-head"><div><h3>'+pair+'</h3><small>SELECTED PAIR · CHATGPT</small></div><div class="bias-status"><b>'+escapeHtml(c.bias||"NOT REVIEWED")+'</b><small>'+escapeHtml(c.confidence||"—")+'</small></div></div><div class="bias-card-body">'+(hasReview?'<div class="bias-label">1 · FUNDAMENTAL BIAS</div><p>'+renderAIReviewText(c.fundamental_view)+'</p><div class="bias-label">2 · SHORT-TERM MOMENTUM</div><p>'+renderAIReviewText(c.momentum_view)+'</p><div class="bias-label">5 · CHATGPT ASSESSMENT</div><p>'+renderAIReviewText(c.chatgpt_assessment||c.summary)+'</p><div class="bias-label">6 · OVERALL CONCLUSION</div><p>'+renderAIReviewText(c.overall_conclusion)+'</p>':'<p>No pair-specific review yet. Copy the selected pair list and submit it through GitHub Actions.</p>')+'</div></article>';
 }).join("");
 const generated=aiReview.generated_at?new Date(aiReview.generated_at).toLocaleString("en-SG",{timeZone:"Asia/Singapore",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false})+" SGT":"No successful review yet";
 const inputStamp=aiReview.input_snapshot_generated_at?new Date(aiReview.input_snapshot_generated_at):null;
 const inputAge=inputStamp?Date.now()-inputStamp.getTime():Infinity;
 const inputFresh=Number.isFinite(inputAge)&&inputAge>=0&&inputAge<8*60*60*1000;
 const inputText=inputStamp?inputStamp.toLocaleString("en-SG",{timeZone:"Asia/Singapore",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false})+" SGT":"timestamp unavailable";
 const failed=aiReview.status==="error"||chat.status==="error";
 const stale=failed||aiReview.cache_is_stale||!inputFresh;
 const statusText=failed?(Object.keys(pairReviews).length?"ERROR · SHOWING LAST SUCCESSFUL REVIEW":"AI REVIEW FAILED"):(inputFresh?"INPUT CURRENT":"INPUT STALE");
 root.innerHTML='<div class="panel"><div class="panel-head"><div><b>AI Momentum Review</b><p>Last successful review: '+generated+' · Market-data snapshot: '+inputText+'</p></div><span class="tag tag-neutral">'+statusText+'</span></div>'+(failed?'<div class="notice notice-warn"><b>ChatGPT could not complete the latest review</b><p>'+escapeHtml(aiReview.last_error||chat.message||"API request failed")+'. The last successful review is retained.</p></div>':"")+(stale&&!failed?'<div class="notice notice-warn"><b>Market-data snapshot may be stale</b><p>Refresh the underlying dashboard data before relying on this interpretation.</p></div>':"")+'<div class="bias-signal-grid">'+provider(chat)+'</div><p class="bias-scoreline">Currency momentum impact is maintained for all eight currencies. Pair-specific analysis is generated only for the pairs submitted for review. Pair direction is based on its own D1 price evidence; macro scores do not override price action.</p><div class="bias-label">INDIVIDUAL CURRENCY MOMENTUM IMPACT · ALL 8</div><div class="bias-signal-grid">'+currencyRows+'</div><div class="bias-label">SELECT CURRENCIES FOR PAIR ANALYSIS</div><div class="strength-filter bias-currency-filter"><div class="strength-filter-options">'+CURRENCIES.map(code=>'<label><input type="checkbox" class="ai-currency-check" value="'+code+'" '+(selected.includes(code)?"checked":"")+'><span>'+code+'</span></label>').join("")+'</div><div class="strength-filter-actions"><span class="tag tag-neutral">'+selected.length+' / 8 SELECTED · '+selectedPairs.length+' PAIRS</span><button type="button" class="text-button" id="ai-select-all">Select all</button><button type="button" class="text-button" id="ai-clear-all">Clear</button></div></div><div class="notice notice-info"><b>One-click pair analysis</b><p>Enter your Cloudflare Worker URL once. Select currencies above and click Analyse; results appear here automatically. Your GitHub token and OpenAI key stay on the server.</p><label style="display:block;margin:12px 0">Secure Worker URL <input id="ai-worker-url" type="url" placeholder="https://your-worker.your-subdomain.workers.dev" value="'+escapeHtml(localStorage.getItem('macropulse-ai-worker-url')||'')+'" style="width:100%;margin-top:6px"></label><div class="heading-actions"><button type="button" class="btn btn-primary" id="ai-run-selected">Analyse Selected Pair(s)</button></div><p id="ai-copy-status" class="muted">Selected pairs: '+(selectedPairs.join(", ")||"none")+'</p></div><div class="bias-label">SELECTED PAIR REVIEWS · '+selectedPairs.length+'</div><div class="bias-grid">'+(pairRows||'<div class="empty">Select at least two currencies to display pair choices.</div>')+'</div></div>';
 setupAICurrencyFilter();
}
function renderBiasCards(){
 setupBiasCurrencyFilter();
 const m=ccyMap(),pairs=[];for(let i=0;i<PAIR_ORDER.length;i++)for(let j=i+1;j<PAIR_ORDER.length;j++){const b=m[PAIR_ORDER[i]],q=m[PAIR_ORDER[j]],ok=b?.short_term_score!=null&&q?.short_term_score!=null,s=ok?Number(b.short_term_score)-Number(q.short_term_score):null;pairs.push({pair:b.code+'/'+q.code,b,q,s,market:snapshot?.pair_technical?.[b.code+'/'+q.code]||null,bias:s==null?'UNVERIFIED':s>.35?'BULLISH':s<-.35?'BEARISH':'NEUTRAL'});}
 const selected=selectedBiasCurrencies(),sort=$('bias-sort');
 let list=pairs.filter(p=>selected.includes(p.b.code)&&selected.includes(p.q.code));
 if(sort?.value==='weakest')list.sort((a,b)=>(a.s??Infinity)-(b.s??Infinity));else if(sort?.value==='risk')list.sort((a,b)=>{const t=x=>Math.min(...(snapshot?.events||[]).filter(e=>e.currency===x&&e.time&&new Date(e.time)>new Date()).map(e=>new Date(e.time).getTime()),Infinity);return Math.min(t(a.b.code),t(a.q.code))-Math.min(t(b.b.code),t(b.q.code));});else list.sort((a,b)=>Math.abs(b.s??0)-Math.abs(a.s??0));
 $('bias-cards').innerHTML=list.map(p=>{const cls=p.bias==='BULLISH'?'bias-bull':p.bias==='BEARISH'?'bias-bear':'bias-neutral';const upcoming=(snapshot?.events||[]).filter(e=>(e.currency===p.b.code||e.currency===p.q.code)&&e.time&&new Date(e.time)>new Date()).sort((a,b)=>new Date(a.time)-new Date(b.time))[0];const when=upcoming?escapeHtml(upcoming.title)+' · '+new Date(upcoming.time).toLocaleString('en-SG',{timeZone:'Asia/Singapore',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' SGT':'No upcoming event in current calendar snapshot';const bm=currencyMomentumLabel(p.b),qm=currencyMomentumLabel(p.q);const tech=p.market||{};const technicalPanel=tech.status==='ok'?'<div class="bias-label">SHORT-TERM PRICE ACTION · D1</div><div class="bias-signal-grid"><div class="bias-signal"><small>PRICE / 1D / 5D / 20D</small><b>'+tech.price+' · '+(tech.change_1d_pct>0?'+':'')+tech.change_1d_pct+'% / '+(tech.change_5d_pct>0?'+':'')+tech.change_5d_pct+'% / '+(tech.change_20d_pct>0?'+':'')+tech.change_20d_pct+'%</b><span>Latest daily close · '+safeText(tech.updated_at,'date unavailable')+'</span></div><div class="bias-signal"><small>RSI (14) / MACD</small><b>RSI '+safeText(tech.rsi14,'N/A')+' · '+(tech.macd!=null&&tech.macd_signal!=null?(tech.macd<tech.macd_signal?'MACD below signal':'MACD above signal'):'MACD N/A')+'</b><span>Momentum confirmation</span></div><div class="bias-signal"><small>20D / 50D AVERAGE</small><b>'+(tech.price<tech.sma20?'Below':'Above')+' 20D · '+(tech.price<tech.sma50?'Below':'Above')+' 50D</b><span>20D '+tech.sma20+' · 50D '+tech.sma50+'</span></div><div class="bias-signal"><small>20D SUPPORT / RESISTANCE</small><b>'+safeText(tech.support_20d,'N/A')+' / '+safeText(tech.resistance_20d,'N/A')+'</b><span>Recent 20-session range</span></div></div><p class="bias-scoreline">Technical price action is shown independently from the fundamental spread.</p>':'<div class="bias-label">SHORT-TERM PRICE ACTION · D1</div><p>Market data temporarily unavailable. No technical signal is inferred.</p>';const momentumPanel='<div class="bias-signal-grid"><div class="bias-signal"><small>FUNDAMENTAL MOMENTUM · BASE</small><b class="momentum-'+bm.toLowerCase()+'">'+p.b.code+' · '+bm+'</b><span>'+safeText(p.b.fundamental_trend_persistence,'Unconfirmed')+'</span></div><div class="bias-signal"><small>FUNDAMENTAL MOMENTUM · QUOTE</small><b class="momentum-'+qm.toLowerCase()+'">'+p.q.code+' · '+qm+'</b><span>'+safeText(p.q.fundamental_trend_persistence,'Unconfirmed')+'</span></div></div>'+technicalPanel+'<div class="bias-signal-grid technical-signal-grid"><div class="bias-signal"><small>D1 TECHNICAL TREND</small><b class="momentum-pending">Manual chart check</b><span>Not supplied by the live data feed</span></div><div class="bias-signal"><small>H4 ENTRY CONFIRMATION</small><b class="momentum-pending">Await confirmation</b><span>BOS + pullback/retest in bias direction</span></div></div>';return '<article class="bias-card '+cls+'"><div class="bias-card-head"><div><h3>'+p.pair+'</h3><small>FUNDAMENTAL BIAS · '+(p.bias==='BULLISH'?'BASE STRONGER':p.bias==='BEARISH'?'QUOTE STRONGER':'RELATIVE MACRO READ')+'</small></div><div class="bias-status"><b>'+p.bias+'</b><small>spread '+(p.s==null?'N/A':p.s.toFixed(2))+'</small></div></div><div class="bias-card-body">'+momentumPanel+'<div class="bias-label">MAIN DRIVERS</div><div class="driver-wrap">'+biasDrivers(p.b,'BASE')+' '+biasDrivers(p.q,'QUOTE')+'</div><p class="bias-scoreline">'+p.b.code+' '+safeText(p.b.short_term_score,'N/A')+' vs '+p.q.code+' '+safeText(p.q.short_term_score,'N/A')+' · short-term scores</p>'+recentScoreChangeAlert([p.b,p.q])+'<div class="bias-label">HOW LONG IT IS VALID</div><p>Reassess at the next scheduled release: <b>'+when+'</b>. If no release is scheduled, reassess after the next verified high-impact event.</p><div class="bias-label">INVALIDATION CONDITIONS</div><p>Reassess if '+p.b.code+' fundamentals deteriorate, '+p.q.code+' fundamentals improve, or the spread returns inside ±0.35. Missing scores are not a signal.</p><div class="bias-label">TECHNICAL SETUP TO WAIT FOR</div><p>Wait for D1 structure to agree and an H4 pullback/retest or breakout retest in the same direction. Enter only after confirmation.</p></div><div class="bias-card-foot"><span class="tag tag-neutral">● '+(p.s==null?'SCORES NEEDED':'SCORES')+'</span><button class="text-button" data-tech-pair="'+p.pair+'">Open entry gate ↗</button></div></article>';}).join('')||'<div class="empty">No pairs match this filter.</div>';
 document.querySelectorAll('[data-tech-pair]').forEach(b=>b.addEventListener('click',()=>{$('tech-pair').value=b.dataset.techPair;renderTechLock();navigate('technical');}));
 const pick=$('tech-pair');if(pick&&!pick.dataset.ready){pick.innerHTML='<option value="">Select a pair…</option>'+pairs.map(p=>'<option value="'+p.pair+'">'+p.pair+'</option>').join('');pick.dataset.ready='1';}
}
function renderTechLock(){const pair=$('tech-pair')?.value;if(!pair){$('tech-bias-lock').innerHTML='<div class="empty">Select a pair to load its fundamental bias.</div>';return;}const [b,q]=pair.split('/'),m=ccyMap(),s=Number(m[b]?.short_term_score)-Number(m[q]?.short_term_score),bias=s>.35?'BULLISH':s<-.35?'BEARISH':'NEUTRAL';$('tech-lock-tag').textContent=pair+' · '+bias;$('tech-bias-lock').innerHTML='<div class="tech-lock-line"><b>'+pair+' · '+bias+'</b><span>Locked spread '+(Number.isFinite(s)?s.toFixed(2):'N/A')+'</span></div>';}
function renderWorkflow(){
const steps=[['Trading Workflow','Start here · follow each decision gate','workflow'],['Overview','Review macro snapshot and feed health','overview'],['Pair Bias','Identify the strongest relative currency spread','bias'],['AI Momentum Review','Interpret the latest news and data-release momentum','ai-review'],['Central Bank Intelligence','Review policy direction and bank communication','centralbank'],['Currency Strength','Compare structural scores and event momentum','currencies'],['Event Risk','Check upcoming high-impact releases','calendar'],['Technical Entry','Confirm D1 direction and H4 entry structure','technical'],['Risk Management','Calculate position size and protect capital','risk']];
$('workflow-steps').innerHTML=steps.map(s=>'<button class="workflow-step" data-go="'+s[2]+'"><span><b>'+s[0]+'</b><small>'+s[1]+'</small></span><span class="step-arrow">↗</span></button>').join('');
const checks=['Both currencies have verified scores','Relative pair spread supports a directional bias','Central-bank policy assessment reviewed','Recent currency score changes reviewed','No conflicting high-impact release imminent','D1 trend agrees with fundamental bias','H4 entry setup confirmed','Stop loss, target and position risk defined'];let saved=[];try{saved=JSON.parse(localStorage.getItem('macropulse-pretrade')||'[]')}catch{};$('pretrade-checklist').innerHTML=checks.map((c,i)=>'<label class="check-row"><input type="checkbox" data-check="'+i+'" '+(saved.includes(i)?'checked':'')+'><span>'+c+'</span></label>').join('');
const count=()=>{$('checklist-count').textContent=document.querySelectorAll('[data-check]:checked').length+' / 8'};document.querySelectorAll('[data-check]').forEach(x=>x.addEventListener('change',()=>{localStorage.setItem('macropulse-pretrade',JSON.stringify([...document.querySelectorAll('[data-check]:checked')].map(v=>+v.dataset.check)));count()}));count();document.querySelectorAll('[data-go]').forEach(b=>{if(!b.dataset.bound){b.dataset.bound='1';b.addEventListener('click',()=>navigate(b.dataset.go));}});}
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
  $("pair-table").innerHTML=`<div class="pair-toolbar"><div><b id="pair-selected-count">${selected.length} pairs selected</b><small>Your selections are saved in this browser only.</small></div><div class="pair-toolbar-actions"><label class="pair-filter"><input type="checkbox" id="pair-selected-filter"> Show selected only</label><button type="button" class="text-button" id="pair-clear-selection">Clear selection</button></div></div><div class="table-wrap"><table class="pair-select-table"><thead><tr><th>Select</th><th>Pair</th><th>Relative score spread</th><th>Directional read</th><th>Fundamental research</th></tr></thead><tbody>${pairs.map(p=>`<tr data-pair-row="${p.pair}"><td><input class="pair-pick" type="checkbox" value="${p.pair}" aria-label="Select ${p.pair}" ${selected.includes(p.pair)?"checked":""}></td><td>${p.pair}</td><td><strong class="${hasRecentScoreUpdate(byCode[p.pair.split("/")[0]])||hasRecentScoreUpdate(byCode[p.pair.split("/")[1]])?"pair-score-recent":""}">${p.spread===null?"N/A":(p.spread>0?"+":"")+p.spread.toFixed(2)}</strong><small class="pair-score-history">${pairScoreHistory(byCode[p.pair.split("/")[0]])}<span class="pair-score-separator"> · </span>${pairScoreHistory(byCode[p.pair.split("/")[1]])}</small>${recentScoreChangeAlert([byCode[p.pair.split("/")[0]],byCode[p.pair.split("/")[1]]])}</td><td>${p.spread===null?"No verified score":p.spread>0.35?"Base stronger":p.spread< -0.35?"Quote stronger":"Close / neutral"}</td><td>${pairResearchLink(p.pair)}</td></tr>`).join("")}</tbody></table></div><div class="notice"><b>My selected pairs</b><p id="pair-selection-summary">${selected.length?selected.join(" · "):"Tick the box beside any pair you want to monitor. Your shortlist will remain saved on this device and browser."}</p></div><div class="notice"><b>Pair Intelligence</b><p>Open any of the 28 standardised currency pairs for a currency-by-currency macro comparison, geopolitical and commodity sensitivities, latest dashboard news, and bullish/bearish scenario checklist. Research pages are separate from the provisional score ranking.</p></div>`;
  const updateSelection=()=>{const picks=[...document.querySelectorAll(".pair-pick:checked")].map(x=>x.value);saveSelectedPairs(picks);$("pair-selected-count").textContent=picks.length+" pairs selected";$("pair-selection-summary").textContent=picks.length?picks.join(" · "):"Tick the box beside any pair you want to monitor. Your shortlist will remain saved on this device and browser.";};
  document.querySelectorAll(".pair-pick").forEach(box=>box.addEventListener("change",()=>{updateSelection();applyPairFilter();}));
  const filter=$("pair-selected-filter");filter.addEventListener("change",applyPairFilter);
  $("pair-clear-selection").addEventListener("click",()=>{document.querySelectorAll(".pair-pick").forEach(x=>x.checked=false);saveSelectedPairs([]);updateSelection();applyPairFilter();});
  function applyPairFilter(){const only=filter.checked;document.querySelectorAll("[data-pair-row]").forEach(row=>{row.hidden=only&&!row.querySelector(".pair-pick").checked;});}
}function releaseDateSgt(value) {
  if (!value) return "Date not verified";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? safeText(value) : d.toLocaleString("en-SG",{timeZone:"Asia/Singapore",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false})+" SGT";
}
function releaseTrackerRows(filter="ALL") {
  const rows=[];
  for (const c of (snapshot?.currencies||[])) {
    if (filter!=="ALL" && c.code!==filter) continue;
    for (const r of (c.release_tracker||[])) {
      const change=r.change;
      const changeText=change===null||change===undefined?"—":(change>0?"+":"")+Number(change).toFixed(2)+(r.key==="policy_rate"?" pp":" pp");
      const changeClass=change===null||change===undefined?"score-na":change>0?"score-positive":change<0?"score-negative":"score-na";
      const status=r.status==="new_release"?'<span class="release-new">NEW RELEASE</span>':r.status==="official_data"?'<span class="release-new">SOURCE VERIFIED</span>':r.status==="no_verified_release"?'<span class="score-na">Awaiting verified release</span>':'<span class="score-na">Last known reading</span>';
      const link=r.url?'<a href="'+escapeHtml(r.url)+'" target="_blank" rel="noopener noreferrer">Open ↗</a>':"—";
      rows.push('<tr><td>'+safeText(c.code)+'</td><td>'+safeText(r.label)+'</td><td>'+releaseDateSgt(r.release_time||r.release_date)+'</td><td>'+safeText(r.actual)+'</td><td>'+safeText(r.previous)+'</td><td class="'+changeClass+'">'+changeText+'</td><td>'+status+'</td><td>'+link+'</td></tr>');
    }
  }
  $("release-tracker-rows").innerHTML=rows.length?rows.join(""):'<tr><td colspan="8" class="empty">No verified release records available for this selection.</td></tr>';
}
function renderReleaseTracker(){ const filter=$("release-currency-filter"); if(filter) releaseTrackerRows(filter.value); }

function renderSources() {
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
    try { const aiResponse=await fetch('data/ai_review.json?ts='+Date.now(),{cache:'no-store'}); aiReview=aiResponse.ok?await aiResponse.json():null; } catch(_aiError) { aiReview=null; }
    setupStrengthCurrencyFilter();
    renderOverviewCoreRows(); renderCurrencyStrengthRows();
    renderNews("overview-news","ALL",5); renderNews("news-list",$("news-filter").value); renderNews("calendar-list","ALL",100);
    renderPairs(); renderBiasCards(); renderAIReview(); renderWorkflow(); renderSources(); renderReleaseTracker();
    $("metric-news").textContent=data.events.length;
    const ok=(data.sources||[]).filter(s=>s.status==="ok").length;
    const macro=(data.sources||[]).filter(s=>(String(s.name||"").includes("World Bank") || String(s.name||"").includes("OECD")));
    const macroOk=macro.filter(s=>s.status==="ok"||s.status==="partial").length;
    $("metric-feeds").textContent=`${ok}/${(data.sources||[]).length}`;
    const builtSgt=data.generated_at?new Date(data.generated_at).toLocaleString("en-SG",{timeZone:"Asia/Singapore",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}):"Time unavailable"; $("updated-at").textContent=`Data snapshot updated ${builtSgt} SGT`;
    $("footer-model").textContent=`Snapshot model: ${safeText(data.model)}`;
    const isStale=!data.generated_at || Date.now()-new Date(data.generated_at).getTime()>8*3600*1000;
    setStatus(!isStale && ok>0, isStale ? "Snapshot is stale or awaiting build" : `${ok} news feeds responding · ${macroOk}/${macro.length} macro sources available`);
  } catch(error) {
    setStatus(false,`Unable to load data snapshot: ${error.message}`);
    $("updated-at").textContent="Check GitHub Pages deployment and data/latest.json";
    $("currency-rows").innerHTML=`<tr><td colspan="9" class="empty">Core data unavailable. ${error.message}</td></tr>`; $("currency-rows-full").innerHTML=`<tr><td colspan="4" class="empty">Currency analysis unavailable until the shared snapshot loads.</td></tr>`;
  } finally { $("refresh-btn").disabled=false; $("refresh-btn").textContent="↻ Refresh"; }
}
const titles={workflow:"Trading Workflow",overview:"Overview",currencies:"Currency Strength",bias:"Pair Bias","ai-review":"AI Momentum Review",centralbank:"Central Bank Intelligence",pairs:"Pair Universe",technical:"Technical Entry",risk:"Risk Management",swap:"Swap Intelligence",news:"News Intelligence",calendar:"Event Risk",positioning:"CFTC Positioning",journal:"Trading Journal"};
function navigate(view) {
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("page-title").textContent=titles[view]||"Market overview";
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
$("bias-sort")?.addEventListener("change",renderBiasCards);$("tech-pair")?.addEventListener("change",renderTechLock);
$("tech-evaluate")?.addEventListener("click",()=>{const p=$("tech-pair").value,d1=$("tech-d1").value,h4=$("tech-h4").value,setup=$("tech-setup").value,e=+$("tech-entry").value,s=+$("tech-stop").value,t=+$("tech-target").value;if(!p||!d1||!h4||!setup||!e||!s||!t){$("tech-output").innerHTML="<div class=\"notice notice-warn\"><b>WAIT · Inputs incomplete</b><p>Complete pair, D1/H4 structure and price levels.</p></div>";return;}const [b,q]=p.split("/"),m=ccyMap(),sp=Number(m[b]?.short_term_score)-Number(m[q]?.short_term_score),dir=sp>.35?"long":sp<-.35?"short":"none",aligned=dir==="long"?d1==="up"&&h4==="up":dir==="short"?d1==="down"&&h4==="down":false,rr=Math.abs(t-e)/Math.abs(e-s),stopOK=dir==="long"?s<e:dir==="short"?s>e:false,ok=aligned&&setup!=="none"&&rr>=2&&stopOK;$("tech-output").innerHTML="<div class=\"notice "+(ok?"":"notice-warn")+"\"><b>"+(ok?"CONFIRMED":"WAIT / VETO")+"</b><p>Fundamental direction: "+dir.toUpperCase()+". D1/H4 aligned: "+aligned+". Risk/reward: "+rr.toFixed(2)+"R. Stop side valid: "+stopOK+".</p></div>";});
$("tech-reset")?.addEventListener("click",()=>{["tech-d1","tech-h4","tech-setup","tech-level","tech-atr","tech-entry","tech-stop","tech-target"].forEach(id=>$(id).value="");$("tech-output").innerHTML="<div class=\"empty\">Inputs reset.</div>";});
$("risk-calc")?.addEventListener("click",()=>{const bal=+$("risk-account").value,pct=+$("risk-pct").value,e=+$("risk-entry").value,s=+$("risk-stop").value,pip=+$("risk-pip").value,pv=+$("risk-pipvalue").value;if(!(bal>0&&pct>0&&pct<=5&&e>0&&s>0&&e!==s&&pip>0&&pv>0)){$("risk-output").innerHTML="<div class=\"notice notice-warn\"><b>Check inputs</b><p>Enter valid balance, risk, entry, stop, pip size and pip value.</p></div>";return;}const cash=bal*pct/100,pips=Math.abs(e-s)/pip,lots=cash/(pips*pv);$("risk-output").innerHTML="<div class=\"panel\"><div class=\"panel-head\"><b>Position size estimate</b></div><div class=\"risk-result-grid\"><div><small>MAX CASH RISK</small><b>"+cash.toFixed(2)+"</b></div><div><small>STOP DISTANCE</small><b>"+pips.toFixed(1)+" pips</b></div><div><small>EST. LOT SIZE</small><b>"+lots.toFixed(3)+" lots</b></div></div></div>";});
$("refresh-btn").addEventListener("click",loadSnapshot);
$("news-filter").addEventListener("change",()=>renderNews("news-list",$("news-filter").value));
$("release-currency-filter")?.addEventListener("change",renderReleaseTracker);
function setupThemeSelector(){
  const select=$("theme-select");
  if(!select)return;
  const allowed=["white","grey","dark"];
  let saved="dark";
  try{const value=localStorage.getItem("macropulse-theme");if(allowed.includes(value))saved=value;}catch(_){}
  document.documentElement.dataset.theme=saved;
  select.value=saved;
  select.addEventListener("change",()=>{
    const value=allowed.includes(select.value)?select.value:"dark";
    document.documentElement.dataset.theme=value;
    try{localStorage.setItem("macropulse-theme",value);}catch(_){}
  });
}
function clock(){ $("clock").textContent=new Date().toLocaleTimeString("en-SG",{timeZone:"Asia/Singapore",hour12:false})+" SGT"; }
setupThemeSelector(); clock(); setInterval(clock,1000); loadSnapshot(); setInterval(loadSnapshot,5*60*1000);

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
