import https from 'https';

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2Nxb2Vyb25iY2R5ZWpmam9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMzA5MzIsImV4cCI6MjA1OTgwNjkzMn0.v_KA6VdHl-F3sRiVaFMsfDQCS1qKERFBk5mTBcSiIDQ';
const SUPABASE_URL = 'https://qpccqoeronbcdyejfjod.supabase.co';

async function requestSupabase(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = `${SUPABASE_URL}/rest/v1/${path}`;
        const options = {
            method,
            headers: {
                'apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };

        const req = https.request(url, options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                console.log(`Headers: ${JSON.stringify(res.headers)}`);
                try {
                    if (responseBody) {
                        resolve(JSON.parse(responseBody));
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(responseBody);
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function testRepair() {
    try {
        console.log('--- Patch Test: Request 11053 ---');
        const result = await requestSupabase('PATCH', 'solicitud_17?numero_solicitud=eq.11053', {
            fecha_solicitud: '2026-02-04'
        });
        console.log('Result:', result);

    } catch (err) {
        console.error('Test failed:', err);
    }
}

testRepair();
