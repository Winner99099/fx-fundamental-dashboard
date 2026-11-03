// 8-Currency Fundamental FX Dashboard - Scoring Engine with Geopolitical News Override
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'NZD', 'CAD', 'CHF', 'JPY'];

// Core macroeconomic raw baseline statistics
const defaultMacroData = {
    USD: { rate: 4.75, cpi: 2.7, gdp: 2.6, unemp: 4.1 },
    EUR: { rate: 3.25, cpi: 2.1, gdp: 0.9, unemp: 6.3 },
    GBP: { rate: 4.75, cpi: 3.2, gdp: 1.0, unemp: 4.3 },
    AUD: { rate: 4.35, cpi: 2.8, gdp: 1.5, unemp: 4.1 },
    NZD: { rate: 4.25, cpi: 2.2, gdp: -0.2, unemp: 4.8 },
    CAD: { rate: 3.75, cpi: 1.6, gdp: 1.2, unemp: 6.5 },
    CHF: { rate: 1.00, cpi: 0.6, gdp: 1.4, unemp: 2.5 },
    JPY: { rate: 0.25, cpi: 2.1, gdp: 0.5, unemp: 2.4 }
};

// Real-world geopolitical risk factors mapped to currencies (e.g., BBC / Reuters tracking)
const globalNewsOverrides = {
    EUR: { 
        penalty: -1.5, 
        headline: "BBC: Severe anti-cost-of-living riots & public service strikes expand across France and Italy, widening sovereign bond yield spreads.",
        type: "BEARISH RISK"
    },
    USD: { 
        penalty: 0.5, 
        headline: "Reuters: Safe-haven demand increases capital inflows into the greenback amid regional European fiscal uncertainties.",
        type: "BULLISH BIAS"
    },
    GBP: {
        penalty: -0.5,
        headline: "Financial Times: Regional European unrest ripples slightly into British banking stock sentiment.",
        type: "NEUTRAL DRAG"
    }
};

function calculateScores(macroData) {
    let scores = {};
    const rates = Object.values(macroData).map(d => d.rate);
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;

    for (const currency of CURRENCIES) {
        const stats = macroData[currency];
        let score = 0;
        let reasons = [];

        // Rule 1: Interest Rate Discrepancy
        if (stats.rate > avgRate + 1) {
            score += 1.5;
            reasons.push("Yield Advantage");
        } else if (stats.rate < 1.5) {
            score -= 1.5;
            reasons.push("Low Yield Drag");
        } else {
            score += 0.5;
        }

        // Rule 2: GDP Economic Expansion Status
        if (stats.gdp > 2.0) {
            score += 1.0;
            reasons.push("Robust Expansion");
        } else if (stats.gdp < 0) {
            score -= 1.5;
            reasons.push("Recession Risk");
        }

        // Rule 3: Inflation Drift (Central Bank Target is 2.0%)
        if (stats.cpi > 3.0) {
            score -= 0.5;
            reasons.push("Stubborn Inflation");
        } else {
            score += 0.5;
        }

        // Rule 4: Unemployment / Labor Slack
        if (stats.unemp > 6.0) {
            score -= 0.5;
            reasons.push("Labor Weakness");
        }

        // Rule 5: Dynamic Geopolitical News Overrides (Protests, Riots, Tariffs)
        if (globalNewsOverrides[currency]) {
            score += globalNewsOverrides[currency].penalty;
            reasons.push(`Geopolitical: ${globalNewsOverrides[currency].type}`);
        }

        // Enforce boundary caps
        const finalScore = Math.max(-5, Math.min(5, score));
        let bias = "NEUTRAL";
        if (finalScore >= 1.0) bias = "BULLISH";
        if (finalScore <= -1.0) bias = "BEARISH";

        scores[currency] = {
            score: finalScore.toFixed(1),
            bias: bias,
            reasons: reasons.join(", "),
            ...stats
        };
    }
    return scores;
}

