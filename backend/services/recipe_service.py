"""
FreshSight — Recipe Service
==========================
Uses Gemini API to generate recipes based on available ingredients
in the fridge inventory and a target dish name. Includes clean mocks
for offline testing and robustness.
"""

import os
import json
import google.generativeai as genai
from config import GEMINI_API_KEY
from database import get_db

# Mock Recipes for common requests to ensure seamless offline demo
MOCK_RECIPES = {
    "fruit salad": {
        "dish": "Fruit Salad",
        "available_ingredients": ["apple", "banana", "orange"],
        "missing_ingredients": ["honey", "mint leaves", "yogurt"],
        "recipe_steps": [
            "Step 1: Peel and slice the bananas and oranges into bite-sized pieces.",
            "Step 2: Wash the apples thoroughly, core them, and chop them into matching chunks.",
            "Step 3: Combine all chopped fruits in a large salad bowl.",
            "Step 4: Drizzle honey and yogurt over the fruit mixture.",
            "Step 5: Toss gently to coat and garnish with fresh mint leaves. Serve chilled."
        ]
    }
}

class RecipeService:
    def __init__(self):
        # Read API key from env/config
        self.api_key = GEMINI_API_KEY
        if self.api_key and "your_gemini" not in self.api_key.lower():
            genai.configure(api_key=self.api_key)
            self.configured = True
        else:
            self.configured = False
            print("[RecipeService] GEMINI_API_KEY is not configured. Falling back to local recipe generator.")

    def get_latest_inventory_items(self) -> list:
        """Fetch item names from the latest inventory scan that are in stock."""
        db = get_db()
        # Get latest inventory scan sorted by scan_time descending
        latest = db.inventory.find_one(sort=[("scan_time", -1)])
        if not latest:
            return []

        # Find items with positive count
        in_stock = []
        for item in latest.get("items", []):
            if item.get("count", 0) > 0 and item.get("fresh_count", 0) > 0:
                in_stock.append(item["name"])

        return in_stock

    def get_fallback_recipe(self, dish_name: str, available: list) -> dict:
        """Generate a realistic mock recipe based on the dish name and available items."""
        dish_lower = dish_name.lower().strip()
        
        # Check direct mock database first
        if dish_lower in MOCK_RECIPES:
            recipe = dict(MOCK_RECIPES[dish_lower])
            # Intersect with what's actually available
            recipe["available_ingredients"] = [x for x in recipe["available_ingredients"] if x in available]
            return recipe

        # Dynamic mock generation if not in the mock database
        available_found = []
        possible_missing = ["milk", "salt", "spices", "cooking oil", "butter", "cheese"]

        # Check if any inventory item matches
        for item in available:
            if item in dish_lower:
                available_found.append(item)

        # Standard items to include
        for item in ["apple", "banana", "orange"]:
            if item in available and item not in available_found:
                # Offer fridge fruit as optional helper ingredients
                available_found.append(item)

        # Create basic steps
        steps = [
            f"Step 1: Prep your ingredients. Gather {', '.join(available_found) if available_found else 'your base ingredients'}.",
            f"Step 2: Chop and sauté any any aromatics if making a savory dish.",
            f"Step 3: Combine with seasonings and simmer over medium heat.",
            f"Step 4: Plate the {dish_name} and enjoy hot!"
        ]

        return {
            "dish": dish_name,
            "available_ingredients": available_found,
            "missing_ingredients": possible_missing,
            "recipe_steps": steps
        }

    async def generate_recipe(self, dish_name: str) -> dict:
        """
        Query Gemini API for recipe using available fridge items.
        Falls back to local mock generator if configured key fails or is missing.
        """
        available = self.get_latest_inventory_items()
        print(f"[RecipeService] Current inventory in fridge: {available}")

        if not self.configured:
            return self.get_fallback_recipe(dish_name, available)

        prompt = f"""
You are a chef planning a meal. Generate a recipe for: "{dish_name}"
Based on the available ingredients in the fridge: {available}

You must return a JSON response with the exact structure below. Do not include markdown formatting or blocks.
{{
  "dish": "{dish_name}",
  "available_ingredients": [list of ingredients needed for this dish that are present in the available ingredients list],
  "missing_ingredients": [list of other ingredients needed for this dish that are NOT present in the available ingredients list],
  "recipe_steps": [
     "Step 1: ...",
     "Step 2: ...",
     "Step 3: ..."
  ]
}}
"""
        try:
            # Query Gemini model
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            text = response.text.strip()
            
            # Clean possible markdown wrap
            if text.startswith("```"):
                lines = text.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].strip() == "```":
                    lines = lines[:-1]
                text = "\n".join(lines).strip()

            data = json.loads(text)
            
            # Basic validation of keys
            for key in ["dish", "available_ingredients", "missing_ingredients", "recipe_steps"]:
                if key not in data:
                    raise KeyError(f"Missing key: {key}")

            return data

        except Exception as e:
            print(f"[RecipeService] Gemini generation failed: {e}. Falling back to mock recipe.")
            return self.get_fallback_recipe(dish_name, available)

# Singleton instance
recipe_service = RecipeService()
