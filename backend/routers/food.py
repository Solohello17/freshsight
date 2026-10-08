"""
FreshSight — Food Router
=======================
Endpoints for food scanning, inventory management, rotten food alerts,
scraper recommendations, recipe generation, and dashboard statistics.
"""

import cv2
import numpy as np
import asyncio
from datetime import datetime
from typing import List
from fastapi.concurrency import run_in_threadpool
from fastapi import APIRouter, File, UploadFile, HTTPException, BackgroundTasks
from pydantic import BaseModel

from database import get_db
from config import DEFAULT_ITEMS, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_MB
from services.detection_service import detection_service
from services.scraper_service import scraper_service, is_cache_fresh
from services.recipe_service import recipe_service

router = APIRouter(prefix="/api/food", tags=["Food"])

class RecipeRequest(BaseModel):
    dish_name: str

def compute_status(fresh_count: int, target: int) -> str:
    """Stock status of an item given its fresh count and target quantity."""
    if fresh_count == 0:
        return "OUT_OF_STOCK"
    if fresh_count < target:
        return "LOW_STOCK"
    return "IN_STOCK"


def _set_alert(db, item_name: str, alert_type: str, message: str) -> None:
    """Ensure exactly one alert of this type exists for the item, with the given message."""
    query = {"item_name": item_name, "type": alert_type}
    existing = list(db.alerts.find(query))
    if not existing:
        db.alerts.insert_one({**query, "message": message, "created_at": datetime.now().isoformat()})
        return
    keep = existing[0]
    if len(existing) > 1:
        db.alerts.delete_many({**query, "_id": {"$ne": keep["_id"]}})
    if keep.get("message") != message:
        db.alerts.update_one(
            {"_id": keep["_id"]},
            {"$set": {"message": message, "created_at": datetime.now().isoformat()}},
        )


def _clear_alerts(db, item_name: str, *alert_types: str) -> None:
    db.alerts.delete_many({"item_name": item_name, "type": {"$in": list(alert_types)}})


def _sync_item_alerts(db, name: str, status: str, rotten_count: int) -> None:
    """Keep the stock and rotten alerts of one item consistent with its current state."""
    if status == "LOW_STOCK":
        _set_alert(db, name, "LOW_STOCK", f"{name.capitalize()} stock is below target quantity")
        _clear_alerts(db, name, "OUT_OF_STOCK")
    elif status == "OUT_OF_STOCK":
        _set_alert(db, name, "OUT_OF_STOCK", f"{name.capitalize()} is out of stock")
        _clear_alerts(db, name, "LOW_STOCK")
    else:
        _clear_alerts(db, name, "LOW_STOCK", "OUT_OF_STOCK")

    if rotten_count > 0:
        verb = "appears" if rotten_count == 1 else "appear"
        _set_alert(db, name, "ROTTEN", f"{rotten_count} {name.capitalize()} {verb} rotten")
    else:
        _clear_alerts(db, name, "ROTTEN")


def sync_inventory_status(db):
    """
    Recomputes status and current_quantity for every tracked item from the latest
    scan's fresh counts, and keeps low/out-of-stock and rotten alerts in step.
    """
    latest_scan = db.inventory.find_one(sort=[("scan_time", -1)])
    fresh_by_item, rotten_by_item = {}, {}
    if latest_scan:
        for item in latest_scan.get("items", []):
            fresh_by_item[item["name"]] = item.get("fresh_count", 0)
            rotten_by_item[item["name"]] = item.get("rotten_count", 0)

    # Targets: config defaults, overridden by whatever is stored in the database
    targets = dict(DEFAULT_ITEMS)
    for doc in db.default_items.find():
        targets[doc["item_name"]] = doc.get("default_quantity", 0)

    for raw_name, target in targets.items():
        name = raw_name.lower().strip()
        # An item missing from the latest scan is not in the fridge
        fresh_count = fresh_by_item.get(name, 0)
        status = compute_status(fresh_count, target)

        db.default_items.update_one(
            {"item_name": name},
            {"$set": {
                "item_name": name,
                "default_quantity": target,
                "current_quantity": fresh_count,
                "status": status,
            }},
            upsert=True,
        )
        _sync_item_alerts(db, name, status, rotten_by_item.get(name, 0))


