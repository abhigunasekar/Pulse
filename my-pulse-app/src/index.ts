export default {
	async fetch(request: Request, env: Env): Promise<Response> {
	  const url = new URL(request.url);
  
	  /**
	   * POST /feedback
	   * Ingest feedback, run sentiment analysis, store in D1
	   */
	  if (url.pathname === "/feedback" && request.method === "POST") {
		let body: { text?: string; source?: string };
  
		try {
		  body = await request.json();
		} catch {
		  return new Response(
			JSON.stringify({ error: "Invalid JSON" }),
			{ status: 400, headers: { "Content-Type": "application/json" } }
		  );
		}
  
		if (!body.text || body.text.trim() === "") {
		  return new Response(
			JSON.stringify({ error: "Missing or empty text field" }),
			{ status: 400, headers: { "Content-Type": "application/json" } }
		  );
		}
  
		try {
		  // Run sentiment analysis
		  const aiResult = await env.AI.run(
			"@cf/huggingface/distilbert-sst-2-int8",
			{ text: body.text }
		  ) as Array<{ label?: string; score?: number }>;

		  let sentiment: "positive" | "negative" | "neutral" = "neutral";

		  const topResult = aiResult[0];
		  if (topResult && topResult.score && topResult.score >= 0.6 && topResult.label) {
			sentiment =
			  topResult.label.toUpperCase() === "POSITIVE" ? "positive" : "negative";
		  }
  
		  await env.DB.prepare(
			`INSERT INTO feedback (text, source, sentiment, created_at)
			 VALUES (?, ?, ?, ?)`
		  )
			.bind(
			  body.text,
			  body.source ?? null,
			  sentiment,
			  new Date().toISOString()
			)
			.run();
  
		  return new Response(
			JSON.stringify({ success: true }),
			{ headers: { "Content-Type": "application/json" } }
		  );
		} catch (err) {
		  console.error("POST /feedback error:", err);
		  return new Response(
			JSON.stringify({ error: "Failed to store feedback" }),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		  );
		}
	  }
  
	  /**
	   * GET /feedback
	   * Retrieve recent feedback
	   */
	  if (url.pathname === "/feedback" && request.method === "GET") {
		try {
		  const result = await env.DB.prepare(
			`SELECT id, text, source, sentiment, created_at
			 FROM feedback
			 ORDER BY created_at DESC
			 LIMIT 20`
		  ).all();

		  return new Response(
			JSON.stringify({ feedback: result.results ?? [] }),
			{ headers: { "Content-Type": "application/json" } }
		  );
		} catch (err) {
		  console.error("GET /feedback error:", err);
		  return new Response(
			JSON.stringify({ error: "Failed to retrieve feedback" }),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		  );
		}
	  }

	  /**
	   * GET /api/feedback
	   * Returns filtered feedback as JSON
	   * Query params: ?sentiment=positive|negative|neutral, ?keyword=text
	   */
	  if (url.pathname === "/api/feedback" && request.method === "GET") {
		try {
		  const sentiment = url.searchParams.get("sentiment");
		  const keyword = url.searchParams.get("keyword");

		  let query = `SELECT id, text, source, sentiment, created_at FROM feedback WHERE 1=1`;
		  const bindings: unknown[] = [];

		  if (sentiment) {
			query += ` AND sentiment = ?`;
			bindings.push(sentiment);
		  }

		  if (keyword) {
			query += ` AND text LIKE ?`;
			bindings.push(`%${keyword}%`);
		  }

		  query += ` ORDER BY created_at DESC LIMIT 50`;

		  const stmt = env.DB.prepare(query);
		  const result = bindings.length > 0 
			? await stmt.bind(...bindings).all()
			: await stmt.all();

		  return new Response(
			JSON.stringify({ feedback: result.results ?? [] }),
			{ headers: { "Content-Type": "application/json" } }
		  );
		} catch (err) {
		  console.error("GET /api/feedback error:", err);
		  return new Response(
			JSON.stringify({ error: "Failed to retrieve feedback" }),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		  );
		}
	  }

	  /**
	   * GET /api/insights
	   * Interprets "what happened" query using AI and returns filter suggestions
	   */
	  if (url.pathname === "/api/insights" && request.method === "GET") {
		const query = url.searchParams.get("q");
		if (!query) {
		  return new Response(
			JSON.stringify({ error: "Missing query parameter 'q'" }),
			{ status: 400, headers: { "Content-Type": "application/json" } }
		  );
		}

		try {
		  // Interpret query using simple pattern matching
		  // Map natural language to sentiment/keyword filters
		  const lowerQuery = query.toLowerCase();
		  let filters: { sentiment: string | null; keyword: string | null } = { sentiment: null, keyword: null };

		  // Detect sentiment intent
		  if (lowerQuery.includes("positive") || lowerQuery.includes("good") || lowerQuery.includes("great") || lowerQuery.includes("excellent")) {
			filters.sentiment = "positive";
		  } else if (lowerQuery.includes("negative") || lowerQuery.includes("bad") || lowerQuery.includes("issue") || lowerQuery.includes("problem") || lowerQuery.includes("bug")) {
			filters.sentiment = "negative";
		  } else if (lowerQuery.includes("neutral")) {
			filters.sentiment = "neutral";
		  }

		  // Extract keyword - look for "about" or "with" phrases, or use query as keyword
		  const aboutMatch = lowerQuery.match(/about\s+(.+?)(?:\s|$)/i);
		  const withMatch = lowerQuery.match(/with\s+(.+?)(?:\s|$)/i);
		  
		  if (aboutMatch) {
			filters.keyword = aboutMatch[1].trim().substring(0, 50);
		  } else if (withMatch) {
			filters.keyword = withMatch[1].trim().substring(0, 50);
		  } else if (!filters.sentiment) {
			// If no sentiment detected, use query as keyword
			filters.keyword = query.trim().substring(0, 50);
		  }

		  return new Response(
			JSON.stringify({ filters }),
			{ headers: { "Content-Type": "application/json" } }
		  );
		} catch (err) {
		  console.error("GET /api/insights error:", err);
		  return new Response(
			JSON.stringify({ error: "Failed to interpret query" }),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		  );
		}
	  }

	  /**
	   * GET /dashboard
	   * Returns interactive HTML dashboard
	   */
	  if (url.pathname === "/dashboard" && request.method === "GET") {
		try {
		  // Get aggregated sentiment counts
		  const countsResult = await env.DB.prepare(
			`SELECT sentiment, COUNT(*) as count FROM feedback GROUP BY sentiment`
		  ).all();

		  const counts: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
		  for (const row of (countsResult.results ?? []) as Array<{ sentiment: string; count: number }>) {
			counts[row.sentiment] = row.count;
		  }

		  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pulse Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 30px; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      border: 2px solid transparent;
    }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
    .stat-card.active { border-color: #0070f3; }
    .stat-card.positive { border-left: 4px solid #10b981; }
    .stat-card.negative { border-left: 4px solid #ef4444; }
    .stat-card.neutral { border-left: 4px solid #6b7280; }
    .stat-label { font-size: 14px; color: #666; text-transform: uppercase; }
    .stat-value { font-size: 32px; font-weight: bold; color: #333; margin-top: 8px; }
    .query-section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .query-section h2 { margin-bottom: 15px; color: #333; }
    .query-input {
      display: flex;
      gap: 10px;
    }
    .query-input input {
      flex: 1;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
    }
    .query-input button {
      padding: 12px 24px;
      background: #0070f3;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    .query-input button:hover { background: #0051cc; }
    .feedback-table {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #f9fafb;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #333;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .sentiment-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .sentiment-badge.positive { background: #d1fae5; color: #065f46; }
    .sentiment-badge.negative { background: #fee2e2; color: #991b1b; }
    .sentiment-badge.neutral { background: #e5e7eb; color: #374151; }
    .loading { text-align: center; padding: 40px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Pulse Feedback Dashboard</h1>

    <div class="stats">
      <div class="stat-card positive" data-sentiment="positive" onclick="filterBySentiment('positive')">
        <div class="stat-label">Positive</div>
        <div class="stat-value" id="count-positive">${counts.positive}</div>
      </div>
      <div class="stat-card neutral" data-sentiment="neutral" onclick="filterBySentiment('neutral')">
        <div class="stat-label">Neutral</div>
        <div class="stat-value" id="count-neutral">${counts.neutral}</div>
      </div>
      <div class="stat-card negative" data-sentiment="negative" onclick="filterBySentiment('negative')">
        <div class="stat-label">Negative</div>
        <div class="stat-value" id="count-negative">${counts.negative}</div>
      </div>
    </div>

    <div class="query-section">
      <h2>What happened?</h2>
      <div class="query-input">
        <input type="text" id="queryInput" placeholder="Ask about feedback (e.g., 'show me negative feedback' or 'what about bugs')" />
        <button onclick="handleQuery()">Search</button>
      </div>
    </div>

    <div class="feedback-table">
      <table>
        <thead>
          <tr>
            <th>Sentiment</th>
            <th>Text</th>
            <th>Source</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody id="feedbackBody">
          <tr><td colspan="4" class="loading">Loading feedback...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    let currentFilter = { sentiment: null, keyword: null };

    async function loadFeedback() {
      const params = new URLSearchParams();
      if (currentFilter.sentiment) params.append('sentiment', currentFilter.sentiment);
      if (currentFilter.keyword) params.append('keyword', currentFilter.keyword);

      try {
        const response = await fetch('/api/feedback?' + params.toString());
        const data = await response.json();
        renderFeedback(data.feedback || []);
      } catch (error) {
        console.error('Error loading feedback:', error);
        document.getElementById('feedbackBody').innerHTML = '<tr><td colspan="4" class="loading">Error loading feedback</td></tr>';
      }
    }

    function renderFeedback(feedback) {
      const tbody = document.getElementById('feedbackBody');
      if (feedback.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">No feedback found</td></tr>';
        return;
      }

      tbody.innerHTML = feedback.map(item => {
        const date = new Date(item.created_at).toLocaleString();
        return \`<tr>
          <td><span class="sentiment-badge \${item.sentiment || 'neutral'}">\${item.sentiment || 'neutral'}</span></td>
          <td>\${escapeHtml(item.text)}</td>
          <td>\${escapeHtml(item.source || 'unknown')}</td>
          <td>\${date}</td>
        </tr>\`;
      }).join('');
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function filterBySentiment(sentiment) {
      // Toggle if already selected
      if (currentFilter.sentiment === sentiment) {
        currentFilter.sentiment = null;
      } else {
        currentFilter.sentiment = sentiment;
      }
      
      // Update active state
      document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('active');
      });
      if (currentFilter.sentiment) {
        document.querySelector(\`.stat-card[data-sentiment="\${currentFilter.sentiment}"]\`).classList.add('active');
      }
      
      loadFeedback();
    }

    async function handleQuery() {
      const query = document.getElementById('queryInput').value.trim();
      if (!query) return;

      try {
        const response = await fetch('/api/insights?q=' + encodeURIComponent(query));
        const data = await response.json();
        
        currentFilter.sentiment = data.filters.sentiment || null;
        currentFilter.keyword = data.filters.keyword || null;

        // Update active state
        document.querySelectorAll('.stat-card').forEach(card => {
          card.classList.remove('active');
        });
        if (currentFilter.sentiment) {
          document.querySelector(\`.stat-card[data-sentiment="\${currentFilter.sentiment}"]\`).classList.add('active');
        }

        loadFeedback();
      } catch (error) {
        console.error('Error interpreting query:', error);
        alert('Failed to interpret query. Try filtering by sentiment cards instead.');
      }
    }

    // Load initial feedback
    loadFeedback();

    // Allow Enter key in query input
    document.getElementById('queryInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleQuery();
    });
  </script>
</body>
</html>`;

		  return new Response(html, {
			headers: { "Content-Type": "text/html" }
		  });
		} catch (err) {
		  console.error("GET /dashboard error:", err);
		  return new Response("Failed to load dashboard", { status: 500 });
		}
	  }

	  return new Response("Not Found", { status: 404 });
	},
  } satisfies ExportedHandler<Env>;
  