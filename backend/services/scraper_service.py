"""
FreshSight — Scraper Service
===========================
Executes search aggregations across Blinkit, Instamart, DMart, JioMart.
Formats output and provides an automatic mock fallback if the scrapers fail,
are blocked by bot detection, or if Chromium is unavailable.
"""

import asyncio
import re
from datetime import datetime, timedelta
from database import get_db
from scrapers.search_all import search_all

# Pre-defined mock data for rapid fallback or to augment results
MOCK_PRODUCTS = {
    "apple": [
        {"platform": "Blinkit", "price": 118, "product_name": "Fresh Red Apple (4 pcs)"},
        {"platform": "DMart", "price": 120, "product_name": "Shimla Apple (4 pcs)"},
        {"platform": "Instamart", "price": 122, "product_name": "Washington Apple (4 pcs)"}
    ],
    "banana": [
        {"platform": "Blinkit", "price": 45, "product_name": "Fresh Banana (6 pcs)"},
        {"platform": "DMart", "price": 47, "product_name": "Organic Banana (6 pcs)"},
        {"platform": "Instamart", "price": 49, "product_name": "Robusta Banana (6 pcs)"}
    ],
    "orange": [
        {"platform": "Blinkit", "price": 98, "product_name": "Nagpur Orange (1 kg)"},
        {"platform": "DMart", "price": 99, "product_name": "Imported Malta Orange (1 kg)"},
        {"platform": "Instamart", "price": 105, "product_name": "Kinnow Orange (1 kg)"}
    ]
}


# Words that mark a result as not being fresh produce / the grocery item requested
NON_FOOD_WORDS = {
    "cable", "adapter", "charger", "charging", "airpods", "earpods", "iphone", "ipad", "watch",
    "pencil", "mouse", "airtag", "usb", "case", "cover", "candle", "tealight", "aromas",
    "vinegar", "tablet", "tablets", "capsule", "shampoo", "soap", "detergent", "perfume",
    "juice", "drink", "fizz", "soda", "sparkling", "frozen", "peas", "corn", "oil", "ghee",
    "honey", "jam", "chips", "biscuit", "cookies", "ketchup", "sauce", "pickle", "squash",
    "syrup", "powder", "flavoured", "flavored", "essence", "pie", "cake", "candy",
    "biscuit", "biscuits", "wafer", "wafers", "cream", "oats", "almond", "almonds", "pouch",
    "bag", "wallet", "maida", "chocolate", "bar", "mix", "snack", "snacks", "namkeen",
    "noodles", "tea", "coffee", "wash", "cleaner", "spray", "freshener", "toothpaste",
    "lotion", "gel", "face", "hair", "dried", "dry", "freeze", "jelly", "ice", "yogurt",
    "curd", "milk", "bread", "rusk", "tonic", "extract", "seeds", "masala", "bottle",
    "jacket", "safety", "shirt", "tshirt", "socks", "shoes", "helmet", "nails", "press", "utility", "bite", "bites", "toffee", "mint", "tic", "tac", "gum",
}
MAX_NAME_WORDS = 7  # real produce listings are short; packaged goods have long names
MAX_REASONABLE_PRICE = 1000  # rupees; guards against electronics etc.
CACHE_TTL_HOURS = 6
MOCK_RETRY_MINUTES = 10
SCRAPE_TIMEOUT_SECONDS = 60.0


def _is_relevant(item: dict, query: str) -> bool:
    """True if a scraped result looks like the requested grocery item."""
    name = (item.get("name") or "").lower()
    price = item.get("price")
    if not name or not price or price > MAX_REASONABLE_PRICE:
        return False
    words = set(re.findall(r"[a-z]+", name))
    if len(re.findall(r"[a-z]+", re.sub(r"\([^)]*\)", "", name))) > MAX_NAME_WORDS:
        return False
    q = query.lower().strip()
    q_stems = {q, q + "s", q + "es"}
    if not (words & q_stems):
        return False
    if words & NON_FOOD_WORDS:
        return False
    # Positive produce signal: "fresh", a variety/Hindi name in brackets, or sold by piece/kg
    has_signal = (
        "fresh" in words
        or bool(re.search(r"\([^)]+\)", name))
        or bool(re.search(r"\d\s*(?:pieces?|pcs?|kg)", name))
    )
    return has_signal


