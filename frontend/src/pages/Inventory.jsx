import React, { useState, useEffect } from 'react';
import { RefreshCw, Refrigerator, AlertTriangle, CheckCircle, PackageSearch } from 'lucide-react';
import { API_BASE } from '../api';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // CRUD States
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/food/inventory`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error("Error fetching inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/api/food/default-item`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          item_name: newItemName.trim().toLowerCase(),
          default_quantity: newItemQty
        })
      });
      if (res.ok) {
        setNewItemName("");
        setNewItemQty(1);
        fetchInventory();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to save item target.");
      }
    } catch (err) {
      console.error("Error saving default item:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemName) => {
    if (!window.confirm(`Are you sure you want to stop tracking target quantities for "${itemName}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/food/default-item/${itemName}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchInventory();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete item.");
      }
    } catch (err) {
      console.error("Error deleting default item:", err);
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Fridge <span className="text-purple-400">Inventory</span>
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Current stock counts matched against target thresholds.
          </p>
        </div>
        <button
          onClick={fetchInventory}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 py-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* CRUD Form: Manage Default Targets */}
      <div className="glass-panel p-6 rounded-2xl border-gray-800 bg-gradient-to-br from-gray-950/20 to-transparent">
        <h3 className="text-base font-bold text-white mb-3">Manage Default Target Quantities</h3>
        <form onSubmit={handleSaveItem} className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Item Name</label>
            <input
              type="text"
              placeholder="e.g. apple, cheese, milk"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full bg-gray-950/60 border border-gray-800 focus:border-purple-500 rounded-xl py-2 px-3 text-sm text-white focus:outline-none transition-all duration-300"
              required
            />
          </div>
          <div className="space-y-1.5 w-32">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Target Qty</label>
            <input
              type="number"
              min="0"
              value={newItemQty}
              onChange={(e) => setNewItemQty(parseInt(e.target.value) || 0)}
              className="w-full bg-gray-950/60 border border-gray-800 focus:border-purple-500 rounded-xl py-2 px-3 text-sm text-white focus:outline-none transition-all duration-300 text-center font-mono font-semibold"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !newItemName.trim()}
            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold font-mono transition-all duration-300 disabled:opacity-50"
          >
            {submitting ? 'SAVING...' : 'SAVE TARGET'}
          </button>
        </form>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-500">
            <RefreshCw className="w-10 h-10 animate-spin text-purple-500 mb-4" />
            <p className="font-semibold">Loading current stock levels...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-gray-500 text-center">
            <Refrigerator className="w-12 h-12 text-gray-700 mb-4" />
            <p className="font-semibold text-lg">No Inventory Data Available</p>
            <p className="text-sm text-gray-600 mt-1 max-w-[280px]">
              Perform a food scan from the dashboard to populate the inventory levels.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/40 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="py-4 px-6">Item</th>
                  <th className="py-4 px-6 text-center">Current Quantity</th>
                  <th className="py-4 px-6 text-center">Default Target</th>
                  <th className="py-4 px-6 text-center">Fresh Count</th>
                  <th className="py-4 px-6 text-center">Rotten Count</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950/20">
                {items.map((item, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-gray-900/20 transition-colors">
                      <td className="py-4 px-6 capitalize font-bold text-white flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-900 border border-gray-850 rounded-lg flex items-center justify-center text-purple-400 font-mono">
                          {item.item_name[0].toUpperCase()}
                        </div>
                        {item.item_name}
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-base font-semibold text-gray-100">
                        {item.current_quantity}
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-gray-400">
                        {item.default_quantity}
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-emerald-400 font-semibold">
                        {item.fresh_count}
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-rose-400 font-semibold">
                        {item.rotten_count}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                          item.status === "OUT_OF_STOCK" 
                            ? 'bg-rose-950/40 text-rose-400 border-rose-500/20' 
                            : item.status === "LOW_STOCK"
                            ? 'bg-amber-950/40 text-amber-400 border-amber-500/20'
                            : 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {item.status === "OUT_OF_STOCK" ? (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              OUT OF STOCK
                            </>
                          ) : item.status === "LOW_STOCK" ? (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              LOW STOCK
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              IN STOCK
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => {
                              setNewItemName(item.item_name);
                              setNewItemQty(item.default_quantity);
                            }}
                            className="px-2.5 py-1 bg-gray-900 hover:bg-purple-950/30 border border-gray-800 hover:border-purple-500/35 text-purple-400 rounded-lg text-xs font-bold transition-all duration-300 font-mono"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.item_name)}
                            className="px-2.5 py-1 bg-gray-900 hover:bg-rose-950/30 border border-gray-800 hover:border-rose-500/35 text-rose-400 rounded-lg text-xs font-bold transition-all duration-300 font-mono"
                          >
                            DELETE
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
