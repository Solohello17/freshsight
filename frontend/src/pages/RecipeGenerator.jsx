import React, { useState } from 'react';
import { ChefHat, Search, Loader2, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react';
import { API_BASE } from '../api';

export default function RecipeGenerator() {
  const [dishName, setDishName] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!dishName.trim()) return;

    setLoading(true);
    setErrorMsg("");
    setRecipe(null);

    try {
      const res = await fetch(`${API_BASE}/api/food/generate-recipe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ dish_name: dishName.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to generate recipe.");
      }

      setRecipe(data);
    } catch (err) {
      setErrorMsg(err.message || "An error occurred while communicating with Gemini API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
          AI <span className="text-purple-400">Recipe</span> Generator
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Gemini-powered cooking ideas matching current fridge ingredients.
        </p>
      </div>

      {/* Input panel */}
      <div className="glass-panel p-6 rounded-2xl">
        <form onSubmit={handleGenerate} className="flex gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="What do you want to cook? (e.g. Fruit Salad, Mashed Potatoes, Tomato Soup...)"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              className="w-full bg-gray-950/60 border border-gray-800 focus:border-purple-500 rounded-xl py-3 px-4 pl-12 text-sm text-white focus:outline-none transition-all duration-300 font-medium"
            />
            <ChefHat className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
          </div>
          <button
            type="submit"
            disabled={loading || !dishName.trim()}
            className="btn-primary bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-50 py-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Querying Gemini...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Generate
              </>
            )}
          </button>
        </form>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-950/30 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Recipe Display */}
      {recipe && (
        <div className="space-y-8 animate-fade-in">
          <div className="glass-panel p-8 rounded-3xl border-purple-500/10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-950/40 border border-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400">
                <ChefHat className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white capitalize">{recipe.dish}</h2>
                <p className="text-xs text-purple-400 font-mono tracking-wider uppercase font-semibold">Gemini API Custom Chef Recommendation</p>
              </div>
            </div>

            {/* Ingredients Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Available */}
              <div className="bg-emerald-950/10 border border-emerald-500/10 rounded-2xl p-5">
                <h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Available in Fridge
                </h4>
                <ul className="space-y-2">
                  {recipe.available_ingredients.map((ing, i) => (
                    <li key={i} className="text-sm text-gray-300 capitalize flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {ing}
                    </li>
                  ))}
                  {recipe.available_ingredients.length === 0 && (
                    <li className="text-sm text-gray-500 italic">No available ingredients.</li>
                  )}
                </ul>
              </div>

              {/* Missing */}
              <div className="bg-amber-950/10 border border-amber-500/10 rounded-2xl p-5">
                <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  Missing Ingredients
                </h4>
                <ul className="space-y-2">
                  {recipe.missing_ingredients.map((ing, i) => (
                    <li key={i} className="text-sm text-gray-300 capitalize flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      {ing}
                    </li>
                  ))}
                  {recipe.missing_ingredients.length === 0 && (
                    <li className="text-sm text-gray-500 italic">No missing ingredients. You have everything!</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Cooking steps */}
            <div className="space-y-4 pt-4 border-t border-gray-900">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-purple-400" />
                Cooking Steps
              </h3>
              <div className="space-y-4">
                {recipe.recipe_steps.map((step, idx) => (
                  <div key={idx} className="flex gap-4 p-4 bg-gray-950/40 border border-gray-900 rounded-xl">
                    <span className="font-mono text-purple-400 font-bold text-sm bg-purple-950/30 border border-purple-500/15 w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-sm text-gray-300 leading-relaxed">{step.replace(/^Step \d+:\s*/i, "")}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
