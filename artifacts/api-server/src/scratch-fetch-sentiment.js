async function test() {
  try {
    const res = await fetch("http://localhost:8080/api/tokens/raj-1779089616085/sentiment");
    const json = await res.json();
    console.log("Status:", res.status);
    console.log("Sentiment:", json);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
test();
