const https = require('https');

// ⚠️ СЮДА ВСТАВЬ СВОЙ URL ОТ NPOINT.IO
const STORAGE_URL = 'https://api.npoint.io/8450771b7ce94b0daf1f';

function request(method, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(STORAGE_URL);
        
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    reject(new Error('Parse error: ' + data.substring(0, 100)));
                }
            });
        });

        req.on('error', (err) => {
            reject(new Error('Request error: ' + err.message));
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // GET — получить рейсы
        if (req.method === 'GET') {
            const data = await request('GET');
            return res.status(200).json({ flights: data.flights || [] });
        }

        // POST — добавить рейс
        if (req.method === 'POST') {
            // Сначала читаем текущие данные
            const data = await request('GET');
            const flights = data.flights || [];
            
            const flight = req.body;
            
            if (!flight.flightNumber || !flight.destination) {
                return res.status(400).json({ error: 'Нужен номер рейса и направление' });
            }

            flight.id = Date.now().toString();
            flight.createdAt = new Date().toISOString();
            
            flights.push(flight);
            
            // Сохраняем
            await request('PUT', { flights });
            
            return res.status(200).json({ success: true, flight: flight });
        }

        // PUT — обновить рейс
        if (req.method === 'PUT') {
            const data = await request('GET');
            const flights = data.flights || [];
            
            const updated = req.body;
            const index = flights.findIndex(f => f.id === updated.id);
            
            if (index === -1) {
                return res.status(404).json({ error: 'Рейс не найден' });
            }
            
            flights[index] = { ...flights[index], ...updated };
            await request('PUT', { flights });
            
            return res.status(200).json({ success: true, flight: flights[index] });
        }

        // DELETE — удалить рейс
        if (req.method === 'DELETE') {
            const data = await request('GET');
            const flights = data.flights || [];
            
            const id = req.query.id;
            const index = flights.findIndex(f => f.id === id);
            
            if (index === -1) {
                return res.status(404).json({ error: 'Рейс не найден' });
            }
            
            flights.splice(index, 1);
            await request('PUT', { flights });
            
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Метод не поддерживается' });

    } catch (err) {
        console.error('Error:', err.message);
        return res.status(500).json({ 
            error: 'Ошибка сервера', 
            message: err.message 
        });
    }
};
