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

async function verify() {
    try {
        console.log('--- Verifying Request 11053 ---');
        const requests = await fetchSupabase('solicitud_17?numero_solicitud=eq.11053');
        console.log('Result:', JSON.stringify(requests, null, 2));
    } catch (err) {
        console.error('Verification failed:', err);
    }
}

verify();
