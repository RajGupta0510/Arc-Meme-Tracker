import { updateTokenMarketStats } from "./dist/lib/token-store.mjs";

process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_noEtk09PJrDa@ep-fragrant-fog-aou4tdxi.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function run() {
  try {
    await updateTokenMarketStats("raj-1718115664187");
    console.log("updateTokenMarketStats completed successfully!");
  } catch (err) {
    console.error("Error running updateTokenMarketStats:", err);
  }
}

run();
