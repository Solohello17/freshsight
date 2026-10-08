import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RefreshCw, ShoppingCart, TrendingDown, ShoppingBag, ArrowLeft, BadgeAlert } from 'lucide-react';
import { API_BASE } from '../api';

export default function SmartShopping() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract target item from search params if opened from Auto Buy
  const queryParams = new URLSearchParams(location.search);
  const targetItem = queryParams.get('item');

  const [recommendations, setRecommendations] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customQuantities, setCustomQuantities] = useState({});

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch inventory levels to calculate needed quantities (e.g. Target - Current = Needed)
      const invRes = await fetch(`${API_BASE}/api/food/inventory`);
      let invMap = {};
      if (invRes.ok) {
        const invData = await invRes.json();
        setInventory(invData);
        invData.forEach(item => {
          invMap[item.item_name] = item;
        });
      }

      // 2. Fetch recommendations
      const url = targetItem 
        ? `${API_BASE}/api/food/recommendations/${targetItem.toLowerCase().trim()}`
        : `${API_BASE}/api/food/recommendations`;

      const recRes = await fetch(url);
      if (recRes.ok) {
        const recData = await recRes.json();
        let finalRecs = [];
        if (targetItem) {
          finalRecs = (recData && recData.recommendations) ? [recData] : [];
        } else {
          finalRecs = recData;
        }
        setRecommendations(finalRecs);

        // Initialize quantities based on gaps
        const initialQuants = {};
        finalRecs.forEach(group => {
          const invItem = invMap[group.item_name];
          const gap = invItem ? (invItem.default_quantity - invItem.current_quantity) : 1;
          initialQuants[group.item_name] = gap > 0 ? gap : 1;
        });
        setCustomQuantities(initialQuants);
      }
    } catch (err) {
      console.error("Error fetching shopping data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [targetItem]);

  const handleIncrement = (itemName) => {
    setCustomQuantities(prev => ({
      ...prev,
      [itemName]: (prev[itemName] || 1) + 1
    }));
  };

  const handleDecrement = (itemName) => {
    setCustomQuantities(prev => ({
      ...prev,
      [itemName]: Math.max(1, (prev[itemName] || 1) - 1)
    }));
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Smart <span className="text-amber-400">Shopping</span> List
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {targetItem 
              ? `Auto Buy matches for item: ${targetItem.toUpperCase()}`
              : "Automated price comparisons for items currently below stock threshold."
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {targetItem && (
            <button
              onClick={() => navigate('/shopping')}
              className="btn-secondary flex items-center gap-2 py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              View All Low Stock
            </button>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 py-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel p-20 rounded-2xl flex flex-col items-center justify-center text-gray-500">
          <RefreshCw className="w-10 h-10 animate-spin text-amber-500 mb-4" />
          <p className="font-semibold">Comparing vendor prices...</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="glass-panel p-20 rounded-2xl flex flex-col items-center justify-center text-gray-500 text-center">
          <ShoppingCart className="w-12 h-12 text-gray-700 mb-4" />
          <p className="font-semibold text-lg text-white">
            {targetItem ? `No Vendor Offers for "${targetItem}"` : "All Stock Levels Normal"}
          </p>
          <p className="text-sm text-gray-500 mt-1 max-w-[300px]">
            {targetItem 
              ? "We couldn't locate any active offers. Make sure the item name is correct."
              : "No items are out of stock. When a scan reports quantities below threshold, recommendations appear here."
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {recommendations.map((group, idx) => {
            const sortedRecs = [...group.recommendations].sort((a, b) => a.price - b.price);
            const neededQty = customQuantities[group.item_name] || 1;
            
            return (
              <div 
                key={idx} 
                className="glass-panel p-6 rounded-2xl border-gray-800 bg-gradient-to-br from-gray-950/20 to-transparent flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white capitalize flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-amber-400" />
                      {group.item_name}
                    </h3>
                    
                    {/* Interactive Quantity Selector */}
                    <div className="flex items-center gap-2 bg-amber-950/20 border border-amber-500/20 rounded-full px-2.5 py-1">
                      <button 
                        onClick={() => handleDecrement(group.item_name)}
                        className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-950 hover:bg-amber-900 border border-amber-500/20 text-amber-400 hover:text-white transition-all font-mono font-bold text-xs"
                        title="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="text-[10px] font-bold font-mono text-amber-400 min-w-[65px] text-center">
                        QTY: {neededQty}
                      </span>
                      <button 
                        onClick={() => handleIncrement(group.item_name)}
                        className="w-5 h-5 flex items-center justify-center rounded-full bg-amber-950 hover:bg-amber-900 border border-amber-500/20 text-amber-400 hover:text-white transition-all font-mono font-bold text-xs"
                        title="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Vendor Listings */}
                  <div className="space-y-3">
                    {sortedRecs.map((rec, rIdx) => {
                      const isCheapest = rIdx === 0;
                      const totalPrice = rec.price * neededQty;

                      return (
                        <div 
                          key={rIdx} 
                          className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                            isCheapest 
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100 shadow-lg shadow-emerald-950/20' 
                              : 'bg-gray-950/40 border-gray-850 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs font-mono ${
                              isCheapest 
                                ? 'bg-emerald-950 border border-emerald-500/20 text-emerald-400' 
                                : 'bg-gray-900 border border-gray-800 text-gray-400'
                            }`}>
                              {rec.platform[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-sm capitalize">{rec.product_name || `${group.item_name} product`}</p>
                              <p className="text-[10px] text-gray-500">
                                {rec.platform} • ₹{rec.price}/unit
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div className="mr-1">
                              <p className={`font-mono font-bold text-sm text-gray-400`}>
                                Total:
                              </p>
                              <p className={`font-mono font-bold text-base ${isCheapest ? 'text-emerald-400' : 'text-white'}`}>
                                ₹{totalPrice}
                              </p>
                            </div>
                            {isCheapest && (
                              <span className="text-[9px] font-extrabold font-mono tracking-wide px-2 py-0.5 bg-emerald-500 text-black rounded-md flex items-center gap-0.5">
                                <TrendingDown className="w-3.5 h-3.5" />
                                BEST
                              </span>
                            )}
                            <button
                              onClick={() => alert(`Successfully purchased ${neededQty} ${group.item_name}(s) from ${rec.platform} for a total of ₹${totalPrice}! (Mock Transaction Completed)`)}
                              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold font-mono transition-all duration-300"
                            >
                              BUY
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
