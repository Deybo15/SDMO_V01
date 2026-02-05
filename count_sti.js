import https from 'https';

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2Nxb2Vyb25iY2R5ZWpmam9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMzA5MzIsImV4cCI6MjA1OTgwNjkzMn0.v_KA6VdHl-F3sRiVaFMsfDQCS1qKERFBk5mTBcSiIDQ';
const SUPABASE_URL = 'https://qpccqoeronbcdyejfjod.supabase.co';

async function fetchSupabase(path) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`
            }
        };
        https.get(`${SUPABASE_URL}/rest/v1/${path}`, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(`Error parsing response: ${body}`);
                }
            });
        }).on('error', reject);
    });
}

async function diagnose() {
    try {
        console.log('--- Detailed Diagnosis for STI Feb 2026 ---');

        // Get all STI requests in Feb 2026 with more fields
        const requests = await fetchSupabase('solicitud_17?tipo_solicitud=eq.STI&fecha_solicitud=gte.2026-02-01&fecha_solicitud=lt.2026-03-01&select=numero_solicitud,fecha_solicitud,area_mantenimiento,supervisor_asignado');

        console.log(`Total STI requests in DB: ${requests.length}`);

        // Summarize by date
        const dateCounts = {};
        const areaCounts = {};
        const supervisorCounts = {};

        requests.forEach(r => {
            const date = r.fecha_solicitud;
            dateCounts[date] = (dateCounts[date] || 0) + 1;

            const area = r.area_mantenimiento || 'NULL';
            areaCounts[area] = (areaCounts[area] || 0) + 1;

            const supervisor = r.supervisor_asignado || 'NULL';
            supervisorCounts[supervisor] = (supervisorCounts[supervisor] || 0) + 1;
        });

        console.log('--- Distribution by Date ---');
        console.log(JSON.stringify(dateCounts, null, 2));

        console.log('--- Distribution by Area ---');
        console.log(JSON.stringify(areaCounts, null, 2));

        console.log('--- Distribution by Supervisor ---');
        console.log(JSON.stringify(supervisorCounts, null, 2));

        // Get tracking records to check status
        const ids = requests.map(r => r.numero_solicitud).join(',');
        const tracking = await fetchSupabase(`seguimiento_solicitud?numero_solicitud=in.(${ids})&select=numero_solicitud,estado_actual`);

        const statusCounts = {};
        tracking.forEach(t => {
            statusCounts[t.estado_actual] = (statusCounts[t.estado_actual] || 0) + 1;
        });

        console.log('--- Distribution by Status (Seguimiento) ---');
        console.log(JSON.stringify(statusCounts, null, 2));

    } catch (err) {
        console.error('Diagnosis failed:', err);
    }
}

diagnose();
