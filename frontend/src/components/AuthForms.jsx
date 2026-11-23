import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Shield, User, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

export const AuthForms = () => {
  const { login, register, quickDemoLogin, error } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await register(name, email, password, role);
      } else {
        await login(email, password);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-3 text-indigo-400">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">
            {isRegister ? 'Create Operator Account' : 'Welcome to TaskOrbit'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise Asynchronous Task & Webhook Processing Platform
          </p>
        </div>

        {/* 1-Click Demo Buttons for Fast Testing */}
        <div className="space-y-2 mb-6">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold text-center">
            ⚡ Quick 1-Click Sandbox Logins
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => quickDemoLogin('admin')}
              className="p-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-left transition flex items-center gap-2 text-indigo-300 text-xs font-medium"
            >
              <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <div className="font-bold">Admin Role</div>
                <div className="text-[10px] text-indigo-300/70">Full DLQ privileges</div>
              </div>
            </button>
            <button
              onClick={() => quickDemoLogin('user')}
              className="p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-left transition flex items-center gap-2 text-slate-200 text-xs font-medium"
            >
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <div className="font-bold">Standard User</div>
                <div className="text-[10px] text-slate-400">Task dispatch & SSE</div>
              </div>
            </button>
          </div>
        </div>

        <div className="relative flex py-2 items-center mb-4">
          <div className="flex-grow border-t border-slate-800" />
          <span className="flex-shrink mx-3 text-[10px] text-slate-400 uppercase tracking-widest">
            or credentials
          </span>
          <div className="flex-grow border-t border-slate-800" />
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jane Doe"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="operator@enterprise.local"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="user">Standard User (Job Submitter)</option>
                <option value="admin">Admin Operator (DLQ & Re-queue Access)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-1.5"
          >
            <span>{isRegister ? 'Register & Authenticate' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition"
          >
            {isRegister
              ? 'Already have an operator account? Sign in'
              : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
};

