import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    // Read the index.html file from the public directory
    const html = readFileSync(
      join(process.cwd(), "public", "index.html"),
      "utf-8"
    );

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to load index page",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