# Keep references to background scrape tasks so they are not garbage-collected mid-run
_background_tasks: set = set()


def _spawn_scrape(item_name: str) -> None:
    task = asyncio.create_task(scraper_service.scrape_item(item_name))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


@router.post("/scan-food")
async def scan_food(file: UploadFile = File(...)):
    """
    Receives a single image, runs YOLO object detection and MobileNetV3 crop classification,
    compares with default inventory, triggers background scraper for out-of-stock items,
    saves alerts, and returns scan summary along with a base64-annotated image.
    """
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload a JPEG, PNG, WebP or BMP image.")
    max_bytes = MAX_UPLOAD_MB * 1024 * 1024
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Image is too large (limit {MAX_UPLOAD_MB} MB).")

    try:
        nparr = np.frombuffer(content, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    # Run inference (YOLO + Freshness CNN)
    try:
        scan_results, annotated_b64 = await run_in_threadpool(detection_service.run_inference, img)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Detection pipeline failed: {str(e)}")

    db = get_db()

    # Save scan to inventory collection
    db.inventory.insert_one(dict(scan_results))

    # Inventory Comparison Logic & Automatic Scraper Trigger
    for item in scan_results["items"]:
        name = item["name"]
        fresh_count = item["fresh_count"]
        
        # Fetch matching default item
        default_item = db.default_items.find_one({"item_name": name})
        def_qty = default_item.get("default_quantity", 0) if default_item else DEFAULT_ITEMS.get(name, 0)
        
        status = compute_status(fresh_count, def_qty)

        # Trigger background scraper task if status is LOW_STOCK or OUT_OF_STOCK
        if status != "IN_STOCK":
            print(f"[FoodRouter] Item '{name}' is low/out of stock. Triggering scraper...")
            _spawn_scrape(name)

    # Centralized sync of inventory statuses, quantities, and alerts
    sync_inventory_status(db)

    return {
        "success": True,
        "scan_time": scan_results["scan_time"],
        "items": scan_results["items"],
        "annotated_image": annotated_b64
    }

@router.post("/generate-recipe")
async def generate_recipe(payload: RecipeRequest):
    """
    Generates recipe instructions, list of available ingredients,
    and missing ingredients needed using Gemini API.
    """
    try:
        recipe = await recipe_service.generate_recipe(payload.dish_name)
        return recipe
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard-stats")
async def get_dashboard_stats():
    """
    Returns counts for Total items, Fresh items, Rotten items,
    and Out of stock items.
    """
    db = get_db()
    sync_inventory_status(db)
    latest_scan = db.inventory.find_one(sort=[("scan_time", -1)])
    
    total_items = 0
    fresh_items = 0
    rotten_items = 0

    if latest_scan:
        for item in latest_scan.get("items", []):
            total_items += item.get("count", 0)
            fresh_items += item.get("fresh_count", 0)
            rotten_items += item.get("rotten_count", 0)
    
    low_stock = db.default_items.count_documents({"status": "LOW_STOCK"})
    out_of_stock = db.default_items.count_documents({"status": "OUT_OF_STOCK"})

    return {
        "total_items": total_items,
        "fresh_items": fresh_items,
        "rotten_items": rotten_items,
        "low_stock_items": low_stock,
        "out_of_stock_items": out_of_stock
    }

@router.get("/inventory")
async def get_inventory():
    """
    Returns the comprehensive list of default_items enriched with
    current scan numbers.
    """
    db = get_db()
    sync_inventory_status(db)
    items = list(db.default_items.find({}, {"_id": 0}))

    # Get latest scan details for fresh/rotten counts
    latest_scan = db.inventory.find_one(sort=[("scan_time", -1)])
    scan_detail = {}
    if latest_scan:
        for item in latest_scan.get("items", []):
            scan_detail[item["name"]] = {
                "fresh_count": item.get("fresh_count", 0),
                "rotten_count": item.get("rotten_count", 0)
            }

    # Enrich each default item
    for item in items:
        name = item["item_name"]
        detail = scan_detail.get(name, {"fresh_count": 0, "rotten_count": 0})
        item["fresh_count"] = detail["fresh_count"]
        item["rotten_count"] = detail["rotten_count"]

    return items

@router.get("/scan-history")
async def get_scan_history(limit: int = 10):
    """Returns summaries of the most recent scans, newest first."""
    db = get_db()
    limit = max(1, min(limit, 50))
    scans = db.inventory.find({}, {"_id": 0, "scan_time": 1, "items": 1}).sort("scan_time", -1).limit(limit)
    return list(scans)

@router.get("/alerts")
async def get_alerts():
    """Returns list of rotten food alerts, sorted by latest."""
    db = get_db()
    alerts = list(db.alerts.find({}, {"_id": 0}).sort("created_at", -1))
    return alerts

@router.get("/recommendations")
async def get_recommendations():
    """Returns shopping recommendations from the database scraper cache."""
    db = get_db()
    sync_inventory_status(db)
    
    # Find all items that are LOW_STOCK or OUT_OF_STOCK
    low_or_out_items = list(db.default_items.find({"status": {"$in": ["LOW_STOCK", "OUT_OF_STOCK"]}}))
    active_names = [item["item_name"] for item in low_or_out_items]
    
    # For any low/out of stock item, if there is no cache in db.scrape_results, trigger scraping!
    for name in active_names:
        cache = db.scrape_results.find_one({"item_name": name})
        if not is_cache_fresh(cache):
            print(f"[Recommendations] No fresh live cache for low/out-of-stock item '{name}'. Running live scrape...")
            await scraper_service.scrape_item(name)
            
    # Now return all recommendations that match low or out of stock items
    recommendations = list(db.scrape_results.find({"item_name": {"$in": active_names}}, {"_id": 0}))
    return recommendations

@router.get("/recommendations/{item_name}")
async def get_item_recommendations(item_name: str):
    """
    Returns shopping recommendations for a specific item.
    Triggers live scraper if cache is empty.
    """
    db = get_db()
    item_lower = item_name.lower().strip()
    res = db.scrape_results.find_one({"item_name": item_lower}, {"_id": 0})
    if not is_cache_fresh(res):
        # Trigger scraper synchronously to return results immediately
        res = await scraper_service.scrape_item(item_lower)
        if "_id" in res:
            res.pop("_id")
    return res

class DefaultItemPayload(BaseModel):
    item_name: str
    default_quantity: int

@router.post("/default-item")
async def add_or_update_default_item(payload: DefaultItemPayload):
    db = get_db()
    name = payload.item_name.lower().strip()
    qty = payload.default_quantity
    
    if not name:
        raise HTTPException(status_code=400, detail="Item name cannot be empty")
    if qty < 0:
        raise HTTPException(status_code=400, detail="Default quantity cannot be negative")

    # Upsert in default_items
    db.default_items.update_one(
        {"item_name": name},
        {"$set": {
            "item_name": name,
            "default_quantity": qty
        }},
        upsert=True
    )
    
    # Sync statuses and alerts after modification
    sync_inventory_status(db)
    
    return {"success": True, "message": f"Successfully updated '{name}' with target quantity {qty}"}

@router.delete("/default-item/{item_name}")
async def delete_default_item(item_name: str):
    db = get_db()
    name = item_name.lower().strip()
    
    # Delete from default_items
    res = db.default_items.delete_one({"item_name": name})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Item '{name}' not found in default inventory")
        
    # Also delete associated alerts and scrape results
    db.alerts.delete_many({"item_name": {"$regex": f"^{name}$", "$options": "i"}})
    db.scrape_results.delete_many({"item_name": name})
    
    # Sync after deletion
    sync_inventory_status(db)
    
    return {"success": True, "message": f"Successfully deleted '{name}' from default inventory"}
