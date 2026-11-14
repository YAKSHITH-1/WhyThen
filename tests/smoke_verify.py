import httpx
import sys

client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=30.0)

try:
    # 1. Health
    r = client.get("/health")
    print("=== 1. HEALTH ===", r.status_code, r.json())

    # 2. Dashboard
    r = client.get("/api/dashboard/summary")
    data = r.json()
    print("=== 2. DASHBOARD ===", r.status_code, "Total docs:", data["total_documents"], "Total chunks:", data["total_chunks"])
    for doc in data["recent_documents"]:
        print(f"   Doc: {doc['title'] or doc['filename']} | Date: {doc['document_date']}")

    # 3. Search
    r = client.post("/api/search", json={"text": "Streamlit React migration"})
    print("=== 3. SEARCH ===", r.status_code, "Found citations:", len(r.json()))
    for c in r.json()[:3]:
        print(f"   Cite: {c['title']} | Heading: {c['heading']} | Score: {c['score']}")

    # 4. Decision Timeline for Database
    r_db = client.get("/api/decisions/timeline?topic=Database")
    print("=== 4. TIMELINE (Database) ===", r_db.status_code, "Summary:", r_db.json()["summary"])
    for item in r_db.json()["timeline"]:
        print(f"  * {item['event_date']} | {item['status_or_relation']} | {item['decision']}")

    # 5. Decision Timeline for Frontend
    r_fe = client.get("/api/decisions/timeline?topic=Frontend")
    print("=== 5. TIMELINE (Frontend) ===", r_fe.status_code)
    for item in r_fe.json()["timeline"]:
        print(f"  * {item['event_date']} | {item['status_or_relation']} | {item['decision']}")

    # 6. Ask QA
    r_ask = client.post("/api/ask", json={"question": "Why did we choose SQLite and ChromaDB?"})
    print("=== 6. ASK QA ===", r_ask.status_code)
    print("   Coverage:", r_ask.json()["coverage"])
    print("   Answer excerpt:", r_ask.json()["answer"][:250], "...")
    print("   Citations count:", len(r_ask.json()["sources"]))

    # 7. Production SPA fallback
    r_spa = client.get("/sources")
    print("=== 7. SPA ROUTE /sources ===", r_spa.status_code, "Has HTML root:", 'id="root"' in r_spa.text)

except Exception as e:
    print("Smoke test failed with error:", e)
    sys.exit(1)
