export function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, service: "chefpuppers-dynamic-checkout" }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
