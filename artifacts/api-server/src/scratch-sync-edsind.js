import { indexTokenSwapEvents } from "./lib/swap-indexer.js";
import { getToken } from "./lib/token-store.js";

async function test() {
  const token = getToken("edsind-1779965039957");
  console.log("Token:", token);
  if (!token) return;
  
  try {
    const result = await indexTokenSwapEvents(token);
    console.log("Indexing Result:", result);
  } catch (err) {
    console.error("Indexing Error:", err);
  }
}

test();
