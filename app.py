import os
import datetime
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# Simple in-memory cache to store release notes
# Holds 'data', 'last_fetched', and 'source' info
_feed_cache = {
    "data": None,
    "last_fetched": None
}

def parse_atom_feed(xml_content):
    """Parses Google Cloud Atom feed into structured list of release entries."""
    root = ET.fromstring(xml_content)
    entries = []
    
    # Atom namespace
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    
    for entry in root.findall("atom:entry", ns):
        title_node = entry.find("atom:title", ns)
        id_node = entry.find("atom:id", ns)
        updated_node = entry.find("atom:updated", ns)
        
        # Link elements might have different rel attributes
        link_node = entry.find("atom:link[@rel='alternate']", ns)
        if link_node is None:
            link_node = entry.find("atom:link", ns)
            
        content_node = entry.find("atom:content", ns)
        
        title = title_node.text.strip() if title_node is not None and title_node.text else ""
        entry_id = id_node.text.strip() if id_node is not None and id_node.text else ""
        updated_str = updated_node.text.strip() if updated_node is not None and updated_node.text else ""
        link = link_node.attrib.get("href", "") if link_node is not None else ""
        content = content_node.text.strip() if content_node is not None and content_node.text else ""
        
        entries.append({
            "id": entry_id,
            "title": title,
            "updated": updated_str,
            "link": link,
            "content": content
        })
        
    return entries

def fetch_and_cache_feed(force_refresh=False):
    """Fetches feed from Google, caching it for 10 minutes by default."""
    now = datetime.datetime.utcnow()
    
    # Check cache validity (10 minutes = 600 seconds)
    if not force_refresh and _feed_cache["data"] and _feed_cache["last_fetched"]:
        age = (now - _feed_cache["last_fetched"]).total_seconds()
        if age < 600:
            return _feed_cache["data"], "cache", _feed_cache["last_fetched"].isoformat()
            
    try:
        # Fetch with headers to mimic a normal browser request
        req = urllib.request.Request(
            FEED_URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_content = response.read()
            
        entries = parse_atom_feed(xml_content)
        
        # Save to cache
        _feed_cache["data"] = entries
        _feed_cache["last_fetched"] = now
        return entries, "network", now.isoformat()
        
    except Exception as e:
        print(f"Error fetching or parsing feed: {e}")
        # Return stale cache if available, otherwise propagate error
        if _feed_cache["data"]:
            return _feed_cache["data"], "stale_cache_fallback", _feed_cache["last_fetched"].isoformat()
        raise e

@app.route("/")
def index():
    """Renders the main dashboard page."""
    return render_template("index.html")

@app.route("/api/releases")
def get_releases():
    """API endpoint to fetch BigQuery release notes.
    Query parameters:
      - refresh=true: forces fetching fresh data from the source.
    """
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    try:
        data, source, fetched_at = fetch_and_cache_feed(force_refresh=force_refresh)
        return jsonify({
            "success": True,
            "source": source,
            "fetched_at": fetched_at,
            "count": len(data),
            "releases": data
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    # Use environment variables for host and port, default to 5000
    host = os.environ.get("FLASK_HOST", "127.0.0.1")
    port = int(os.environ.get("FLASK_PORT", 5000))
    app.run(host=host, port=port, debug=True)
