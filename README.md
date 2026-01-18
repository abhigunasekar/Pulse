# 📊 Pulse: Real-Time Feedback Intelligence Dashboard

> A lightweight feedback intelligence system built on Cloudflare Workers that ingests raw user feedback, performs real-time sentiment analysis, aggregates insights, and presents them in an interactive dashboard with drill-down and natural-language querying.

The goal of this prototype is to demonstrate how Cloudflare's developer platform can be used end-to-end to build a production-ready analytics experience with minimal infrastructure.

---

## 🔗 Quick Links

- **🌐 Live Prototype:** [https://my-pulse-app.gabhi2001.workers.dev/dashboard](https://my-pulse-app.gabhi2001.workers.dev/dashboard)
- **💻 GitHub Repository:** [https://github.com/abhigunasekar/Pulse](https://github.com/abhigunasekar/Pulse)

---

## 🚀 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/feedback` | Ingest feedback with automatic sentiment analysis |
| `GET` | `/feedback` | Retrieve recent feedback entries |
| `GET` | `/api/feedback` | Filtered feedback (`?sentiment=` or `?keyword=`) |
| `GET` | `/api/insights` | Natural-language query interpretation |
| `GET` | `/dashboard` | Interactive dashboard UI |

---

## 🏗️ Architecture Overview

Pulse is built entirely on Cloudflare's Developer Platform using serverless technologies.

### Cloudflare Products Used

| Product | Purpose |
|---------|---------|
| **Cloudflare Workers** | Core application runtime, API routing, and HTML dashboard rendering |
| **Cloudflare D1** | Serverless SQL database for durable feedback storage |
| **Workers AI** | Real-time sentiment analysis of incoming feedback |
| **Workers Bindings** | Secure access to D1 and AI models from the Worker |
| **Wrangler** | Local development, schema migration, and deployment |

### High-Level Flow

#### 1. **Feedback Ingestion**
   - Clients send feedback via `POST /feedback`
   - Worker validates input
   - Workers AI performs sentiment analysis
   - Feedback is persisted in D1

#### 2. **Aggregation & Retrieval**
   - SQL queries aggregate sentiment counts
   - Filtered queries support drill-down by sentiment and keyword

#### 3. **Interactive Dashboard**
   - `/dashboard` serves an HTML UI directly from the Worker
   - KPI cards show sentiment distribution
   - Clicking cards or querying updates results dynamically

#### 4. **Natural-Language Queries**
   - `/api/insights` interprets "what happened?" questions
   - Maps intent to sentiment and keyword filters

> 💡 **Key Insight:** This architecture avoids traditional servers, ORMs, or frontend frameworks while remaining production-capable.

---

## 📊 Dashboard Capabilities

- ✅ **Sentiment Aggregation** - Real-time counts for positive, neutral, and negative feedback
- ✅ **Interactive Drill-Down** - Click sentiment cards to filter individual feedback items
- ✅ **Natural-Language Querying** - Ask questions like "show me negative feedback about bugs"
- ✅ **Real-Time Updates** - Dashboard reflects new feedback as it's ingested
- ✅ **Edge-Rendered UI** - No external frontend dependencies required

---

## 🔍 Cloudflare Product Insights

Building Pulse surfaced several meaningful friction points across the Cloudflare developer experience. These are not criticisms, but opportunities to improve developer velocity and clarity.

### 1. D1 Schema & Environment Confusion

**Friction:**
- Local D1 and remote D1 are separate databases
- Migrations must be run explicitly with `--remote`
- Errors like `no such table: feedback` are common and non-obvious

**Suggestion:**
- Add a clear schema state indicator in the Cloudflare dashboard
- Improve Wrangler output to explicitly say: *"You are querying a database without this schema in this environment"*

### 2. Wrangler UX for D1 Operations

**Friction:**
- `wrangler d1 list` returning no output initially was confusing
- SQL execution errors sometimes surfaced as generic API failures

**Suggestion:**
- Improve command feedback and defaults
- Add an interactive prompt when a command is likely targeting the wrong environment

### 3. Workers AI Model Output Ambiguity

**Friction:**
- Sentiment models return labels and scores, but interpretation is left entirely to developers
- No first-class helpers for confidence thresholds or neutral classification

**Suggestion:**
- Provide opinionated helper utilities or docs for common AI patterns
- Example: sentiment normalization helpers or recommended thresholds

### 4. Error Visibility in Production

**Friction:**
- Production failures surface as `1101` errors with limited context
- Developers must manually tail logs to understand root cause

**Suggestion:**
- Inline error hints in the Cloudflare dashboard
- Example: *"D1 query failed – missing table in remote database"*

### 5. HTML-First Dashboards Are Underrated

**Observation (Positive Insight):**
- Serving HTML directly from Workers is extremely powerful
- No Pages, no frontend build step, no CDN configuration needed

**Suggestion:**
- Promote this pattern more aggressively in Cloudflare docs
- Provide starter templates for analytics dashboards

---

## 🧩 Development Context

This project was built using a **vibe-coding** approach with [Cursor](https://cursor.sh/) as the primary coding assistant.

### How Cursor Was Used

- 🚀 Rapid iteration on Worker handlers
- 🔄 Refactoring API routes
- 🐛 Debugging D1 schema and binding issues
- 🎨 Generating and refining the dashboard UI

### Example Prompts Used

- *"Refactor this Worker to persist feedback in D1 instead of memory"*
- *"Add sentiment analysis using Workers AI"*
- *"Generate an interactive HTML dashboard with drill-down and filters"*
- *"Debug why this D1 table exists locally but not in production"*

> 💡 The combination of Cloudflare's edge platform and vibe-coding allowed the prototype to be built end-to-end in under an hour.

---

## 🔮 What Could Be Built Next

If extended, Pulse could support:

- 📈 **Time-series sentiment trends**
- 🔔 **Alerting on negative sentiment spikes**
- 🏷️ **Source-based segmentation**
- 👤 **User-level feedback attribution**
- 🔌 **Embeddable widgets for product teams**

---

## 📝 License

This project is a prototype demonstration of Cloudflare Workers capabilities.

---

*Built with ❤️ using Cloudflare Workers, D1, and Workers AI*
