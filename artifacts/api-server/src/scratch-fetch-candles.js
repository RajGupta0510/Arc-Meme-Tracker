async function test() {
  try {
    const res = await fetch("http://localhost:8080/api/tokens/tt-1779102646503/candles?interval=1m");
    const json = await res.json();
    console.log("Status:", res.status);
    console.log("Candles length:", json.length);
    console.log("Candles sample:", json.slice(0, 3));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
test();
