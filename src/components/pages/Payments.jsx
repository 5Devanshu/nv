import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, IndianRupee, Search, Filter,
  AlertCircle, Clock, CheckCircle,
  Wallet, BarChart2, ChevronDown, ChevronUp,
  Trash2, X, Calendar,
} from 'lucide-react';
import {
  recordPaymentApi, getPaymentsApi,
  getOverdueApi, getOutstandingApi,
  getMonthlySummaryApi, deletePaymentApi,
} from '../../services/repository/paymentRepository';
import { getBookingsApi } from '../../services/repository/bookingRepository';
import { getProjectsApi } from '../../services/repository/projectRepository';
import Loader from '../common/Loader';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS          = ['Record Payment', 'All Payments', 'Overdue', 'Outstanding', 'Monthly'];
const PAYMENT_TYPES = ['booking', 'agreement', 'instalment', 'registration', 'other'];
const PAYMENT_MODES = ['cash', 'cheque', 'NEFT', 'RTGS', 'UPI'];

const TYPE_STYLE = {
  booking:      'bg-blue-100 text-blue-700',
  agreement:    'bg-purple-100 text-purple-700',
  instalment:   'bg-[#CBDCEB] text-[#6D94C5]',
  registration: 'bg-green-100 text-green-700',
  other:        'bg-gray-100 text-gray-600',
};

const MODE_STYLE = {
  cash:   'bg-green-100 text-green-700',
  cheque: 'bg-orange-100 text-orange-600',
  NEFT:   'bg-blue-100 text-blue-700',
  RTGS:   'bg-purple-100 text-purple-700',
  UPI:    'bg-teal-100 text-teal-700',
};

const inr     = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const inputCls =
  'w-full px-4 py-2.5 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] transition-colors';

const EMPTY_FORM = {
  booking_id: '', schedule_id: '',
  payment_date: new Date().toISOString().split('T')[0],
  amount: '', payment_type: 'instalment',
  payment_mode: 'NEFT', reference_no: '',
  bank_name: '', remarks: '',
};

// ─── Small stat card ──────────────────────────────────────────────────────────
const StatCard = ({ label, value, color = 'text-[#6D94C5]', sub }) => (
  <div className="bg-white rounded-2xl border border-[#E8DFCA] p-5">
    <p className="text-xs text-[#718096] font-medium mb-1">{label}</p>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-[#718096] mt-1">{sub}</p>}
  </div>
);

// ─── Type badge ───────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => (
  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${TYPE_STYLE[type] || 'bg-gray-100 text-gray-500'}`}>
    {type}
  </span>
);

// ─── Mode badge ───────────────────────────────────────────────────────────────
const ModeBadge = ({ mode }) => (
  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${MODE_STYLE[mode] || 'bg-gray-100 text-gray-500'}`}>
    {mode}
  </span>
);