function renderDashboard(scoredData) {
    const tableBody = document.getElementById('currency-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const sortedCurrencies = Object.keys(scoredData).sort((a, b) => scoredData[b].score - scoredData[a].score);

    sortedCurrencies.forEach(curr => {
        const item = scoredData[curr];
        let badgeStyle = 'bg-gray-100 text-gray-800';
        if (item.bias === 'BULLISH') badgeStyle = 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300';
        if (item.bias === 'BEARISH') badgeStyle = 'bg-rose-100 text-rose-800 font-bold border border-rose-300';

        const row = `
            <tr class="border-b border-gray-200 hover:bg-slate-50 transition-colors text-center text-sm">
                <td class="p-4 font-black text-slate-900 text-left text-base">${curr}</td>
                <td class="p-4"><span class="px-2.5 py-1 rounded text-xs tracking-wide uppercase ${badgeStyle}">${item.bias} (${item.score})</span></td>
                <td class="p-4 font-semibold text-slate-700">${item.rate.toFixed(2)}%</td>
                <td class="p-4 text-slate-600">${item.cpi.toFixed(1)}%</td>
                <td class="p-4 text-slate-600">${item.gdp.toFixed(1)}%</td>
                <td class="p-4 text-slate-600">${item.unemp.toFixed(1)}%</td>
                <td class="p-4 text-left text-xs font-medium text-slate-500">${item.reasons}</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });

    renderNewsTicker();
    renderPairMatrix(scoredData);
}

function renderNewsTicker() {
    const newsContainer = document.getElementById('news-feed-container');
    if (!newsContainer) return;
    newsContainer.innerHTML = '';

    let newsHtml = '<div class="space-y-3">';
    Object.keys(globalNewsOverrides).forEach(curr => {
        const entry = globalNewsOverrides[curr];
        const labelColor = entry.penalty < 0 ? 'bg-rose-500' : 'bg-emerald-500';
        newsHtml += `
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start space-x-3 shadow-xs">
                <span class="text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-0.5 ${labelColor}">${curr} IMPACT</span>
                <div class="flex-1">
                    <p class="text-xs font-semibold text-slate-800">${entry.headline}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">Scoring Engine Impact Weight: <span class="font-bold">${entry.penalty > 0 ? '+' : ''}${entry.penalty} points</span></p>
                </div>
            </div>
        `;
    });
    newsHtml += '</div>';
    newsContainer.innerHTML = newsHtml;
}

function renderPairMatrix(scoredData) {
    const matrixContainer = document.getElementById('pair-rankings-container');
    if (!matrixContainer) return;
    matrixContainer.innerHTML = '';

    let pairs = [];
    for (let i = 0; i < CURRENCIES.length; i++) {
        for (let j = 0; j < CURRENCIES.length; j++) {
            if (i !== j) {
                const base = CURRENCIES[i];
                const quote = CURRENCIES[j];
                const divergence = scoredData[base].score - scoredData[quote].score;
                pairs.push({ pair: `${base}/${quote}`, spread: divergence });
            }
        }
    }

    pairs.sort((a, b) => b.spread - a.spread);

    const topBuys = pairs.slice(0, 4);
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">';
    
    html += '<div><h4 class="font-bold text-sm uppercase tracking-wider text-emerald-700 mb-3 flex items-center">📈 Top Long Opportunities</h4><div class="space-y-2">';
    topBuys.forEach(p => {
        html += `<div class="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg flex justify-between items-center">
            <span class="font-bold text-slate-800 text-sm">${p.pair}</span>
            <span class="text-xs bg-emerald-600 text-white font-bold px-2 py-0.5 rounded shadow-xs">+${p.spread.toFixed(1)} spread</span>
        </div>`;
    });
    html += '</div></div>';

    const topSells = pairs.slice(-4).reverse();
    html += '<div><h4 class="font-bold text-sm uppercase tracking-wider text-rose-700 mb-3 flex items-center">📉 Top Short Opportunities</h4><div class="space-y-2">';
    topSells.forEach(p => {
        html += `<div class="p-3 bg-rose-50/60 border border-rose-200 rounded-lg flex justify-between items-center">
            <span class="font-bold text-slate-800 text-sm">${p.pair}</span>
            <span class="text-xs bg-rose-600 text-white font-bold px-2 py-0.5 rounded shadow-xs">${p.spread.toFixed(1)} spread</span>
        </div>`;
    });
    html += '</div></div></div>';

    matrixContainer.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    const scored = calculateScores(defaultMacroData);
    renderDashboard(scored);
});
