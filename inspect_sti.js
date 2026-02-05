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

async function inspect() {
    try {
        console.log('--- Inspecting Feb 2026 Requests ---');
        const requests = await fetchSupabase('solicitud_17?tipo_solicitud=eq.STI&fecha_solicitud=gte.2026-02-01&fecha_solicitud=lt.2026-03-01&limit=5');
        console.log(JSON.stringify(requests, null, 2));
    } catch (err) {
        console.error('Inspection failed:', err);
    }
}

inspect();
