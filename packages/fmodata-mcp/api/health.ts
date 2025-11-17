export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "fmodata-mcp",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
