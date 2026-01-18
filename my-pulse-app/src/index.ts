// In-memory storage for feedback (temporary - will be replaced with D1)
const feedbackStore: Array<{
	text: string;
	source: string;
	createdAt: string;
}> = [];

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		console.log("WORKER HIT:", request.method, new URL(request.url).pathname);
		const url = new URL(request.url);

		// API ROUTES FIRST - check before static assets
		if (url.pathname === "/feedback" && request.method === "POST") {
			try {
				const body = await request.json() as { text?: string; source?: string };

				// Validate that text exists and is non-empty
				if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
					return new Response(
						JSON.stringify({ error: "Missing or empty text field" }),
						{ status: 400, headers: { "Content-Type": "application/json" } }
					);
				}

				// In-memory store (temporary - will be replaced with D1)
				feedbackStore.push({
					text: body.text,
					source: body.source ?? "unknown",
					createdAt: new Date().toISOString(),
				});

				return new Response(
					JSON.stringify({ success: true }),
					{ headers: { "Content-Type": "application/json" } }
				);
			} catch (error) {
				return new Response(
					JSON.stringify({ error: "Invalid JSON" }),
					{ status: 400, headers: { "Content-Type": "application/json" } }
				);
			}
		}

		// FALLBACK: return 404 for unmatched API routes
		// Note: With assets configured in wrangler.jsonc, static assets (like /index.html)
		// are handled automatically by Wrangler before the Worker runs
		return new Response("Not Found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;  