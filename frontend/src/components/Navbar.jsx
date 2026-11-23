import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import {
  Activity,
  Layers,
  Shield,
  User,
  LogOut,
  PlusCircle,
  Database,
  Radio,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export const Navbar = ({ onOpenTrigger, onTriggerStressTest, activeTab, setActiveTab }) => {
  const { user, logout, quickDemoLogin, isAdmin } = useAuth();
  const [health, setHealth] = useState({ redis: 'checking...', mongodb: 'checking...' });

  useEffect(() => {
    const fetchHealth = () => {
      api.checkHealth()
        .then((res) => {
          if (res?.dependencies) {
            setHealth({
              redis: res.dependencies.redis || 'offline',
              mongodb: res.dependencies.mongodb || 'offline',
            });
          } else {
            setHealth({ redis: 'offline', mongodb: 'offline' });
          }
        })
        .catch(() => {
          setHealth({ redis: 'offline', mongodb: 'offline' });
        });
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 tracking-tight text-lg">
                TaskOrbit
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                Enterprise v2.4
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              BullMQ • Redis • SSE Asynchronous Processing
            </p>
          </div>
        </div>

        {/* Health Indicators */}
        <div className="hidden md:flex items-center gap-3 text-xs bg-slate-950/60 px-3 py-1.5 rounded-full border border-slate-800">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                health.redis === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-400 font-mono">Redis:</span>
            <span className={health.redis === 'connected' ? 'text-emerald-400' : 'text-rose-400'}>
              {health.redis}
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                health.mongodb === 'connected' ? 'bg-emerald-400' : 'text-rose-500'
              }`}
            />
            <span className="text-slate-400 font-mono">MongoDB:</span>
            <span className={health.mongodb === 'connected' ? 'text-emerald-400' : 'text-rose-400'}>
              {health.mongodb}
            </span>
          </div>
        </div>

        {/* Actions & User */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Trigger Task Button */}
              <button
                onClick={onOpenTrigger}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-500/20 transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dispatch Task</span>
              </button>

              {/* Concurrency Stress Test Quick Button */}
              {onTriggerStressTest && (
                <button
                  onClick={onTriggerStressTest}
                  title="Fire 5 concurrent tasks into BullMQ"
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold rounded-lg transition"
                >
                  <Zap className="w-3 h-3 fill-current text-purple-400" />
                  <span>5x Stress Test</span>
                </button>
              )}

              {/* Navigation Tabs */}
              <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    activeTab === 'dashboard'
                      ? 'bg-slate-700 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Dashboard
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('dlq')}
                    className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition ${
                      activeTab === 'dlq'
                        ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40 shadow'
                        : 'text-rose-400 hover:text-rose-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    DLQ Panel
                  </button>
                )}
              </div>

              {/* User badge */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-medium text-slate-200">{user.name}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    {user.role}
                  </div>
                </div>
                <button
                  onClick={logout}
                  title="Logout"
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => quickDemoLogin('admin')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                Demo Admin
              </button>
              <button
                onClick={() => quickDemoLogin('user')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                Demo User
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

