document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('results/results.json');
        if (!response.ok) {
            throw new Error('results.json not found. Run the benchmark kit first.');
        }
        const results = await response.json();
        
        renderHallucinationTable(results);
        renderCalibrationTable(results);
        renderRccChart(results);

    } catch (error) {
        console.error("Failed to load or render evidence:", error);
        document.body.innerHTML = `<h1>Error</h1><p>${error.message}</p><p>Please run the benchmark kit (e.g., <code>make run-offline</code>) and ensure <code>results/results.json</code> exists.</p>`;
    }
});

function renderHallucinationTable(results) {
    const tableBody = document.querySelector('#hallucination-table tbody');
    for (const domain in results) {
        if (results[domain].Base && results[domain].MStack) {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${domain}</td>
                <td>${(results[domain].Base.hallucination_rate * 100).toFixed(1)}%</td>
                <td>${(results[domain].SelfConsistency.hallucination_rate * 100).toFixed(1)}%</td>
                <td>${(results[domain].JudgeGate.hallucination_rate * 100).toFixed(1)}%</td>
                <td><strong>${(results[domain].MStack.hallucination_rate * 100).toFixed(1)}%</strong></td>
            `;
        }
    }
}

function renderCalibrationTable(results) {
    const tableBody = document.querySelector('#calibration-table tbody');
    const overall = results.Overall;
    if (overall) {
        const eceRow = tableBody.insertRow();
        eceRow.innerHTML = `<td>ECE (↓ better)</td><td>${overall.Base.ece.toFixed(3)}</td><td><strong>${overall.MStack.ece.toFixed(3)}</strong></td>`;
        
        const aurcRow = tableBody.insertRow();
        aurcRow.innerHTML = `<td>AURC (↓ better)</td><td>${overall.Base.aurc.toFixed(3)}</td><td><strong>${overall.MStack.aurc.toFixed(3)}</strong></td>`;
    }
}

function renderRccChart(results) {
    const rccData = results.RCC_Curves;
    if (!rccData) return;

    const traces = Object.keys(rccData).map(key => ({
        x: rccData[key].coverage,
        y: rccData[key].risk,
        mode: 'lines',
        name: key,
        line: {
            width: key === 'M-Stack' ? 4 : 2,
            dash: key.includes('Base') ? 'dot' : 'solid'
        }
    }));

    const layout = {
        title: 'Risk-Controlling Coverage (RCC)',
        xaxis: { title: 'Coverage' },
        yaxis: { title: 'Empirical Risk (Error Rate)' },
        legend: { x: 0.1, y: 0.9 }
    };

    Plotly.newPlot('rcc-chart', traces, layout);
}
