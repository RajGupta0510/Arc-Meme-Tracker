const { Client } = require('pg');

const databaseUrl = 'postgresql://neondb_owner:npg_noEtk09PJrDa@ep-fragrant-fog-aou4tdxi.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    // 1. Fetch token record from database
    const tokenRes = await client.query('SELECT * FROM tokens WHERE id LIKE \'%raj%\'');
    console.log('--- TOKENS RECORD ---');
    console.log(JSON.stringify(tokenRes.rows, null, 2));
    
    // 2. Fetch trades record from database
    const tradesRes = await client.query('SELECT * FROM trades WHERE "tokenId" LIKE \'%raj%\'');
    console.log('--- TRADES RECORDS ---');
    console.log(JSON.stringify(tradesRes.rows, null, 2));
  } catch (err) {
    console.error(err.stack);
  } finally {
    await client.end();
  }
}

run();
