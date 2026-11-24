/**
 * MacroPulse V6 secure GitHub Actions dispatcher.
 * Cloudflare secrets: GITHUB_TOKEN, WORKER_PIN
 * Variable: ALLOWED_ORIGIN = https://winner99099.github.io
 */
const OWNER="Winner99099", REPO="fx-fundamental-dashboard", WORKFLOW="ai-review.yml", BRANCH="main";
function cors(origin,env){const allowed=env.ALLOWED_ORIGIN||"https://winner99099.github.io";return origin===allowed?{"Access-Control-Allow-Origin":allowed,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"}:{};}
function json(data,status,headers={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...headers}});}
export default {async fetch(request,env){
 const origin=request.headers.get("Origin")||"",headers=cors(origin,env),allowed=env.ALLOWED_ORIGIN||"https://winner99099.github.io";
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(origin!==allowed)return json({error:"Origin not allowed"},403,headers);
 if(new URL(request.url).pathname!=="/run"||request.method!=="POST")return json({error:"Not found"},404,headers);
 let body;try{body=await request.json();}catch{return json({error:"Invalid JSON body"},400,headers);}
 if(!env.GITHUB_TOKEN||!env.WORKER_PIN)return json({error:"Worker secrets are not configured"},500,headers);
 if(typeof body.pin!=="string"||body.pin!==env.WORKER_PIN)return json({error:"Incorrect access PIN"},401,headers);
 const allowedPairs=new Set(["EUR/GBP","EUR/AUD","EUR/NZD","EUR/USD","EUR/CAD","EUR/CHF","EUR/JPY","GBP/AUD","GBP/NZD","GBP/USD","GBP/CAD","GBP/CHF","GBP/JPY","AUD/NZD","AUD/USD","AUD/CAD","AUD/CHF","AUD/JPY","NZD/USD","NZD/CAD","NZD/CHF","NZD/JPY","USD/CAD","USD/CHF","USD/JPY","CAD/CHF","CAD/JPY","CHF/JPY"]);
 const pairs=Array.isArray(body.pairs)?[...new Set(body.pairs)]:[];
 if(pairs.length>28||pairs.some(p=>!allowedPairs.has(p)))return json({error:"Invalid currency pair selection"},400,headers);
 const validCurrencies=new Set(["USD","EUR","GBP","JPY","CHF","CAD","AUD","NZD"]);
 let currencies=Array.isArray(body.currencies)?[...new Set(body.currencies)]:[];
 if(!currencies.length&&pairs.length)currencies=[...new Set(pairs.flatMap(p=>p.split("/")))];
 if(!currencies.length||currencies.length>8||currencies.some(c=>!validCurrencies.has(c)))return json({error:"Select at least one valid currency"},400,headers);
 const url="https://api.github.com/repos/"+OWNER+"/"+REPO+"/actions/workflows/"+WORKFLOW+"/dispatches";
 const response=await fetch(url,{method:"POST",headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+env.GITHUB_TOKEN,"X-GitHub-Api-Version":"2022-11-28","User-Agent":"MacroPulse-AI-Review-Worker","Content-Type":"application/json"},body:JSON.stringify({ref:BRANCH,inputs:{pairs:pairs.join(","),currencies:currencies.join(","),force:"true"}})});
 if(!response.ok)return json({error:"GitHub workflow dispatch failed ("+response.status+"): "+(await response.text()).slice(0,500)},502,headers);
 return json({accepted:true,currencies,pairs},202,headers);
}};
