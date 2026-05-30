async function test() {
  try {
    const res = await fetch("http://localhost:8080/api/tokens/tt-1779102646503/trades");
    const json = await res.json();
    console.log("Status:", res.status);
    console.log("Trades length:", json.length);
    console.log("Trades sample:", json.slice(0, 3));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
test();
