import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Refrigerator, Flame, ShoppingCart, 
  ChefHat, Cpu
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Alerts from './pages/Alerts';
import SmartShopping from './pages/SmartShopping';
import RecipeGenerator from './pages/RecipeGenerator';

export default function App() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/inventory', label: 'Inventory', icon: Refrigerator },
    { path: '/alerts', label: 'Alerts', icon: Flame },
    { path: '/shopping', label: 'Smart Shopping', icon: ShoppingCart },
    { path: '/recipes', label: 'Recipe Generator', icon: ChefHat },
  ];

  return (
    <div className="relative min-h-screen bg-[#030712] text-gray-100 flex font-sans bg-grid-pattern">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse-slow"></div>
      <div className="absolute bottom-0 left-[200px] w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse-slow"></div>

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-gray-950/60 border-r border-gray-900 flex flex-col justify-between p-6 shrink-0 sticky top-0 h-screen z-40 backdrop-blur-md">
        <div className="space-y-8">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-600/30">
              <Refrigerator className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                Fresh<span className="text-purple-400">Sight</span>
              </span>
              <p className="text-[9px] font-bold text-indigo-400 tracking-widest uppercase">Smart Assistant</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item, idx) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={idx}
                  to={item.path}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    isActive 
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-900/50'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info inside sidebar */}
        <div className="space-y-4 pt-6 border-t border-gray-900">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>FreshSight v1.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        <div className="flex-1 pb-16">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/shopping" element={<SmartShopping />} />
            <Route path="/recipes" element={<RecipeGenerator />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
