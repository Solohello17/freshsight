import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, Refrigerator, ShieldCheck, Flame, 
  ShoppingBag, ArrowRight, Camera, Upload, AlertCircle, 
  CheckCircle, RefreshCw, History 
} from 'lucide-react';
import { API_BASE } from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_items: 0,
    fresh_items: 0,
    rotten_items: 0,
    low_stock_items: 0,
    out_of_stock_items: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [history, setHistory] = useState([]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/food/scan-history?limit=5`);
      if (res.ok) setHistory(await res.json());
    } catch (err) {
      console.error("Error fetching scan history:", err);
    }
  };

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await fetch(`${API_BASE}/api/food/dashboard-stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchHistory();
  }, []);

  const handleFileChange = (e) => {
    setErrorMessage("");
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setErrorMessage("");
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))[0];
    if (dropped) {
      setFile(dropped);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setErrorMessage("");
  };

  const handleClearAll = () => {
    setFile(null);
    setScanResult(null);
    setErrorMessage("");
  };

  const handleStartScan = async () => {
    if (!file) {
      setErrorMessage("Please select or drop an image first.");
      return;
    }

    setScanning(true);
    setErrorMessage("");
    setScanResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/food/scan-food`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Scanning failed.");
      }

      setScanResult(data);
      setFile(null); // Reset file after success
      fetchStats(); // Update dashboard cards
      fetchHistory();
    } catch (err) {
      setErrorMessage(err.message || "An error occurred while communicating with the model pipeline.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Welcome header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Fresh<span className="text-purple-400">Sight</span> Dashboard
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            AI-driven freshness, real-time inventory levels, and automated supply chains.
          </p>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Total items */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-colors"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total Items</p>
              <h3 className="text-2xl font-bold mt-2 text-white">
                {loadingStats ? <RefreshCw className="w-5 h-5 animate-spin text-gray-500" /> : stats.total_items}
              </h3>
            </div>
            <div className="w-10 h-10 bg-blue-950/50 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
              <Refrigerator className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Fresh items */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-colors"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Fresh Items</p>
              <h3 className="text-2xl font-bold mt-2 text-emerald-400">
                {loadingStats ? <RefreshCw className="w-5 h-5 animate-spin text-gray-500" /> : stats.fresh_items}
              </h3>
            </div>
            <div className="w-10 h-10 bg-emerald-950/50 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Rotten items */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-colors"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Rotten Items</p>
              <h3 className="text-2xl font-bold mt-2 text-rose-400">
                {loadingStats ? <RefreshCw className="w-5 h-5 animate-spin text-gray-500" /> : stats.rotten_items}
              </h3>
            </div>
            <div className="w-10 h-10 bg-rose-950/50 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-400">
              <Flame className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Low Stock items */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Low Stock</p>
              <h3 className="text-2xl font-bold mt-2 text-amber-400">
                {loadingStats ? <RefreshCw className="w-5 h-5 animate-spin text-gray-500" /> : stats.low_stock_items}
              </h3>
            </div>
            <div className="w-10 h-10 bg-amber-950/50 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Out of stock */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-colors"></div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Out of Stock</p>
              <h3 className="text-2xl font-bold mt-2 text-rose-500 font-bold">
                {loadingStats ? <RefreshCw className="w-5 h-5 animate-spin text-gray-500" /> : stats.out_of_stock_items}
              </h3>
            </div>
            <div className="w-10 h-10 bg-rose-950/50 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-500">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main scanner & scan results section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Upload panel */}
        <div className="lg:col-span-7 glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-purple-400" />
                Trigger Food Scanner
              </h2>
              <span className="text-xs text-purple-400 font-mono font-bold bg-purple-950/40 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
                SINGLE IMAGE
              </span>
            </div>

            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-800 hover:border-purple-500/50 bg-gray-950/40 rounded-xl p-8 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[220px]"
              onClick={() => document.getElementById("file-input").click()}
            >
              <Upload className="w-10 h-10 text-gray-500 mb-3 group-hover:text-purple-400" />
              <p className="text-sm font-semibold text-gray-300">Drag and drop an image here, or click to browse</p>
              <p className="text-xs text-gray-500 mt-1">Supports JPG, PNG (1 file required)</p>
              <input
                id="file-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-4 p-3 bg-rose-950/30 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* File Info */}
            {file && (
              <div className="mt-6 space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-left">Selected Image</h4>
                <div className="flex items-center justify-between bg-gray-950/60 border border-gray-800 px-3 py-2 rounded-xl text-xs">
                  <span className="truncate text-gray-300 max-w-[250px] font-mono">{file.name}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                    className="text-gray-500 hover:text-rose-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 mt-8">
            <button
              onClick={handleStartScan}
              disabled={!file || scanning}
              className="flex-1 btn-primary bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-40 disabled:hover:scale-100"
            >
              {scanning ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Running YOLO Fruit Detection...
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  Scan Food Image
                </>
              )}
            </button>
            {file && (
              <button 
                onClick={handleClearAll}
                className="btn-secondary"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Scan Results view */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl flex flex-col min-h-[350px]">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            Scanner Feedback
          </h2>

          {!scanResult ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 border border-dashed border-gray-800 rounded-xl p-6">
              <Camera className="w-12 h-12 text-gray-700 mb-2" />
              <p className="text-sm font-semibold">No Scan Completed Yet</p>
              <p className="text-xs text-gray-600 mt-1 max-w-[240px]">
                Upload an image of your fridge items. The server will run detection and freshness analysis.
              </p>
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs text-gray-400 font-mono">
                  <span>Status: Completed</span>
                  <span>Time: {new Date(scanResult.scan_time).toLocaleTimeString()}</span>
                </div>

                {/* Annotated Output Image */}
                {scanResult.annotated_image && (
                  <div className="relative rounded-xl overflow-hidden border border-purple-500/20 shadow-inner bg-black">
                    <img 
                      src={`data:image/jpeg;base64,${scanResult.annotated_image}`}
                      alt="Scan Analysis"
                      className="w-full h-auto max-h-[220px] object-contain mx-auto"
                    />
                    <div className="absolute bottom-2 left-2 bg-purple-950/80 border border-purple-500/30 text-[10px] text-purple-300 font-mono font-bold px-2 py-0.5 rounded-md">
                      ANALYZED SCAN
                    </div>
                  </div>
                )}

                {/* Scan detections counts */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Detected Inventory</h4>
                  <div className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden bg-gray-950/30">
                    {scanResult.items
                      .filter(item => item.fresh_count > 0 || item.rotten_count > 0)
                      .map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center px-4 py-2.5 text-sm">
                          <span className="capitalize font-semibold text-gray-200">{item.name}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-emerald-400">Fresh: {item.fresh_count}</span>
                            {item.rotten_count > 0 && (
                              <span className="text-rose-400">Rotten: {item.rotten_count}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    {scanResult.items.filter(item => item.fresh_count > 0 || item.rotten_count > 0).length === 0 && (
                      <div className="p-4 text-center text-xs text-gray-500">
                        No food items were detected in the scan.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => navigate('/inventory')}
                  className="flex-1 btn-secondary text-xs py-2"
                >
                  View Full Inventory
                </button>
                <button
                  onClick={() => navigate('/shopping')}
                  className="flex-1 btn-primary text-xs py-2 bg-gradient-to-r from-amber-600 to-yellow-600"
                >
                  Shopping List
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent scans */}
      {history.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl space-y-3">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" /> Recent Scans
          </h3>
          <div className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden bg-gray-950/30">
            {history.map((scan, idx) => (
              <div key={idx} className="flex flex-wrap justify-between items-center gap-2 px-4 py-2.5 text-xs">
                <span className="text-gray-400">{new Date(scan.scan_time).toLocaleString()}</span>
                <span className="text-gray-200">
                  {scan.items
                    .filter(i => i.count > 0)
                    .map(i => `${i.fresh_count}/${i.count} ${i.name}`)
                    .join(" · ") || "Nothing detected"}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500">Format: fresh / total detected</p>
        </div>
      )}
    </div>
  );
}
