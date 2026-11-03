// 8-Currency Fundamental FX Dashboard Engine
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'NZD', 'CAD', 'CHF', 'JPY'];

// Core macroeconomic raw baseline institutional statistics
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

// Global sentiment adjustments (BBC News Alerts Integration Matrix)
const globalNewsOverrides = {
    EUR: { 
        penalty: -1.5, 
        headline: "BBC Alert: Extensive Eurozone cost-of-living riots and civil strikes across major capitals expand risk premiums and strain fiscal stability.",
        type: "CRITICAL RISK"
    },
    USD: { 
        penalty: 0.5, 
        headline: "Reuters News: Institutional safe-haven capital routing shifts to USD amid lingering Western European sovereign debt anxieties.",
        type: "BULLISH BIAS"
    },
    GBP: {
        penalty: -0.5,
        headline: "FT News: Continental European civil unrest slightly pressures cross-channel financial asset values and equity confidence indexes.",
        type: "RISK DRAG"
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

        // Yield Rate Attribution Rules
        if (stats.rate > avgRate + 1) {
            score += 1.5;
            reasons.push("Yield Advantage");
        } else if (stats.rate < 1.5) {
            score -= 1.5;
            reasons.push("Low Yield Drag");
        } else {
            score += 0.5;
        }

        // GDP Output Rules
        if (stats.gdp > 2.0) {
            score += 1.0;
            reasons.push("Robust Growth");
        } else if (stats.gdp < 0) {
            score -= 1.5;
            reasons.push("Recession Shock");
        }

        // Inflation Tracking Rules
        if (stats.cpi > 3.0) {
            score -= 0.5;
            reasons.push("Sticky Inflation");
        } else {
            score += 0.5;
        }

        // Employment Market Slack
        if (stats.unemp > 6.0) {
            score -= 0.5;
            reasons.push("Labor Slack");
        }

        // Geopolitical Overrides Mapped
        if (globalNewsOverrides[currency]) {
            score += globalNewsOverrides[currency].penalty;
            reasons.push(`Geopolitical ${globalNewsOverrides[currency].type}`);
        }

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
        
        let badgeStyle = 'bg-slate-50 text-slate-600 border border-slate-200';
        if (item.bias === 'BULLISH') badgeStyle = 'bg-emerald-50/70 text-emerald-700 font-bold border border-emerald-200';
        if (item.bias === 'BEARISH') badgeStyle = 'bg-rose-50/70 text-rose-700 font-bold border border-rose-200';

        const row = `
            <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors text-center text-xs font-medium">
                <td class="p-3.5 font-bold text-slate-900 text-left text-sm tracking-tight">${curr}</td>
                <td class="p-3.5"><span class="px-2 py-0.5 rounded tracking-wide text-[10px] font-bold uppercase ${badgeStyle}">${item.bias} (${item.score > 0 ? '+' : ''}${item.score})</span></td>
                <td class="p-3.5 mono text-slate-700 font-semibold">${item.rate.toFixed(2)}%</td>
                <td class="p-3.5 mono text-slate-600">${item.cpi.toFixed(1)}%</td>
                <td class="p-3.5 mono text-slate-600">${item.gdp.toFixed(1)}%</td>
                <td class="p-3.5 mono text-slate-600">${item.unemp.toFixed(1)}%</td>
                <td class="p-3.5 text-left text-[11px] font-medium text-slate-400 tracking-tight">${item.reasons}</td>
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

    let newsHtml = '<div class="space-y-3.5">';
    Object.keys(globalNewsOverrides).forEach(curr => {
        const entry = globalNewsOverrides[curr];
        const statusColors = entry.penalty < 0 
            ? 'bg-rose-50 text-rose-700 border-rose-200 tag-danger' 
            : 'bg-emerald-50 text-emerald-700 border-emerald-200 tag-success';
        const labelBadge = entry.penalty < 0 ? 'bg-rose-600' : 'bg-emerald-600';

        newsHtml += `
            <div class="p-3.5 bg-white rounded-xl border border-slate-100 shadow-2xs flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <span class="text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${labelBadge}">${curr} DATA FEED</span>
                    <span class="mono text-[10px] font-bold text-slate-400">${entry.penalty > 0 ? '+' : ''}${entry.penalty.toFixed(1)} Weight Adjustment</span>
                </div>
                <p class="text-xs font-semibold text-slate-700 leading-normal">${entry.headline}</p>
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
    
    html += '<div><h4 class="font-bold text-[10px] tracking-wider uppercase text-emerald-600 mb-3">📈 High-Alpha Long Pairs (Strength Mismatch)</h4><div class="space-y-2">';
    topBuys.forEach(p => {
        html += `<div class="p-3 bg-slate-50 border border-slate-200/60 rounded-xl flex justify-between items-center transition-all hover:bg-white shadow-2xs">
            <span class="font-extrabold text-slate-800 text-xs mono tracking-tight">${p.pair}</span>
            <span class="mono text-xs text-emerald-600 font-bold px-2 py-0.5 bg-emerald-50 rounded border border-emerald-100">+${p.spread.toFixed(1)}</span>
        </div>`;
    });
    html += '</div></div>';

    const topSells = pairs.slice(-4).reverse();
    html += '<div><h4 class="font-bold text-[10px] tracking-wider uppercase text-rose-600 mb-3">📉 Underperforming Short Pairs (Weakness Target)</h4><div class="space-y-2">';
    topSells.forEach(p => {
        html += `<div class="p-3 bg-slate-50 border border-slate-200/60 rounded-xl flex justify-between items-center transition-all hover:bg-white shadow-2xs">
            <span class="font-extrabold text-slate-800 text-xs mono tracking-tight">${p.pair}</span>
            <span class="mono text-xs text-rose-600 font-bold px-2 py-0.5 bg-rose-50 rounded border border-rose-100">${p.spread.toFixed(1)}</span>
        </div>`;
    });
    html += '</div></div></div>';

    matrixContainer.innerHTML = html;
}

// Guaranteed layout execution wrapper
function initializeDashboard() {
    const scored = calculateScores(defaultMacroData);
    renderDashboard(scored);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    initializeDashboard();
}
