async function test() {
  try {
    const res = await fetch("http://localhost:8080/api/tokens/tt-1779102646503");
    const json = await res.json();
    console.log("Status TT:", res.status);
    console.log("Token TT:", json);

    const res2 = await fetch("http://localhost:8080/api/tokens/raj-1779089616085");
    const json2 = await res2.json();
    console.log("Status RAJ:", res2.status);
    console.log("Token RAJ:", json2);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
test();