// ─── Progress bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ paid, total }) => {
  const pct   = total ? Math.min(Math.round((paid / total) * 100), 100) : 0;
  const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-[#6D94C5]' : 'bg-orange-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-[#E8DFCA] rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-[#718096] w-8">{pct}%</span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Payments() {
  const [tab,         setTab]         = useState(0);
  const [payments,    setPayments]    = useState([]);
  const [bookings,    setBookings]    = useState([]);
  const [projects,    setProjects]    = useState([]);
  const [overdue,     setOverdue]     = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [monthly,     setMonthly]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState({ text: '', type: '' });

  // Form state
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [selBooking, setSelBooking] = useState(null);
  const [schedules,  setSchedules]  = useState([]);

  // All payments filters
  const [fProject, setFProject] = useState('');
  const [fType,    setFType]    = useState('');
  const [fMode,    setFMode]    = useState('');
  const [fFrom,    setFFrom]    = useState('');
  const [fTo,      setFTo]      = useState('');
  const [search,   setSearch]   = useState('');

  // Monthly filter
  const now = new Date();
  const [mMonth, setMMonth] = useState(String(now.getMonth() + 1));
  const [mYear,  setMYear]  = useState(String(now.getFullYear()));

  // Overdue / outstanding project filter
  const [fOvProject, setFOvProject] = useState('');

  // Expanded payment detail
  const [expanded, setExpanded] = useState(null);

  // ── Flash ──────────────────────────────────────────────────
  const flash = useCallback((text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
  }, []);

  // ── Load base data ─────────────────────────────────────────
  useEffect(() => {
    // Load projects
    getProjectsApi()
      .then(({ data }) => setProjects(data.data?.projects || []))
      .catch(() => {});

    // Load all active bookings for the dropdown
    getBookingsApi()
      .then(({ data }) => {
        setBookings((data.data?.bookings || []).filter((b) => b.status !== 'cancelled'));
      })
      .catch(() => {});
  }, []);

  // ── Load payments ──────────────────────────────────────────
  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fProject) params.project_id   = fProject;
      if (fType)    params.payment_type = fType;
      if (fMode)    params.payment_mode = fMode;
      if (fFrom)    params.from_date    = fFrom;
      if (fTo)      params.to_date      = fTo;
      const { data } = await getPaymentsApi(params);
      setPayments(data.data?.payments || []);
    } catch {
      flash('Failed to load payments', 'error');
    }
    setLoading(false);
  }, [fProject, fType, fMode, fFrom, fTo, flash]);

  // ── Load overdue ───────────────────────────────────────────
  const loadOverdue = useCallback(async () => {
    setLoading(true);
    try {
      const params = fOvProject ? { project_id: fOvProject } : {};
      const { data } = await getOverdueApi(params);
      setOverdue(data.data?.overdue || []);
    } catch {
      flash('Failed to load overdue', 'error');
    }
    setLoading(false);
  }, [fOvProject, flash]);

  // ── Load outstanding ───────────────────────────────────────
  const loadOutstanding = useCallback(async () => {
    setLoading(true);
    try {
      const params = fOvProject ? { project_id: fOvProject } : {};
      const { data } = await getOutstandingApi(params);
      setOutstanding(data.data?.outstanding || []);
    } catch {
      flash('Failed to load outstanding', 'error');
    }
    setLoading(false);
  }, [fOvProject, flash]);

  // ── Load monthly ───────────────────────────────────────────
  const loadMonthly = useCallback(async () => {
    if (!mMonth || !mYear) return;
    setLoading(true);
    try {
      const { data } = await getMonthlySummaryApi({ month: mMonth, year: mYear });
      setMonthly(data.data);
    } catch {
      flash('Failed to load monthly summary', 'error');
    }
    setLoading(false);
  }, [mMonth, mYear, flash]);

  useEffect(() => { if (tab === 1) loadPayments(); },    [tab, loadPayments]);
  useEffect(() => { if (tab === 2) loadOverdue(); },     [tab, loadOverdue]);
  useEffect(() => { if (tab === 3) loadOutstanding(); }, [tab, loadOutstanding]);
  useEffect(() => { if (tab === 4) loadMonthly(); },     [tab, loadMonthly]);

  // ── When a booking is selected — fetch its schedule ───────
  const handleBookingSelect = useCallback(async (bookingId) => {
    setForm((p) => ({ ...p, booking_id: bookingId, schedule_id: '' }));
    if (!bookingId) { setSelBooking(null); setSchedules([]); return; }

    const found = bookings.find((b) => String(b.id) === String(bookingId));
    setSelBooking(found || null);

    try {
      const { data } = await (await import('../../services/repository/bookingRepository'))
        .getScheduleApi(bookingId);
      const unpaid = (data.data?.schedule || []).filter((s) => !s.is_paid);
      setSchedules(unpaid);
    } catch {
      setSchedules([]);
    }
  }, [bookings]);

  // ── Record payment ─────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.booking_id) return flash('Select a booking', 'error');
    if (!form.amount)     return flash('Enter payment amount', 'error');

    setSaving(true);
    try {
      const payload = {
        ...form,
        booking_id:  Number(form.booking_id),
        schedule_id: form.schedule_id ? Number(form.schedule_id) : null,
        amount:      Number(form.amount),
        reference_no: form.reference_no || null,
        bank_name:    form.bank_name    || null,
        remarks:      form.remarks      || null,
      };
      await recordPaymentApi(payload);
      flash('Payment recorded successfully');
      setForm(EMPTY_FORM);
      setSelBooking(null);
      setSchedules([]);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to record payment', 'error');
    }
    setSaving(false);
  };

  // ── Delete payment ─────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payment record? This will un-mark the linked milestone.')) return;
    try {
      await deletePaymentApi(id);
      flash('Payment deleted');
      loadPayments();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  // ── Filtered payments ──────────────────────────────────────
  const displayed = payments.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.customer_name?.toLowerCase().includes(q) ||
      p.flat_number?.toLowerCase().includes(q)   ||
      p.project_name?.toLowerCase().includes(q)  ||
      p.reference_no?.toLowerCase().includes(q)
    );
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#2d3748]">Payment Tracking</h2>
        <button
          onClick={() => setTab(0)}
          className="flex items-center gap-2 px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
        >
          <Plus size={15} /> Record Payment
        </button>
      </div>

      {/* Flash */}
      {msg.text && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
          msg.type === 'error'
            ? 'bg-red-50 text-red-600 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#E8DFCA] p-1 rounded-xl w-fit flex-wrap">
        {TABS.map((t, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              tab === i
                ? 'bg-white text-[#6D94C5] shadow-sm'
                : 'text-[#718096] hover:text-[#2d3748]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ══ TAB 0: RECORD PAYMENT ════════════════════════════════════ */}
      {tab === 0 && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-6">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2 mb-6">
              <IndianRupee size={16} className="text-[#6D94C5]" />
              Record New Payment
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Booking selector */}
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Booking <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.booking_id}
                  onChange={(e) => handleBookingSelect(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="">— Select Booking —</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.customer_name} · {b.project_name} · Flat {b.flat_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Booking summary card */}
              {selBooking && (
                <div className="bg-[#F5EFE6] rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-[#718096]">Customer</p>
                    <p className="font-bold text-[#2d3748] text-sm">{selBooking.customer_name}</p>
                    <p className="text-xs text-[#718096]">{selBooking.customer_phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#718096]">Flat</p>
                    <p className="font-bold text-[#2d3748] text-sm">
                      {selBooking.flat_number} · {selBooking.configuration}
                    </p>
                    <p className="text-xs text-[#718096]">{selBooking.project_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#718096]">Agreement Value</p>
                    <p className="font-bold text-[#6D94C5] text-sm">{inr(selBooking.final_value)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#718096]">Balance Due</p>
                    <p className={`font-bold text-sm ${Number(selBooking.balance_due) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {inr(selBooking.balance_due)}
                    </p>
                  </div>
                  {selBooking.final_value && (
                    <div className="col-span-2 md:col-span-4">
                      <ProgressBar
                        paid={Number(selBooking.total_paid)}
                        total={Number(selBooking.final_value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Link to schedule milestone */}
              {schedules.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                    Link to Milestone
                    <span className="ml-1 font-normal text-[#718096]">(optional — auto-marks milestone as paid)</span>
                  </label>
                  <select
                    value={form.schedule_id}
                    onChange={(e) => setForm((p) => ({ ...p, schedule_id: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">— No milestone / general payment —</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.milestone}
                        {s.due_date ? ` · Due ${fmtDate(s.due_date)}` : ''}
                        {` · ${inr(s.amount_due)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Payment date + Amount */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Payment Date</label>
                  <input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                    Amount <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
                    <input
                      type="number"
                      value={form.amount}
                      onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                      placeholder="e.g. 500000"
                      required
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                </div>
              </div>

              {/* Payment type + mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Payment Type</label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, payment_type: t }))}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                          form.payment_type === t
                            ? 'bg-[#6D94C5] text-white'
                            : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Payment Mode</label>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_MODES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, payment_mode: m }))}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          form.payment_mode === m
                            ? 'bg-[#6D94C5] text-white'
                            : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reference + Bank */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                    Reference No.
                    <span className="ml-1 font-normal text-[#718096]">(cheque / UTR / transaction ID)</span>
                  </label>
                  <input
                    value={form.reference_no}
                    onChange={(e) => setForm((p) => ({ ...p, reference_no: e.target.value }))}
                    placeholder="e.g. UTR12345678"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Bank Name</label>
                  <input
                    value={form.bank_name}
                    onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
                    placeholder="e.g. HDFC Bank"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                  rows={2}
                  placeholder="Optional notes..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
                >
                  {saving ? 'Recording...' : 'Record Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => { setForm(EMPTY_FORM); setSelBooking(null); setSchedules([]); }}
                  className="px-6 py-2.5 bg-[#E8DFCA] text-[#4a5568] text-sm font-semibold rounded-xl hover:bg-[#d4cdb8] transition-all"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>

          {/* Info note */}
          <div className="bg-[#CBDCEB] rounded-xl p-4 text-xs text-[#2d3748]">
            <p className="font-bold mb-1">💡 Payment Note</p>
            <p>Payment cannot exceed the outstanding balance. Linking to a milestone will automatically mark it as paid when the milestone amount is fully covered.</p>
          </div>
        </div>
      )}

      {/* ══ TAB 1: ALL PAYMENTS ══════════════════════════════════════ */}
      {tab === 1 && (
        <div className="space-y-4">

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 space-y-3">
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Customer / flat / project / ref no..."
                  className="w-full pl-8 pr-4 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-[#F5EFE6] focus:outline-none focus:border-[#6D94C5]"
                />
              </div>
              <select
                value={fProject}
                onChange={(e) => setFProject(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[140px]"
              >
                <option value="">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input
                type="date" value={fFrom}
                onChange={(e) => setFFrom(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]"
              />
              <input
                type="date" value={fTo}
                onChange={(e) => setFTo(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]"
              />
              {(fProject || fType || fMode || fFrom || fTo || search) && (
                <button
                  onClick={() => { setFProject(''); setFType(''); setFMode(''); setFFrom(''); setFTo(''); setSearch(''); }}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>

            {/* Type chips */}
            <div className="flex gap-2 flex-wrap">
              {['', ...PAYMENT_TYPES].map((t) => (
                <button
                  key={t}
                  onClick={() => setFType(t)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                    fType === t
                      ? 'bg-[#6D94C5] text-white'
                      : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
                  }`}
                >
                  {t || 'All Types'}
                </button>
              ))}
            </div>

            {/* Mode chips */}
            <div className="flex gap-2 flex-wrap">
              {['', ...PAYMENT_MODES].map((m) => (
                <button
                  key={m}
                  onClick={() => setFMode(m)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    fMode === m
                      ? 'bg-[#6D94C5] text-white'
                      : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
                  }`}
                >
                  {m || 'All Modes'}
                </button>
              ))}
            </div>
          </div>

          {/* Total banner */}
          {displayed.length > 0 && (
            <div className="bg-[#6D94C5] rounded-2xl px-5 py-4 flex items-center justify-between text-white">
              <p className="text-sm font-semibold">{displayed.length} payments</p>
              <p className="text-xl font-bold">
                {inr(displayed.reduce((s, p) => s + Number(p.amount), 0))}
              </p>
            </div>
          )}

          {/* Payments table */}
          {loading ? (
            <Loader />
          ) : displayed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <Wallet size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No payments found</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5EFE6]">
                    <tr>
                      {['Date', 'Customer', 'Flat', 'Amount', 'Type', 'Mode', 'Reference', 'Milestone', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5EFE6]">
                    {displayed.map((p) => (
                      <React.Fragment key={p.id}>
                        <tr
                          className="hover:bg-[#F5EFE6] transition-colors cursor-pointer"
                          onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                        >
                          <td className="px-4 py-3 text-xs text-[#718096] whitespace-nowrap">
                            {fmtDate(p.payment_date)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#2d3748]">{p.customer_name}</p>
                            <p className="text-xs text-[#718096]">{p.project_name}</p>
                          </td>
                          <td className="px-4 py-3 font-medium text-[#2d3748]">{p.flat_number}</td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-[#6D94C5]">{inr(p.amount)}</p>
                          </td>
                          <td className="px-4 py-3"><TypeBadge type={p.payment_type} /></td>
                          <td className="px-4 py-3"><ModeBadge mode={p.payment_mode} /></td>
                          <td className="px-4 py-3 text-xs text-[#718096]">{p.reference_no || '—'}</td>
                          <td className="px-4 py-3 text-xs text-[#718096]">{p.milestone || '—'}</td>
                          <td className="px-4 py-3">
                            {expanded === p.id
                              ? <ChevronUp size={14} className="text-[#6D94C5]" />
                              : <ChevronDown size={14} className="text-[#718096]" />
                            }
                          </td>
                        </tr>

                        {/* Expanded row */}
                        {expanded === p.id && (
                          <tr>
                            <td colSpan={9} className="bg-[#F5EFE6] px-8 py-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                  ['Bank Name',     p.bank_name        || '—'],
                                  ['Received By',   p.received_by_name || '—'],
                                  ['Booking Value', inr(p.final_value)],
                                  ['Remarks',       p.remarks          || '—'],
                                ].map(([label, value]) => (
                                  <div key={label} className="bg-white rounded-xl p-3">
                                    <p className="text-xs text-[#718096] mb-0.5">{label}</p>
                                    <p className="text-sm font-semibold text-[#2d3748]">{value}</p>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() => handleDelete(p.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-500 text-xs font-semibold rounded-lg hover:bg-red-100 transition-all"
                                >
                                  <Trash2 size={12} /> Delete Payment
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#F5EFE6]">
                      <td colSpan={3} className="px-4 py-3 text-sm font-bold text-[#718096]">
                        Total ({displayed.length} records)
                      </td>
                      <td className="px-4 py-3 font-bold text-[#6D94C5]">
                        {inr(displayed.reduce((s, p) => s + Number(p.amount), 0))}
                      </td>
                      <td colSpan={5} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 2: OVERDUE ═══════════════════════════════════════════ */}
      {tab === 2 && (
        <div className="space-y-4">

          {/* Project filter */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex items-center gap-3">
            <Filter size={14} className="text-[#718096]" />
            <select
              value={fOvProject}
              onChange={(e) => setFOvProject(e.target.value)}
              className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[160px]"
            >
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span className="text-xs text-[#718096]">{overdue.length} overdue milestones</span>
          </div>

          {/* Total overdue */}
          {overdue.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-500" />
                <p className="font-bold text-red-600">{overdue.length} overdue milestones</p>
              </div>
              <p className="text-xl font-bold text-red-500">
                {inr(overdue.reduce((s, o) => s + Number(o.amount_due), 0))}
              </p>
            </div>
          )}

          {loading ? (
            <Loader />
          ) : overdue.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No overdue payments</p>
              <p className="text-xs text-[#718096] mt-1">All milestones are on track.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overdue.map((o) => (
                <div key={o.schedule_id} className="bg-white rounded-2xl border border-red-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Clock size={16} className="text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[#2d3748]">{o.customer_name}</p>
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                          {o.days_overdue} day{o.days_overdue > 1 ? 's' : ''} overdue
                        </span>
                      </div>
                      <p className="text-xs text-[#718096] mt-0.5">
                        {o.project_name} · Flat {o.flat_number} · {o.configuration}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-red-500">{inr(o.amount_due)}</p>
                      <p className="text-xs text-[#718096]">Due {fmtDate(o.due_date)}</p>
                    </div>
                  </div>

                  <div className="px-5 pb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#718096]">
                      <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                        {o.milestone}
                      </span>
                    </p>
                    <div className="flex gap-2">
                      {/* ✅ FIX: <a tag was missing here */}
                      {o.customer_phone && (
                        <a
                          href={`tel:${o.customer_phone}`}
                          className="text-xs px-3 py-1.5 bg-green-50 text-green-700 font-semibold rounded-lg hover:bg-green-100 transition-all"
                        >
                          📞 {o.customer_phone}
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setForm((p) => ({ ...p, booking_id: String(o.booking_id), schedule_id: String(o.schedule_id) }));
                          handleBookingSelect(String(o.booking_id));
                          setTab(0);
                        }}
                        className="text-xs px-3 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all"
                      >
                        Record Payment
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 3: OUTSTANDING ═══════════════════════════════════════ */}
      {tab === 3 && (
        <div className="space-y-4">

          {/* Filter */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex items-center gap-3">
            <Filter size={14} className="text-[#718096]" />
            <select
              value={fOvProject}
              onChange={(e) => setFOvProject(e.target.value)}
              className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[160px]"
            >
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span className="text-xs text-[#718096]">{outstanding.length} bookings with balance</span>
          </div>

          {/* Total outstanding */}
          {outstanding.length > 0 && (
            <div className="bg-[#6D94C5] rounded-2xl px-5 py-4 flex items-center justify-between text-white">
              <div>
                <p className="text-sm font-semibold opacity-80">Total Outstanding</p>
                <p className="text-2xl font-bold mt-0.5">
                  {inr(outstanding.reduce((s, o) => s + Number(o.balance_due), 0))}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold opacity-80">Total Collected</p>
                <p className="text-2xl font-bold mt-0.5">
                  {inr(outstanding.reduce((s, o) => s + Number(o.total_paid), 0))}
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <Loader />
          ) : outstanding.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No outstanding balances</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5EFE6]">
                    <tr>
                      {['Customer', 'Project', 'Flat', 'Agreement', 'Paid', 'Balance Due', 'Progress', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5EFE6]">
                    {outstanding.map((o) => (
                      <tr key={o.booking_id} className="hover:bg-[#F5EFE6] transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#2d3748]">{o.customer_name}</p>
                          <p className="text-xs text-[#718096]">{o.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#718096]">{o.project_name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-[#CBDCEB] text-[#2d3748] px-2 py-0.5 rounded-lg font-medium">
                            {o.flat_number}
                          </span>
                          <p className="text-xs text-[#718096] mt-0.5">{o.configuration}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#2d3748]">{inr(o.final_value)}</td>
                        <td className="px-4 py-3 font-semibold text-green-600">{inr(o.total_paid)}</td>
                        <td className="px-4 py-3 font-bold text-red-500">{inr(o.balance_due)}</td>
                        <td className="px-4 py-3 w-32">
                          <ProgressBar paid={Number(o.total_paid)} total={Number(o.final_value)} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setForm((p) => ({ ...p, booking_id: String(o.booking_id) }));
                              handleBookingSelect(String(o.booking_id));
                              setTab(0);
                            }}
                            className="text-xs px-3 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all whitespace-nowrap"
                          >
                            Record
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 4: MONTHLY SUMMARY ═══════════════════════════════════ */}
      {tab === 4 && (
        <div className="space-y-5">

          {/* Month / Year picker */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex items-center gap-3 flex-wrap">
            <Calendar size={15} className="text-[#718096]" />
            <select
              value={mMonth}
              onChange={(e) => setMMonth(e.target.value)}
              className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]"
            >
              {['January','February','March','April','May','June',
                'July','August','September','October','November','December',
              ].map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <input
              type="number"
              value={mYear}
              onChange={(e) => setMYear(e.target.value)}
              placeholder="Year"
              className="w-24 px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]"
            />
            <button
              onClick={loadMonthly}
              className="px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
            >
              Load
            </button>
          </div>

          {loading ? (
            <Loader />
          ) : monthly ? (
            <>
              {/* Summary totals */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Total Collected"        value={inr(monthly.summary?.total_collected)}        color="text-[#6D94C5]" />
                <StatCard label="Total Payments"         value={monthly.summary?.payment_count || 0} />
                <StatCard label="Booking Collected"      value={inr(monthly.summary?.booking_collected)}      color="text-blue-600" />
                <StatCard label="Agreement Collected"    value={inr(monthly.summary?.agreement_collected)}    color="text-purple-600" />
                <StatCard label="Instalment Collected"   value={inr(monthly.summary?.instalment_collected)}   color="text-[#6D94C5]" />
                <StatCard label="Registration Collected" value={inr(monthly.summary?.registration_collected)} color="text-green-600" />
              </div>

              {/* By mode */}
              {monthly.by_mode?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E8DFCA] bg-[#F5EFE6]">
                    <p className="font-bold text-[#2d3748] text-sm">Collections by Mode</p>
                  </div>
                  <div className="divide-y divide-[#F5EFE6]">
                    {monthly.by_mode.map((m) => (
                      <div key={m.payment_mode} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-3">
                          <ModeBadge mode={m.payment_mode} />
                          <span className="text-xs text-[#718096]">{m.count} payments</span>
                        </div>
                        <p className="font-bold text-[#2d3748]">{inr(m.total)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By project */}
              {monthly.by_project?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E8DFCA] bg-[#F5EFE6]">
                    <p className="font-bold text-[#2d3748] text-sm">Collections by Project</p>
                  </div>
                  <div className="divide-y divide-[#F5EFE6]">
                    {monthly.by_project.map((p) => (
                      <div key={p.project_name} className="flex items-center justify-between px-5 py-4">
                        <div>
                          <p className="font-semibold text-[#2d3748]">{p.project_name}</p>
                          <p className="text-xs text-[#718096]">{p.payment_count} payments</p>
                        </div>
                        <p className="font-bold text-[#6D94C5]">{inr(p.total_collected)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <BarChart2 size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">Select a month and year to load summary</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}