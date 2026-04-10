
async function test() {
    try {
        const res = await fetch('http://localhost:3000/api/admin/push-player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player: { id: 'test', name: 'Test Player' } })
        });
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response:', text.slice(0, 100));
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
