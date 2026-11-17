const SWAP_KEY="macropulse-swap-latest-v1";
function parseSwapCsv(src){
 const out=[];let row=[],cell="",q=false;
 for(let i=0;i<src.length;i++){const c=src[i],n=src[i+1];if(c==='"'&&q&&n==='"'){cell+='"';i++;}else if(c==='"')q=!q;else if(c===','&&!q){row.push(cell);cell="";}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(x=>x!==""))out.push(row);row=[];cell="";}else cell+=c;}
 row.push(cell);if(row.some(x=>x!==""))out.push(row);return out;
}
function readSwapStore(){try{return JSON.parse(localStorage.getItem(SWAP_KEY)||"[]");}catch(e){return[];}}
function escSwap(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function swapModeLabel(platform,value){const n=Number(value);const m4={0:"Points",1:"Base currency",2:"Interest",3:"Margin currency"};const m5={0:"Disabled",1:"Points",2:"Symbol currency",3:"Margin currency",4:"Deposit currency",5:"Interest (current)",6:"Interest (open)",7:"Reopen (current)",8:"Reopen (bid)"};const label=(platform==="MT4"?m4:m5)[n];return label===undefined?String(value):String(value)+" · "+label;}
function renderSwapTable(){
 const all=readSwapStore(),latest={};
 all.forEach(r=>{const k=(r.broker||"")+"|"+(r.platform||"")+"|"+(r.symbol||"");if(!latest[k]||String(r.captured_local)>String(latest[k].captured_local))latest[k]=r;});
 const broker=document.getElementById("swap-broker-filter")?.value||"ALL";
 const rows=Object.values(latest).filter(r=>broker==="ALL"||r.broker===broker).sort((a,b)=>String(a.broker).localeCompare(String(b.broker))||String(a.symbol).localeCompare(String(b.symbol)));
 const body=document.getElementById("swap-rows");if(!body)return;
 body.innerHTML=rows.length?rows.map(r=>"<tr><td>"+escSwap(r.broker)+"</td><td>"+escSwap(r.platform)+"</td><td>"+escSwap(r.symbol)+"</td><td class='swap-positive'>"+escSwap(r.swap_long)+"</td><td class='swap-negative'>"+escSwap(r.swap_short)+"</td><td>"+escSwap(r.swap_mode)+"</td><td>"+escSwap(r.contract_size)+"</td><td>"+escSwap(r.account_currency)+"</td><td>"+escSwap(r.captured_local)+"</td></tr>").join(""):"<tr><td colspan='9' class='empty'>No imported snapshots yet. Install the broker EA, then import its CSV here.</td></tr>";
 document.getElementById("swap-count").textContent=rows.length+" current symbols · "+all.length+" imported records";
 const latestTime=rows.reduce((a,b)=>String(a.captured_local)>String(b.captured_local)?a:b,null);
 document.getElementById("swap-updated").textContent=latestTime?"Latest capture: "+latestTime.captured_local:"Awaiting first import";
}
async function importSwapCsv(file){
 const parsed=parseSwapCsv(await file.text());if(parsed.length<2)throw new Error("CSV contains no data rows");
 const headers=parsed[0].map(x=>x.trim());const incoming=parsed.slice(1).map(line=>Object.fromEntries(headers.map((h,i)=>[h,(line[i]||"").trim()])));
 const valid=incoming.filter(r=>r.symbol&&r.swap_long!==undefined&&r.swap_short!==undefined);
 if(!valid.length)throw new Error("File does not contain recognised MacroPulseFX swap columns");
 const map=new Map(readSwapStore().map(r=>[(r.broker||"")+"|"+(r.platform||"")+"|"+r.symbol+"|"+(r.captured_local||""),r]));
 valid.forEach(r=>map.set((r.broker||"")+"|"+(r.platform||"")+"|"+r.symbol+"|"+(r.captured_local||""),r));
 localStorage.setItem(SWAP_KEY,JSON.stringify(Array.from(map.values()).slice(-15000)));
 renderSwapTable();document.getElementById("swap-import-status").textContent="Imported "+valid.length+" rows from "+file.name+". Saved locally in this browser.";
}
document.addEventListener("DOMContentLoaded",()=>{
 const input=document.getElementById("swap-file");
 if(input)input.addEventListener("change",async()=>{const f=input.files&&input.files[0];if(!f)return;try{await importSwapCsv(f);}catch(e){document.getElementById("swap-import-status").textContent="Import failed: "+e.message;}input.value="";});
 document.getElementById("swap-broker-filter")?.addEventListener("change",renderSwapTable);
 document.getElementById("swap-clear")?.addEventListener("click",()=>{if(confirm("Clear imported swap history from this browser?")){localStorage.removeItem(SWAP_KEY);renderSwapTable();document.getElementById("swap-import-status").textContent="Local history cleared."; }});
 renderSwapTable();
});