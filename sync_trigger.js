
const fetch = require('node-fetch');

async function sync() {
    try {
        const response = await fetch('http://localhost:3000/api/auth/sync-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'bapspetladyuva' })
        });
        const data = await response.json();
        console.log('Sync result:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Sync failed:', err);
    }
}

sync();
