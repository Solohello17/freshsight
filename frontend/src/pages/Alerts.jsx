import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertOctagon, Flame, Calendar, ShoppingCart, ShieldAlert } from 'lucide-react';
import { API_BASE } from '../api';

export default function Alerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/food/alerts`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (err) {
      console.error("Error fetching alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Fridge <span className="text-rose-500">Alerts</span>
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Critical warnings regarding decaying fridge contents or low inventory counts.
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 py-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="glass-panel p-20 rounded-2xl flex flex-col items-center justify-center text-gray-500">
            <RefreshCw className="w-10 h-10 animate-spin text-rose-500 mb-4" />
            <p className="font-semibold">Loading active warnings...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="glass-panel p-20 rounded-2xl flex flex-col items-center justify-center text-gray-500 text-center">
            <AlertOctagon className="w-12 h-12 text-gray-700 mb-4" />
            <p className="font-semibold text-lg text-white">No Active Alerts</p>
            <p className="text-sm text-gray-500 mt-1 max-w-[280px]">
              All items in the fridge appear to be fresh and fully stocked. Outstanding!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((alert, idx) => {
              const isRotten = alert.type === "ROTTEN" || alert.type === "rotten";
              const isLowStock = alert.type === "LOW_STOCK";
              const isOutOfStock = alert.type === "OUT_OF_STOCK";

              let themeClasses = "";
              let Icon = Flame;
              if (isRotten) {
                themeClasses = "border-rose-500/10 hover:border-rose-500/30 bg-gradient-to-br from-rose-950/10 to-transparent";
                Icon = Flame;
              } else if (isLowStock) {
                themeClasses = "border-amber-500/10 hover:border-amber-500/30 bg-gradient-to-br from-amber-950/10 to-transparent";
                Icon = ShieldAlert;
              } else if (isOutOfStock) {
                themeClasses = "border-rose-500/15 hover:border-rose-500/35 bg-gradient-to-br from-rose-950/20 to-transparent";
                Icon = AlertOctagon;
              }

              return (
                <div 
                  key={idx} 
                  className={`glass-panel p-5 rounded-2xl flex items-start gap-4 transition-all duration-300 ${themeClasses}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                    isRotten 
                      ? 'bg-rose-950/40 border-rose-500/20 text-rose-400' 
                      : isLowStock 
                      ? 'bg-amber-950/40 border-amber-500/20 text-amber-400' 
                      : 'bg-rose-950/60 border-rose-500/30 text-rose-500'
                  }`}>
                    <Icon className={`w-5 h-5 ${isRotten ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex justify-between items-center">
                      <span className={`capitalize text-[10px] font-extrabold font-mono px-2 py-0.5 rounded border ${
                        isRotten 
                          ? 'text-rose-400 bg-rose-950/40 border-rose-500/10' 
                          : isLowStock 
                          ? 'text-amber-400 bg-amber-950/40 border-amber-500/10' 
                          : 'text-rose-500 bg-rose-950/60 border-rose-500/20'
                      }`}>
                        {alert.type ? alert.type.replace("_", " ") : "ALERT"}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-base font-semibold text-white pt-1">
                      {alert.message}
                    </h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {isRotten 
                        ? "Action required: Remove this item from the fridge immediately to prevent contamination." 
                        : "Action required: Purchase replenishment stock to maintain target levels."
                      }
                    </p>

                    {/* Auto Buy Trigger */}
                    {(isLowStock || isOutOfStock) && (
                      <div className="pt-2">
                        <button 
                          onClick={() => navigate(`/shopping?item=${alert.item_name}`)}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold font-mono transition-all duration-300 shadow-md shadow-amber-600/10 hover:shadow-amber-500/20 flex items-center gap-1.5"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          AUTO BUY
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
