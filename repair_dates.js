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
                try {
                    if (responseBody) {
                        resolve(JSON.parse(responseBody));
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(`Error parsing response: ${responseBody}`);
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function repair() {
    try {
        console.log('--- Data Repair for STI Feb 2026 ---');

        // Find requests with date 2026-02-05
        const misdated = await requestSupabase('GET', 'solicitud_17?fecha_solicitud=eq.2026-02-05&select=numero_solicitud,fecha_solicitud');
        console.log(`Found ${misdated.length} requests misdated as 2026-02-05`);

        if (misdated.length === 0) {
            console.log('No repair needed.');
            return;
        }

        // Update them to 2026-02-04
        const ids = misdated.map(m => m.numero_solicitud);
        console.log(`Updating IDs: ${ids.join(', ')}`);

        const result = await requestSupabase('PATCH', `solicitud_17?numero_solicitud=in.(${ids.join(',')})`, {
            fecha_solicitud: '2026-02-04'
        });

        console.log('Update successful. Result count:', result?.length || 0);

    } catch (err) {
        console.error('Repair failed:', err);
    }
}

repair();
