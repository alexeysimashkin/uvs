const https = require('https');
const http = require('http');

// ⚠️ ЗАМЕНИ НА СВОЙ URL ОТ NPOINT.IO
const STORAGE_URL = 'https://api.npoint.io/9b5014136177cbfc5469';

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const mod = urlObj.protocol === 'https:' ? https : http;
        
        const reqOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const req = mod.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

async function readFlights() {
    try {
        const data = await makeRequest(STORAGE_URL);
        return data?.flights || [];
    } catch(e) {
        console.error('Read error:', e.message);
        return [];
    }
}

async function saveFlights(flights) {
    try {
        await makeRequest(STORAGE_URL, {
            method: 'PUT',
            body: { flights }
        });
        return true;
    } catch(e) {
        console.error('Save error:', e.message);
        return false;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // GET
        if (req.method === 'GET') {
            const flights = await readFlights();
            return res.status(200).json({ flights });
        }

        // POST
        if (req.method === 'POST') {
            const flights = await readFlights();
            const flight = req.body;
            
            if (!flight.flightNumber || !flight.destination) {
                return res.status(400).json({ error: 'Нужен номер рейса и направление' });
            }

            flight.id = Date.now().toString();
            flight.createdAt = new Date().toISOString();
            
            flights.push(flight);
            await saveFlights(flights);
            
            return res.status(200).json({ success: true, flight });
        }

        // PUT
        if (req.method === 'PUT') {
            const flights = await readFlights();
            const updated = req.body;
            const index = flights.findIndex(f => f.id === updated.id);
            
            if (index === -1) return res.status(404).json({ error: 'Рейс не найден' });
            
            flights[index] = { ...flights[index], ...updated };
            await saveFlights(flights);
            
            return res.status(200).json({ success: true, flight: flights[index] });
        }

        // DELETE
        if (req.method === 'DELETE') {
            const flights = await readFlights();
            const id = req.query.id;
            const index = flights.findIndex(f => f.id === id);
            
            if (index === -1) return res.status(404).json({ error: 'Рейс не найден' });
            
            flights.splice(index, 1);
            await saveFlights(flights);
            
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Метод не поддерживается' });

    } catch(err) {
        return res.status(500).json({ error: err.message });
    }
};
