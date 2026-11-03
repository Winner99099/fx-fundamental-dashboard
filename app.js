// 8-Currency Fundamental FX Dashboard - Scoring Engine
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'NZD', 'CAD', 'CHF', 'JPY'];

// Fallback macro data in case the live API fails temporarily
const defaultMacroData = {
    USD: { rate: 4.75, cpi: 2.4, gdp: 2.8, unemp: 4.1 },
    EUR: { rate: 3.25, cpi: 2.0, gdp: 0.9, unemp: 6.3 },
    GBP: { rate: 4.75, cpi: 2.3, gdp: 1.0, unemp: 4.3 },
    AUD: { rate: 4.35, cpi: 2.8, gdp: 1.5, unemp: 4.1 },
    NZD: { rate: 4.25, cpi: 2.2, gdp: -0.2, unemp: 4.8 },
    CAD: { rate: 3.75, cpi: 1.6, gdp: 1.2, unemp: 6.5 },
    CHF: { rate: 1.00, cpi: 0.6, gdp: 1.4, unemp: 2.5 },
    JPY: { rate: 0.25, cpi: 2.1, gdp: 0.5, unemp: 2.4 }
};

// Calculate fundamental scores based on macro rules
function calculateScores(data) {
    let scores = {};
    
    // Find averages to use as benchmarks
    const rates = Object.values(data).map(d => d.rate);
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;

    for (const currency of CURRENCIES) {
        const stats = data[currency];
        let score = 0;
        let reasons = [];

        // Rule 1: Interest Rate Strength
        if (stats.rate > avgRate + 1) {
            score += 1.5;
            reasons.push("High yield advantage");
        } else if (stats.rate < 1.5) {
            score -= 1.5;
            reasons.push("Low yield drag");
        } else {
            score += 0.5;
        }

        // Rule 2: Economic Growth (GDP)
        if (stats.gdp > 2.0) {
            score += 1.0;
            reasons.push("Strong economic expansion");
        } else if (stats.gdp < 0) {
            score -= 1.5;
            reasons.push("Recession/Contraction risks");
        }

        // Rule 3: Employment Status
        if (stats.unemp > 6.0) {
            score -= 0.5;
            reasons.push("Weak labor market");
        } else if (stats.unemp < 3.5) {
            score += 0.5;
            reasons.push("Tight labor market");
        }

        // Rule 4: Inflation Control (Target is around 2%)
        if (stats.cpi > 4.0) {
            score -= 1.0;
            reasons.push("High inflation erodes value");
        } else if (stats.cpi < 1.0 && stats.cpi > 0) {
            score -= 0.5;
            reasons.push("Deflationary environment");
        } else {
            score += 0.5; // Healthy inflation stability
        }

        // Normalize scores between -5 and +5
        const finalScore = Math.max(-5, Math.min(5, score));
        
        let bias = "NEUTRAL";
        if (finalScore >= 1.5) bias = "BULLISH";
        if (finalScore <= -1.5) bias = "BEARISH";

        scores[currency] = {
            score: finalScore.toFixed(1),
            bias: bias,
            reasons: reasons.join(", ") || "Stable data footprint",
            ...stats
        };
    }
    return scores;
}

// Render data onto your HTML UI
function renderDashboard(scoredData) {
    const tableBody = document.getElementById('currency-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = ''; // Clear old rows

    // Sort currencies by highest fundamental score first
    const sortedCurrencies = Object.keys(scoredData).sort((a, b) => scoredData[b].score - scoredData[a].score);

    sortedCurrencies.forEach(curr => {
        const item = scoredData[curr];
        let biasClass = 'bg-gray-100 text-gray-800';
        if (item.bias === 'BULLISH') biasClass = 'bg-green-100 text-green-800 font-bold';
        if (item.bias === 'BEARISH') biasClass = 'bg-red-100 text-red-800 font-bold';

        const row = `
            <tr class="border-b hover:bg-gray-50 text-center">
                <td class="p-3 font-extrabold text-blue-600">${curr}</td>
                <td class="p-3"><span class="px-2 py-1 rounded ${biasClass}">${item.bias} (${item.score})</span></td>
                <td class="p-3 font-semibold">${item.rate.toFixed(2)}%</td>
                <td class="p-3">${item.cpi.toFixed(1)}%</td>
                <td class="p-3">${item.gdp.toFixed(1)}%</td>
                <td class="p-3">${item.unemp.toFixed(1)}%</td>
                <td class="p-3 text-left text-sm text-gray-600 italic">${item.reasons}</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });

    // Generate Relative Strength Pair Matrix
    renderPairMatrix(scoredData);
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
                // Spread difference calculation
                const netSpread = scoredData[base].score - scoredData[quote].score;
                pairs.push({ pair: `${base}/${quote}`, spread: netSpread });
            }
        }
    }

    // Sort pairs by highest fundamental divergence
    pairs.sort((a, b) => b.spread - a.spread);

    // Take top 5 Strong Pairs and top 5 Weak Pairs
    const topBuys = pairs.slice(0, 5);
    
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
    html += '<div><h4 class="font-bold text-green-700 mb-2">🔥 Top Fundamental Buys (Long Base / Short Quote)</h4><ul>';
    topBuys.forEach(p => {
        html += `<li class="mb-1 p-2 bg-green-50 rounded flex justify-between border-l-4 border-green-500"><strong>${p.pair}</strong> <span class="text-green-700 font-semibold">Divergence: +${p.spread.toFixed(1)}</span></li>`;
    });
    html += '</ul></div>';

    const topSells = pairs.slice(-5).reverse();
    html += '<div><h4 class="font-bold text-red-700 mb-2">📉 Top Fundamental Sells (Short Base / Long Quote)</h4><ul>';
    topSells.forEach(p => {
        html += `<li class="mb-1 p-2 bg-red-50 rounded flex justify-between border-l-4 border-red-500"><strong>${p.pair}</strong> <span class="text-red-700 font-semibold">Divergence: ${p.spread.toFixed(1)}</span></li>`;
    });
    html += '</ul></div></div>';

    matrixContainer.innerHTML = html;
}

// Initial Kickoff
document.addEventListener('DOMContentLoaded', () => {
    // Attempt to pull latest JSON from your GitHub Action automated scraper
    fetch('data/latest.json')
        .then(res => res.json())
        .then(liveData => {
            // If Github actions populated valid data, use it, else fallback
            const finalData = liveData.USD ? liveData : defaultMacroData;
            const scored = calculateScores(finalData);
            renderDashboard(scored);
        })
        .catch(() => {
            console.log("Using local matrix fallback engine.");
            const scored = calculateScores(defaultMacroData);
            renderDashboard(scored);
        });
});
