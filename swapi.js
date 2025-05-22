// StarWars API Code
// This code intentionally violates clean code principles for refactoring practice

const http = require('http');
const https = require('https');

let cache = {};
let debug_mode = true;
let timeout = 5000;
let err_count = 0;

async function f(x) {
    if (cache[x]) {
        if (debug_mode) console.log("Using cached data for", x);
        return cache[x];
    }
    
    return new Promise((r, j) => {
        let d = '';
        const req = https.get(`https://swapi.dev/api/${x}`, { rejectUnauthorized: false }, (res) => {
            if (res.statusCode >= 400) {
                err_count++;
                return j(new Error(`Request failed with status code ${res.statusCode}`));
            }
            
            res.on('data', (chunk) => { d += chunk; });
            res.on('end', () => {
                try {
                    const p = JSON.parse(d);
                    cache[x] = p; // Cache the result
                    r(p);
                    if (debug_mode) {
                        console.log(`Successfully fetched data for ${x}`);
                        console.log(`Cache size: ${Object.keys(cache).length}`);
                    }
                } catch (e) {
                    err_count++;
                    j(e);
                }
            });
        }).on('error', (e) => {
            err_count++;
            j(e);
        });
        
        req.setTimeout(timeout, () => {
            req.abort();
            err_count++;
            j(new Error(`Request timeout for ${x}`));
        });
    });
}

// Global variables for tracking state
let lastId = 1;
let fetch_count = 0;
let total_size = 0;

async function p() {
    try {
        if (debug_mode) console.log("Starting data fetch...");
        fetch_count++;
        
        const p1 = await f('people/' + lastId);
        total_size += JSON.stringify(p1).length;
        console.log('Character:', p1.name);
        console.log('Height:', p1.height);
        console.log('Mass:', p1.mass);
        console.log('Birthday:', p1.birth_year);
        if (p1.films && p1.films.length > 0) {
            console.log('Appears in', p1.films.length, 'films');
        }
        
        const s1 = await f('starships/?page=1');
        total_size += JSON.stringify(s1).length;
        console.log('\nTotal Starships:', s1.count);
        
        // Print first 3 starships with details
        for (let i = 0; i < 3; i++) {
            if (i < s1.results.length) {
                const s = s1.results[i];
                console.log(`\nStarship ${i+1}:`);
                console.log('Name:', s.name);
                console.log('Model:', s.model);
                console.log('Manufacturer:', s.manufacturer);
                console.log('Cost:', s.cost_in_credits !== 'unknown' ? s.cost_in_credits + ' credits' : 'unknown');
                console.log('Speed:', s.max_atmosphering_speed);
                console.log('Hyperdrive Rating:', s.hyperdrive_rating);
                if (s.pilots && s.pilots.length > 0) {
                    console.log('Pilots:', s.pilots.length);
                }
            }
        }
        
        // Find planets with population > 1000000000 and diameter > 10000
        const planets = await f('planets/?page=1');
        total_size += JSON.stringify(planets).length;
        console.log('\nLarge populated planets:');
        for (let i = 0; i < planets.results.length; i++) {
            const p = planets.results[i];
            if (p.population !== 'unknown' && parseInt(p.population) > 1000000000 && 
                p.diameter !== 'unknown' && parseInt(p.diameter) > 10000) {
                console.log(p.name, '- Pop:', p.population, '- Diameter:', p.diameter, '- Climate:', p.climate);
                // Check if it appears in any films
                if (p.films && p.films.length > 0) {
                    console.log(`  Appears in ${p.films.length} films`);
                }
            }
        }
        
        // Get films and sort by release date, then print details
        const films = await f('films/');
        total_size += JSON.stringify(films).length;
        let filmList = films.results;
        filmList.sort((a, b) => {
            return new Date(a.release_date) - new Date(b.release_date);
        });
        
        console.log('\nStar Wars Films in chronological order:');
        for (let i = 0; i < filmList.length; i++) {
            const film = filmList[i];
            console.log(`${i+1}. ${film.title} (${film.release_date})`);
            console.log(`   Director: ${film.director}`);
            console.log(`   Producer: ${film.producer}`);
            console.log(`   Characters: ${film.characters.length}`);
            console.log(`   Planets: ${film.planets.length}`);
        }
        
        // Get a vehicle and display details
        if (lastId <= 4) {
            const vehicle = await f('vehicles/' + lastId);
            total_size += JSON.stringify(vehicle).length;
            console.log('\nFeatured Vehicle:');
            console.log('Name:', vehicle.name);
            console.log('Model:', vehicle.model);
            console.log('Manufacturer:', vehicle.manufacturer);
            console.log('Cost:', vehicle.cost_in_credits, 'credits');
            console.log('Length:', vehicle.length);
            console.log('Crew Required:', vehicle.crew);
            console.log('Passengers:', vehicle.passengers);
            lastId++;  // Increment for next call
        }
        
        // Print stats
        if (debug_mode) {
            console.log('\nStats:');
            console.log('API Calls:', fetch_count);
            console.log('Cache Size:', Object.keys(cache).length);
            console.log('Total Data Size:', total_size, 'bytes');
            console.log('Error Count:', err_count);
        }
        
    } catch (e) {
        console.error('Error:', e.message);
        err_count++;
    }
}

// Process command line arguments
const args = process.argv.slice(2);
if (args.includes('--no-debug')) {
    debug_mode = false;
}
if (args.includes('--timeout')) {
    const index = args.indexOf('--timeout');
    if (index < args.length - 1) {
        timeout = parseInt(args[index + 1]);
    }
}

// Create a simple HTTP server to display the results
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Star Wars API Demo</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                        h1 { color: #FFE81F; background-color: #000; padding: 10px; }
                        button { background-color: #FFE81F; border: none; padding: 10px 20px; cursor: pointer; }
                        .footer { margin-top: 50px; font-size: 12px; color: #666; }
                        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <h1>Star Wars API Demo</h1>
                    <p>This page demonstrates fetching data from the Star Wars API.</p>
                    <p>Check your console for the API results.</p>
                    <button onclick="fetchData()">Fetch Star Wars Data</button>
                    <div id="results"></div>
                    <script>
                        function fetchData() {
                            document.getElementById('results').innerHTML = '<p>Loading data...</p>';
                            fetch('/api')
                                .then(res => res.text())
                                .then(text => {
                                    alert('API request made! Check server console.');
                                    document.getElementById('results').innerHTML = '<p>Data fetched! Check server console.</p>';
                                })
                                .catch(err => {
                                    document.getElementById('results').innerHTML = '<p>Error: ' + err.message + '</p>';
                                });
                        }
                    </script>
                    <div class="footer">
                        <p>API calls: ${fetch_count} | Cache entries: ${Object.keys(cache).length} | Errors: ${err_count}</p>
                        <pre>Debug mode: ${debug_mode ? 'ON' : 'OFF'} | Timeout: ${timeout}ms</pre>
                    </div>
                </body>
            </html>
        `);
    } else if (req.url === '/api') {
        p();
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('Check server console for results');
    } else if (req.url === '/stats') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
            api_calls: fetch_count,
            cache_size: Object.keys(cache).length,
            data_size: total_size,
            errors: err_count,
            debug: debug_mode,
            timeout: timeout
        }));
    } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Not Found');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log('Open the URL in your browser and click the button to fetch Star Wars data');
    if (debug_mode) {
        console.log('Debug mode: ON');
        console.log('Timeout:', timeout, 'ms');
    }
}); 