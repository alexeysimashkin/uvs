const https = require('https');

// ⚠️ ЗАМЕНИ НА СВОИ ДАННЫЕ
const GIST_ID = '4b67cecdc98cd3ef2800882a3588832d';
const GITHUB_TOKEN = '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';
const GITHUB_USERNAME = 'alexeysimashkin';

const RAW_URL = `https://gist.githubusercontent.com/${GITHUB_USERNAME}/${GIST_ID}/raw/flights.json`;
const API_URL = `https://api.github.com/gists/${GIST_ID}`;

function httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const mod = urlObj.protocol === 'https:' ? https : require('http');
        
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

        req.on('error', (err) => {
            reject(err);
        });

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

async function readFlights() {
    const data = await httpRequest(RAW_URL);
    return data.flights || [];
}

async function saveFlights(flights) {
    await httpRequest(API_URL, {
        method: 'PATCH',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
        },
        body: {
            files: {
                'flights.json': {
                    content: JSON.stringify({ flights: flights })
                }
            }
        }
    });
    return true;
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

        // POST - добавить рейс
        if (req.method === 'POST') {
            const flights = await readFlights();
            const flight = req.body;
            
            flight.id = Date.now().toString();
            flight.createdAt = new Date().toISOString();
            
            flights.push(flight);
            await saveFlights(flights);
            
            return res.status(200).json({ success: true, flight: flight });
        }

        // PUT - обновить
        if (req.method === 'PUT') {
            const flights = await readFlights();
            const updated = req.body;
            const index = flights.findIndex(f => f.id === updated.id);
            
            if (index === -1) return res.status(404).json({ error: 'Не найден' });
            
            flights[index] = { ...flights[index], ...updated };
            await saveFlights(flights);
            
            return res.status(200).json({ success: true });
        }

        // DELETE
        if (req.method === 'DELETE') {
            const flights = await readFlights();
            const id = req.query.id;
            const newFlights = flights.filter(f => f.id !== id);
            
            await saveFlights(newFlights);
            
            return res.status(200).json({ success: true });
        }

    } catch(err) {
        return res.status(500).json({ error: err.message });
    }
};
