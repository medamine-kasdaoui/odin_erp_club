const jwt = require('jsonwebtoken');
const axios = require('axios');

async function test() {
    try {
        const token = jwt.sign({ sub: '69f5354df1b1d3d24d595d30', email: 'admin@odin.com', clubId: '69f5354df1b1d3d24d595d3e', role: 'ADMIN' }, 'odin_erp_club_super_secret_key_change_in_production', { expiresIn: '1h' });
        
        console.log("Testing POST /api/events");
        try {
            const resPost = await axios.post('http://localhost:3000/api/events', {
                eventType: 'match',
                title: 'Test API Script',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 3600000).toISOString()
            }, { headers: { Authorization: `Bearer ${token}` } });
            console.log("POST SUCCESS:", resPost.data);
        } catch(e) {
            console.log("POST ERROR:", e.response?.data || e.message);
        }

        console.log("\nTesting GET /api/events/calendar");
        try {
            const resGet = await axios.get('http://localhost:3000/api/events/calendar?startDate=2026-05-01&endDate=2026-05-31', { headers: { Authorization: `Bearer ${token}` } });
            console.log("GET CALENDAR SUCCESS:", JSON.stringify(resGet.data, null, 2));
        } catch(e) {
            console.log("GET CALENDAR ERROR:", e.response?.data || e.message);
        }

        console.log("\nTesting GET /api/events");
        try {
            const resGetAll = await axios.get('http://localhost:3000/api/events', { headers: { Authorization: `Bearer ${token}` } });
            console.log("GET EVENTS SUCCESS:", resGetAll.data.data.events.length, "events");
        } catch(e) {
            console.log("GET EVENTS ERROR:", e.response?.data || e.message);
        }
    } catch(e) {
        console.error("Fatale error:", e);
    }
}
test();
