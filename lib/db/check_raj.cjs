const { Client } = require('pg');

const databaseUrl = 'postgresql://neondb_owner:npg_noEtk09PJrDa@ep-fragrant-fog-aou4tdxi.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    // Fetch RAJ token
    const tokenRes = await client.query("SELECT id, ticker, price, \"marketCap\", \"totalSupply\", \"txCount\" FROM tokens WHERE id = 'raj-1718115664187'");
    console.log('--- RAJ TOKEN ---');
    console.log(JSON.stringify(tokenRes.rows[0], null, 2));

  } catch (err) {
    console.error(err.stack);
  } finally {
    await client.end();
  }
}

run();
