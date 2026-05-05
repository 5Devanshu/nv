import React, { useState } from 'react';
import { useNavigate }      from 'react-router-dom';
import { useDispatch }      from 'react-redux';
import { setCredentials }   from '../../app/authSlice';
import Connector            from '../../services/Connector';
import APIS                 from '../../services/Apis';
import { Building2, Eye, EyeOff, LogIn } from 'lucide-react';

export default function Login() {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await Connector.post(APIS.LOGIN, form);
      dispatch(setCredentials({ token: data.data.token, user: data.data.user }));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F5EFE6] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#6D94C5] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Building2 size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#2d3748]">Nivara Ventures</h1>
          <p className="text-[#718096] text-sm mt-1">Real Estate ERP · Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E8DFCA] p-8 shadow-sm">

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="you@nivaraventures.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 border border-[#E8DFCA] rounded-xl text-sm bg-[#F5EFE6] focus:outline-none focus:border-[#6D94C5] transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 border border-[#E8DFCA] rounded-xl text-sm bg-[#F5EFE6] focus:outline-none focus:border-[#6D94C5] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718096] hover:text-[#6D94C5] transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#6D94C5] text-white font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all text-sm"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>
                  <LogIn size={16} /> Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#718096] mt-6">
          © {new Date().getFullYear()} Nivara Ventures · All rights reserved
        </p>
      </div>
    </div>
  );
}