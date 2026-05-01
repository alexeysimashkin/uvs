const https = require('https');

// ⚠️ ЗАМЕНИ НА СВОИ ДАННЫЕ
const GIST_ID = '2f4805cecf5095658da5702839a0b8e98355bf1f'; // ID из URL гиста
const GITHUB_TOKEN = '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'; // GitHub токен
const GITHUB_USERNAME = 'alexeysimashkin'; // Твой GitHub username

const RAW_URL = `https://gist.githubusercontent.com/${GITHUB_USERNAME}/${GIST_ID}/raw/flights.json`;
const API_URL = `https://api.github.com/gists/${GIST_ID}`;

function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const mod = isHttps ? https : require('http');
        
        const reqOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Airport-Board',
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
        const data = await request(RAW_URL);
        return data.flights || [];
    } catch(e) {
        console.error('Read error:', e.message);
        return [];
    }
}

async function saveFlights(flights) {
    try {
        await request(API_URL, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            },
            body: {
                files: {
                    'flights.json': {
                        content: JSON.stringify({ flights: flights }, null, 2)
                    }
                }
            }
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
        if (req.method === 'GET') {
            const flights = await readFlights();
            return res.status(200).json({ flights });
        }

        if (req.method === 'POST') {
            const flights = await readFlights();
            const flight = req.body;
            
            if (!flight.flightNumber || !flight.destination) {
                return res.status(400).json({ error: 'Заполните номер рейса и направление' });
            }

            flight.id = Date.now().toString();
            flight.createdAt = new Date().toISOString();
            
            flights.push(flight);
            await saveFlights(flights);
            
            return res.status(200).json({ success: true, flight: flight });
        }

        if (req.method === 'PUT') {
            const flights = await readFlights();
            const updated = req.body;
            const index = flights.findIndex(f => f.id === updated.id);
            
            if (index === -1) return res.status(404).json({ error: 'Рейс не найден' });
            
            flights[index] = { ...flights[index], ...updated };
            await saveFlights(flights);
            
            return res.status(200).json({ success: true, flight: flights[index] });
        }

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
        console.error('Error:', err);
        return res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
};
