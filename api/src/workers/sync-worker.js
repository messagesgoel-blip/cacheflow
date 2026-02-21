console.log('CacheFlow sync worker started');
require('dotenv').config();
const pool = require('../db/client');
pool.query('SELECT NOW()').then(r => console.log('DB connected:', r.rows[0]));