def is_cache_fresh(doc: dict) -> bool:
    """A cached entry is usable only if it came from a live scrape and isn't stale."""
    if not doc:
        return False
    try:
        age = datetime.now() - datetime.fromisoformat(doc["updated_at"])
    except Exception:
        return False
    if doc.get("source") == "live":
        return age < timedelta(hours=CACHE_TTL_HOURS)
    # Mock results (or legacy entries with no source) are retried after a short pause
    return doc.get("source") == "mock" and age < timedelta(minutes=MOCK_RETRY_MINUTES)


_scrape_lock = asyncio.Lock()


class ScraperService:
    async def scrape_item(self, item_name: str) -> dict:
        """
        Runs search_all to fetch real products, filters the top 3 cheapest,
        and saves them to the scrape_results collection.
        If it fails or returns nothing, it falls back to mock data.
        """
        item_lower = item_name.lower().strip()
        print(f"[ScraperService] Triggered scrape for: {item_lower}")

        recommendations = []
        source = "live"

        try:
            # Run the scraper aggregator (browsers need ~30s for all platforms)
            print(f"[ScraperService] Launching search_all for '{item_lower}'...")
            async with _scrape_lock:  # one browser batch at a time
                scrape_task = search_all(query=item_lower, max_results=30)
                results = await asyncio.wait_for(scrape_task, timeout=SCRAPE_TIMEOUT_SECONDS)

            all_items = results.get("all_results", [])
            if all_items:
                # Filter out items with no price and sort by price
                valid_items = [x for x in all_items if _is_relevant(x, item_lower)]
                valid_items.sort(key=lambda x: x["price"])

                # Select top 3 cheapest unique platform recommendations
                # (Try to get different platforms if possible)
                seen_platforms = set()
                for item in valid_items:
                    platform = item.get("platform", "Unknown")
                    if platform not in seen_platforms:
                        recommendations.append({
                            "platform": platform,
                            "price": float(item["price"]),
                            "product_name": item.get("name", item_name.capitalize())
                        })
                        seen_platforms.add(platform)
                        if len(recommendations) >= 3:
                            break

                # If we don't have 3 but have valid items, add others
                if len(recommendations) < 3:
                    for item in valid_items:
                        rec = {
                            "platform": item.get("platform", "Unknown"),
                            "price": float(item["price"]),
                            "product_name": item.get("name", item_name.capitalize())
                        }
                        if rec not in recommendations:
                            recommendations.append(rec)
                            if len(recommendations) >= 3:
                                break

        except asyncio.TimeoutError:
            print(f"[ScraperService] Real scraping timed out for '{item_lower}' after {SCRAPE_TIMEOUT_SECONDS:.0f} seconds.")
        except Exception as e:
            print(f"[ScraperService] Real scraping failed for '{item_lower}': {e}")

        # Fallback to Mock Data if no recommendations were gathered
        if not recommendations:
            source = "mock"
            print(f"[ScraperService] Returning mock fallback results for '{item_lower}'")
            if item_lower in MOCK_PRODUCTS:
                recommendations = [dict(m) for m in MOCK_PRODUCTS[item_lower]]
            else:
                # Dynamic mock fallback
                recommendations = [
                    {"platform": "Blinkit", "price": 60.0, "product_name": f"Fresh {item_name.capitalize()}"},
                    {"platform": "DMart", "price": 62.0, "product_name": f"Premium {item_name.capitalize()}"},
                    {"platform": "Instamart", "price": 65.0, "product_name": f"Organic {item_name.capitalize()}"}
                ]

        # Sort recommendations by price ascending
        recommendations.sort(key=lambda x: x["price"])

        # Save to database
        db = get_db()
        db.scrape_results.update_one(
            {"item_name": item_lower},
            {
                "$set": {
                    "item_name": item_lower,
                    "recommendations": recommendations,
                    "source": source,
                    "updated_at": datetime.now().isoformat()
                }
            },
            upsert=True
        )

        print(f"[ScraperService] Scrape completed for '{item_lower}'. Recommendations stored: {len(recommendations)}")
        return {
            "item_name": item_lower,
            "recommendations": recommendations,
            "source": source
        }

# Singleton instance
scraper_service = ScraperService()
