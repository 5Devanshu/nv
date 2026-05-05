import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Users, Search, Pencil, X,
  CheckCircle, AlertCircle, IndianRupee,
  ChevronDown, ChevronUp, BadgeCheck,
  ToggleLeft, ToggleRight, Filter, Clock,
} from 'lucide-react';
import {
  getBrokersApi, getBrokerSummaryApi,
  createBrokerApi, updateBrokerApi,
  activateBrokerApi, deactivateBrokerApi,
  getBrokerCommissionsApi, getBrokerCommissionSummaryApi,
  createCommissionApi, payCommissionApi,
  getCommissionPaymentsApi,
  getPendingCommissionsApi, getAllCommissionsApi,
} from '../../services/repository/brokerRepository';
import { getProjectsApi }  from '../../services/repository/projectRepository';
import { getBookingsApi }  from '../../services/repository/bookingRepository';
import Loader from '../common/Loader';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS          = ['All Brokers', 'Add Broker', 'Commissions', 'Pending'];
const PAYMENT_MODES = ['cash', 'cheque', 'NEFT', 'RTGS', 'UPI'];

const COMM_STATUS_STYLE = {
  pending: 'bg-orange-100 text-orange-600',
  partial: 'bg-blue-100 text-blue-700',
  paid:    'bg-green-100 text-green-700',
};

const inr     = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const inputCls =
  'w-full px-4 py-2.5 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] transition-colors';

const EMPTY_BROKER = {
  name: '', phone: '', email: '',
  company: '', rera_number: '', commission_pct: '',
};

// ─── Progress bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ paid, total }) => {
  const pct   = total ? Math.min(Math.round((paid / total) * 100), 100) : 0;
  const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-[#6D94C5]' : 'bg-orange-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-[#E8DFCA] rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-[#718096] w-8">{pct}%</span>
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color = 'text-[#6D94C5]' }) => (
  <div className="bg-white rounded-xl border border-[#E8DFCA] p-4">
    <p className="text-xs text-[#718096] font-medium mb-1">{label}</p>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
  </div>
);

// ─── Commission Status Badge ───────────────────────────────────────────────────
const CommBadge = ({ status }) => (
  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${COMM_STATUS_STYLE[status] || 'bg-gray-100 text-gray-500'}`}>
    {status}
  </span>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Brokers() {
  const [tab,      setTab]     = useState(0);
  const [brokers,  setBrokers] = useState([]);
  const [summary,  setSummary] = useState(null);
  const [projects, setProjects]= useState([]);
  const [bookings, setBookings]= useState([]);
  const [loading,  setLoading] = useState(true);
  const [saving,   setSaving]  = useState(false);
  const [msg,      setMsg]     = useState({ text: '', type: '' });

  // Add / Edit broker form
  const [form,   setForm]   = useState(EMPTY_BROKER);
  const [editId, setEditId] = useState(null);

  // Filters
  const [search,      setSearch]      = useState('');
  const [fActive,     setFActive]     = useState('');
  const [fProject,    setFProject]    = useState('');
  const [fCommStatus, setFCommStatus] = useState('');

  // Broker detail slide-over
  const [selBroker,      setSelBroker]      = useState(null);
  const [brokerComms,    setBrokerComms]    = useState([]);
  const [brokerCommSumm, setBrokerCommSumm] = useState(null);
  const [brokerLoading,  setBrokerLoading]  = useState(false);
  const [expandedComm,   setExpandedComm]   = useState(null);
  const [commPayLog,     setCommPayLog]     = useState([]);

  // Add commission form
  const [showAddComm, setShowAddComm] = useState(false);
  const [commForm,    setCommForm]    = useState({ booking_id: '', commission_pct: '', remarks: '' });

  // Pay commission modal
  const [payModal, setPayModal] = useState(null);
  const [payForm,  setPayForm]  = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'NEFT',
    payment_reference: '',
    remarks: '',
  });

  // All commissions tab
  const [allComms,        setAllComms]        = useState([]);
  const [allCommsLoading, setAllCommsLoading] = useState(false);

  // Pending commissions tab
  const [pendingComms,   setPendingComms]   = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // ── Flash ──────────────────────────────────────────────────
  const flash = useCallback((text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
  }, []);

  // ── Load brokers + summary ─────────────────────────────────
  const loadBrokers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fActive !== '') params.is_active = fActive;
      if (search)         params.search    = search;

      const [bRes, sRes, pRes, bkRes] = await Promise.all([
        getBrokersApi(params),
        getBrokerSummaryApi(),
        getProjectsApi(),
        getBookingsApi(),
      ]);
      setBrokers(bRes.data.data?.brokers   || []);
      setSummary(sRes.data.data            || null);
      setProjects(pRes.data.data?.projects || []);
      setBookings((bkRes.data.data?.bookings || []).filter((b) => b.status !== 'cancelled'));
    } catch {
      flash('Failed to load brokers', 'error');
    }
    setLoading(false);
  }, [fActive, search, flash]);

  useEffect(() => { loadBrokers(); }, [loadBrokers]);

  // ── Load broker commissions ────────────────────────────────
  const loadBrokerComms = useCallback(async (broker) => {
    if (!broker) return;
    setBrokerLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        getBrokerCommissionsApi(broker.id),
        getBrokerCommissionSummaryApi(broker.id),
      ]);
      setBrokerComms(cRes.data.data?.commissions || []);
      setBrokerCommSumm(sRes.data.data           || null);
    } catch {
      flash('Failed to load commissions', 'error');
    }
    setBrokerLoading(false);
  }, [flash]);

  // ── Load all / pending commissions ────────────────────────
  const loadAllComms = useCallback(async () => {
    setAllCommsLoading(true);
    try {
      const params = {};
      if (fCommStatus) params.status     = fCommStatus;
      if (fProject)    params.project_id = fProject;
      const { data } = await getAllCommissionsApi(params);
      setAllComms(data.data?.commissions || []);
    } catch {
      flash('Failed to load commissions', 'error');
    }
    setAllCommsLoading(false);
  }, [fCommStatus, fProject, flash]);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const params = fProject ? { project_id: fProject } : {};
      const { data } = await getPendingCommissionsApi(params);
      setPendingComms(data.data?.commissions || []);
    } catch {
      flash('Failed to load pending', 'error');
    }
    setPendingLoading(false);
  }, [fProject, flash]);

  useEffect(() => { if (tab === 2) loadAllComms();  }, [tab, loadAllComms]);
  useEffect(() => { if (tab === 3) loadPending();   }, [tab, loadPending]);
  useEffect(() => { if (selBroker) loadBrokerComms(selBroker); }, [selBroker, loadBrokerComms]);

  // ── Form handlers ──────────────────────────────────────────
  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const resetForm = () => { setForm(EMPTY_BROKER); setEditId(null); };

  const handleEditClick = (b) => {
    setForm({
      name:           b.name            || '',
      phone:          b.phone           || '',
      email:          b.email           || '',
      company:        b.company         || '',
      rera_number:    b.rera_number     || '',
      commission_pct: b.commission_pct  || '',
    });
    setEditId(b.id);
    setTab(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Submit broker create / update ──────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return flash('Broker name is required', 'error');
    setSaving(true);
    try {
      const payload = {
        ...form,
        commission_pct: form.commission_pct ? Number(form.commission_pct) : 0,
      };
      if (editId) {
        await updateBrokerApi(editId, payload);
        flash('Broker updated');
      } else {
        await createBrokerApi(payload);
        flash('Broker created');
      }
      resetForm();
      loadBrokers();
      setTab(0);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to save broker', 'error');
    }
    setSaving(false);
  };

  // ── Toggle active ──────────────────────────────────────────
  const handleToggleActive = async (broker) => {
    try {
      if (broker.is_active) {
        await deactivateBrokerApi(broker.id);
        flash(`${broker.name} deactivated`);
      } else {
        await activateBrokerApi(broker.id);
        flash(`${broker.name} activated`);
      }
      loadBrokers();
      if (selBroker?.id === broker.id)
        setSelBroker((p) => ({ ...p, is_active: !p.is_active }));
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to toggle', 'error');
    }
  };

  // ── Add commission ─────────────────────────────────────────
  const handleAddCommission = async (e) => {
    e.preventDefault();
    if (!commForm.booking_id)     return flash('Select a booking', 'error');
    if (!commForm.commission_pct) return flash('Commission % is required', 'error');
    setSaving(true);
    try {
      await createCommissionApi(selBroker.id, {
        booking_id:     Number(commForm.booking_id),
        commission_pct: Number(commForm.commission_pct),
        remarks:        commForm.remarks || null,
      });
      flash('Commission record created');
      setCommForm({ booking_id: '', commission_pct: '', remarks: '' });
      setShowAddComm(false);
      loadBrokerComms(selBroker);
      loadBrokers();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to create commission', 'error');
    }
    setSaving(false);
  };

  // ── Pay commission ─────────────────────────────────────────
  const handlePayCommission = async (e) => {
    e.preventDefault();
    if (!payForm.amount || !payModal) return flash('Amount is required', 'error');
    setSaving(true);
    try {
      await payCommissionApi(payModal.broker_id, payModal.commission_id, {
        ...payForm,
        amount:            Number(payForm.amount),
        payment_reference: payForm.payment_reference || null,
        remarks:           payForm.remarks           || null,
      });
      flash('Commission payment recorded');
      setPayModal(null);
      setPayForm({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'NEFT',
        payment_reference: '',
        remarks: '',
      });
      if (selBroker) loadBrokerComms(selBroker);
      loadBrokers();
      if (tab === 2) loadAllComms();
      if (tab === 3) loadPending();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to record payment', 'error');
    }
    setSaving(false);
  };

  // ── Load commission payment log ────────────────────────────
  const loadCommPayLog = async (brokerId, commId) => {
    try {
      const { data } = await getCommissionPaymentsApi(brokerId, commId);
      setCommPayLog(data.data?.payments || []);
    } catch {
      setCommPayLog([]);
    }
  };

  // ── Toggle commission row expand ───────────────────────────
  const toggleCommExpand = (commId, brokerId) => {
    if (expandedComm === commId) {
      setExpandedComm(null);
      setCommPayLog([]);
    } else {
      setExpandedComm(commId);
      loadCommPayLog(brokerId, commId);
    }
  };

  // ── Filtered brokers ───────────────────────────────────────
  const displayed = brokers.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.name?.toLowerCase().includes(q)    ||
      b.company?.toLowerCase().includes(q) ||
      b.phone?.includes(q)
    );
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#2d3748]">Broker Management</h2>
        <button
          onClick={() => { resetForm(); setTab(1); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
        >
          <Plus size={15} /> Add Broker
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
            onClick={() => { setTab(i); if (i !== 1) resetForm(); }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              tab === i
                ? 'bg-white text-[#6D94C5] shadow-sm'
                : 'text-[#718096] hover:text-[#2d3748]'
            }`}
          >
            {t}
            {i === 3 && pendingComms.length > 0 && tab !== 3 && (
              <span className="ml-1 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                {pendingComms.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ TAB 0: ALL BROKERS ═══════════════════════════════════════ */}
      {tab === 0 && (
        <div className="space-y-5">

          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Brokers"      value={summary.total_brokers}                          />
              <StatCard label="Active Brokers"     value={summary.active_brokers}          color="text-green-600" />
              <StatCard label="Total Deals"        value={summary.total_deals_sourced}     color="text-[#6D94C5]" />
              <StatCard label="Commission Payable" value={inr(summary.total_commission_payable)} color="text-[#6D94C5]" />
              <StatCard label="Commission Paid"    value={inr(summary.total_commission_paid)}    color="text-green-600" />
              <StatCard label="Commission Pending" value={inr(summary.total_commission_pending)} color="text-red-500" />
              <StatCard label="Pending Records"    value={summary.pending_commission_records}    color="text-orange-500" />
              <StatCard label="Partial Records"    value={summary.partial_commission_records}    color="text-blue-600" />
            </div>
          )}

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, company, phone..."
                className="w-full pl-8 pr-4 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-[#F5EFE6] focus:outline-none focus:border-[#6D94C5]"
              />
            </div>
            {['', 'true', 'false'].map((v) => (
              <button
                key={v}
                onClick={() => setFActive(v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  fActive === v
                    ? 'bg-[#6D94C5] text-white'
                    : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
                }`}
              >
                {v === '' ? 'All' : v === 'true' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>

          {/* Broker cards */}
          {loading ? (
            <Loader />
          ) : displayed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <Users size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No brokers found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayed.map((b) => (
                <div
                  key={b.id}
                  className={`bg-white rounded-2xl border overflow-hidden transition-all ${
                    !b.is_active ? 'border-gray-200 opacity-60' : 'border-[#E8DFCA]'
                  }`}
                >
                  {/* Card header */}
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      b.is_active ? 'bg-[#CBDCEB]' : 'bg-gray-100'
                    }`}>
                      <BadgeCheck size={18} className={b.is_active ? 'text-[#6D94C5]' : 'text-gray-400'} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[#2d3748]">{b.name}</p>
                        {!b.is_active && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">Inactive</span>
                        )}
                        {b.rera_number && (
                          <span className="text-xs bg-[#F5EFE6] text-[#718096] px-2 py-0.5 rounded-full">
                            RERA: {b.rera_number}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-0.5 flex-wrap">
                        {b.company && <p className="text-xs text-[#718096]">🏢 {b.company}</p>}
                        {b.phone   && <p className="text-xs text-[#718096]">📞 {b.phone}</p>}
                        {b.email   && <p className="text-xs text-[#718096]">✉ {b.email}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(b)}
                        className={`p-1.5 rounded-lg transition-all ${
                          b.is_active
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={b.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {b.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                      <button
                        onClick={() => handleEditClick(b)}
                        className="p-1.5 text-[#6D94C5] hover:bg-[#CBDCEB] rounded-lg transition-all"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setSelBroker(b)}
                        className="text-xs px-3 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all"
                      >
                        Details
                      </button>
                    </div>
                  </div>

                  {/* Metrics strip */}
                  <div className="grid grid-cols-4 divide-x divide-[#F5EFE6] border-t border-[#F5EFE6]">
                    {[
                      ['Default %', `${b.commission_pct || 0}%`,       'text-[#2d3748]'],
                      ['Deals',     b.total_deals || 0,                 'text-[#6D94C5]'],
                      ['Earned',    inr(b.total_commission_earned),     'text-[#2d3748]'],
                      ['Pending',   inr(b.total_commission_pending),    'text-red-500'],
                    ].map(([label, val, color]) => (
                      <div key={label} className="px-4 py-2.5">
                        <p className="text-xs text-[#718096]">{label}</p>
                        <p className={`font-bold text-sm ${color}`}>{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 1: ADD / EDIT BROKER ═════════════════════════════════ */}
      {tab === 1 && (
        <div className="bg-white rounded-2xl border border-[#E8DFCA] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2">
              <Users size={16} className="text-[#6D94C5]" />
              {editId ? 'Edit Broker' : 'Add New Broker'}
            </h3>
            {editId && (
              <button
                onClick={resetForm}
                className="flex items-center gap-1 text-xs text-[#718096] hover:text-red-500 transition-colors"
              >
                <X size={12} /> Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Row 1 — Name + Company */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Rajesh Sharma"
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Company</label>
                <input
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                  placeholder="e.g. Sharma Real Estate"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Row 2 — Phone + Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Phone</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="e.g. 9876543210"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="broker@email.com"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Row 3 — RERA + Default Commission % */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">RERA Number</label>
                <input
                  name="rera_number"
                  value={form.rera_number}
                  onChange={handleChange}
                  placeholder="e.g. MH/A/2022/12345"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Default Commission %
                  <span className="ml-1 font-normal text-[#718096]">(can override per booking)</span>
                </label>
                <div className="relative">
                  <input
                    name="commission_pct"
                    type="number"
                    step="0.01"
                    min="0"
                    max="20"
                    value={form.commission_pct}
                    onChange={handleChange}
                    placeholder="e.g. 2.5"
                    className={`${inputCls} pr-8`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718096] text-sm font-bold">%</span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
              >
                {saving ? 'Saving...' : editId ? 'Update Broker' : 'Add Broker'}
              </button>
              <button
                type="button"
                onClick={() => { resetForm(); setTab(0); }}
                className="px-6 py-2.5 bg-[#E8DFCA] text-[#4a5568] text-sm font-semibold rounded-xl hover:bg-[#d4cdb8] transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══ TAB 2: ALL COMMISSIONS ═══════════════════════════════════ */}
      {tab === 2 && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex gap-3 flex-wrap items-center">
            <Filter size={14} className="text-[#718096]" />
            <select
              value={fProject}
              onChange={(e) => setFProject(e.target.value)}
              className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[140px]"
            >
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {['', 'pending', 'partial', 'paid'].map((s) => (
              <button
                key={s}
                onClick={() => setFCommStatus(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                  fCommStatus === s
                    ? 'bg-[#6D94C5] text-white'
                    : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          {/* Total banner */}
          {allComms.length > 0 && (
            <div className="bg-[#6D94C5] rounded-2xl px-5 py-4 grid grid-cols-3 divide-x divide-white/20 text-white">
              {[
                ['Total Earned',  inr(allComms.reduce((s, c) => s + Number(c.commission_amount), 0))],
                ['Total Paid',    inr(allComms.reduce((s, c) => s + Number(c.paid_amount), 0))],
                ['Total Pending', inr(allComms.reduce((s, c) => s + Number(c.balance_payable || 0), 0))],
              ].map(([label, val]) => (
                <div key={label} className="px-4">
                  <p className="text-xs text-white/70">{label}</p>
                  <p className="font-bold text-lg">{val}</p>
                </div>
              ))}
            </div>
          )}

          {allCommsLoading ? (
            <Loader />
          ) : allComms.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <IndianRupee size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No commissions found</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5EFE6]">
                    <tr>
                      {['Broker', 'Project', 'Flat', 'Customer', 'Booking Value', 'Comm %', 'Commission', 'Paid', 'Balance', 'Status', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5EFE6]">
                    {allComms.map((c) => (
                      <tr key={c.id} className="hover:bg-[#F5EFE6] transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#2d3748]">{c.broker_name}</td>
                        <td className="px-4 py-3 text-xs text-[#718096]">{c.project_name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-[#CBDCEB] text-[#2d3748] px-2 py-0.5 rounded-lg font-medium">{c.flat_number}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#718096]">{c.customer_name}</td>
                        <td className="px-4 py-3 font-semibold text-[#2d3748]">{inr(c.booking_value)}</td>
                        <td className="px-4 py-3 font-semibold text-[#6D94C5]">{c.commission_pct}%</td>
                        <td className="px-4 py-3 font-bold text-[#2d3748]">{inr(c.commission_amount)}</td>
                        <td className="px-4 py-3 font-semibold text-green-600">{inr(c.paid_amount)}</td>
                        <td className="px-4 py-3 font-bold text-red-500">{inr(c.balance_payable)}</td>
                        <td className="px-4 py-3"><CommBadge status={c.status} /></td>
                        <td className="px-4 py-3">
                          {c.status !== 'paid' && (
                            <button
                              onClick={() => setPayModal({
                                broker_id:    c.broker_id,
                                commission_id: c.id,
                                balance:      c.balance_payable,
                                brokerName:   c.broker_name,
                                flatNumber:   c.flat_number,
                                commAmount:   c.commission_amount,
                              })}
                              className="text-xs px-3 py-1.5 bg-green-50 text-green-700 font-semibold rounded-lg hover:bg-green-100 transition-all whitespace-nowrap"
                            >
                              Pay
                            </button>
                          )}
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

      {/* ══ TAB 3: PENDING COMMISSIONS ═══════════════════════════════ */}
      {tab === 3 && (
        <div className="space-y-4">

          {/* Project filter */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex items-center gap-3 flex-wrap">
            <Filter size={14} className="text-[#718096]" />
            <select
              value={fProject}
              onChange={(e) => setFProject(e.target.value)}
              className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[160px]"
            >
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              onClick={loadPending}
              className="px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
            >
              Refresh
            </button>
            <span className="text-xs text-[#718096]">{pendingComms.length} pending / partial</span>
          </div>

          {/* Total pending banner */}
          {pendingComms.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-orange-500" />
                <p className="font-bold text-orange-600">{pendingComms.length} commissions to pay</p>
              </div>
              <p className="text-xl font-bold text-orange-500">
                {inr(pendingComms.reduce((s, c) => s + Number(c.balance_payable || 0), 0))}
              </p>
            </div>
          )}

          {pendingLoading ? (
            <Loader />
          ) : pendingComms.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No pending commissions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingComms.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl border border-orange-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <IndianRupee size={16} className="text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[#2d3748]">{c.broker_name}</p>
                        <CommBadge status={c.status} />
                      </div>
                      <p className="text-xs text-[#718096] mt-0.5">
                        {c.project_name} · Flat {c.flat_number} · {c.customer_name}
                      </p>
                      <p className="text-xs text-[#718096]">{c.broker_phone}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-[#718096]">Balance</p>
                      <p className="font-bold text-orange-500 text-lg">{inr(c.balance_payable)}</p>
                      <p className="text-xs text-[#718096]">of {inr(c.commission_amount)}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="px-5 pb-3">
                    <ProgressBar paid={Number(c.paid_amount)} total={Number(c.commission_amount)} />
                  </div>

                  {/* Details row */}
                  <div className="grid grid-cols-3 divide-x divide-[#F5EFE6] border-t border-[#F5EFE6]">
                    {[
                      ['Booking Value', inr(c.booking_value)],
                      ['Comm %',        `${c.commission_pct}%`],
                      ['Paid So Far',   inr(c.paid_amount)],
                    ].map(([label, val]) => (
                      <div key={label} className="px-4 py-2.5">
                        <p className="text-xs text-[#718096]">{label}</p>
                        <p className="text-sm font-semibold text-[#2d3748]">{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Pay action */}
                  <div className="px-5 py-3 border-t border-[#F5EFE6] flex gap-2">
                    <button
                      onClick={() => setPayModal({
                        broker_id:     c.broker_id,
                        commission_id: c.id,
                        balance:       c.balance_payable,
                        brokerName:    c.broker_name,
                        flatNumber:    c.flat_number,
                        commAmount:    c.commission_amount,
                      })}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-xs font-semibold rounded-xl hover:bg-green-600 transition-all"
                    >
                      <IndianRupee size={12} /> Pay Commission
                    </button>
                    {c.broker_phone && (
                      <a
                        href={`tel:${c.broker_phone}`}
                        className="px-4 py-2 bg-[#CBDCEB] text-[#6D94C5] text-xs font-semibold rounded-xl hover:bg-[#b8d0e8] transition-all"
                      >
                        📞 {c.broker_phone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ BROKER DETAIL SLIDE-OVER ══════════════════════════════════ */}
      {selBroker && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/30"
            onClick={() => { setSelBroker(null); setExpandedComm(null); setShowAddComm(false); }}
          />
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">

            {/* Header */}
            <div className="bg-[#6D94C5] px-6 py-5 text-white sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{selBroker.name}</p>
                  {selBroker.company && (
                    <p className="text-[#CBDCEB] text-sm mt-0.5">{selBroker.company}</p>
                  )}
                </div>
                <button
                  onClick={() => { setSelBroker(null); setExpandedComm(null); setShowAddComm(false); }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex gap-3 mt-3 flex-wrap">
                {selBroker.phone       && <p className="text-[#CBDCEB] text-xs">📞 {selBroker.phone}</p>}
                {selBroker.email       && <p className="text-[#CBDCEB] text-xs">✉ {selBroker.email}</p>}
                {selBroker.rera_number && <p className="text-[#CBDCEB] text-xs">RERA: {selBroker.rera_number}</p>}
              </div>
            </div>

            <div className="p-6 space-y-5">

              {/* Summary stats */}
              {brokerCommSumm && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Total Deals',      brokerCommSumm.totals?.total_deals || 0,                 'text-[#6D94C5]'],
                      ['Default Comm %',   `${selBroker.commission_pct || 0}%`,                    'text-[#2d3748]'],
                      ['Total Earned',     inr(brokerCommSumm.totals?.total_commission_amount),    'text-[#2d3748]'],
                      ['Total Paid',       inr(brokerCommSumm.totals?.total_paid),                 'text-green-600'],
                      ['Total Pending',    inr(brokerCommSumm.totals?.total_pending),              'text-red-500'],
                      ['Fully Paid Deals', brokerCommSumm.totals?.deals_fully_paid || 0,           'text-green-600'],
                    ].map(([label, val, color]) => (
                      <div key={label} className="bg-[#F5EFE6] rounded-xl p-3">
                        <p className="text-xs text-[#718096] mb-0.5">{label}</p>
                        <p className={`font-bold ${color}`}>{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* By project breakdown */}
                  {brokerCommSumm.by_project?.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#E8DFCA] overflow-hidden">
                      <p className="text-xs font-bold text-[#718096] px-4 py-3 border-b border-[#E8DFCA]">Project-wise</p>
                      {brokerCommSumm.by_project.map((p) => (
                        <div key={p.project_name} className="flex items-center justify-between px-4 py-3 border-b border-[#F5EFE6] last:border-0">
                          <p className="text-sm font-semibold text-[#2d3748]">{p.project_name}</p>
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#6D94C5]">{inr(p.commission_amount)}</p>
                            <p className="text-xs text-red-500">Pending: {inr(p.pending_amount)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Add commission form */}
              <div>
                <button
                  onClick={() => setShowAddComm(!showAddComm)}
                  className="flex items-center gap-1.5 text-xs text-[#6D94C5] font-semibold hover:underline mb-3"
                >
                  <Plus size={12} /> {showAddComm ? 'Cancel' : 'Add Commission Record'}
                </button>

                {showAddComm && (
                  <form onSubmit={handleAddCommission} className="bg-[#F5EFE6] rounded-xl p-4 space-y-3">
                    <p className="text-xs font-bold text-[#718096]">Link a booking to this broker</p>
                    <div>
                      <label className="block text-xs text-[#718096] mb-1">Booking *</label>
                      <select
                        value={commForm.booking_id}
                        onChange={(e) => setCommForm((p) => ({ ...p, booking_id: e.target.value }))}
                        required
                        className={inputCls}
                      >
                        <option value="">— Select Booking —</option>
                        {bookings
                          .filter((b) => String(b.broker_id) === String(selBroker.id))
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.customer_name} · Flat {b.flat_number} · {b.project_name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#718096] mb-1">Commission % *</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={commForm.commission_pct}
                            onChange={(e) => setCommForm((p) => ({ ...p, commission_pct: e.target.value }))}
                            placeholder={`Default: ${selBroker.commission_pct || 0}%`}
                            required
                            className={`${inputCls} pr-8`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718096] text-sm font-bold">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-[#718096] mb-1">Remarks</label>
                        <input
                          value={commForm.remarks}
                          onChange={(e) => setCommForm((p) => ({ ...p, remarks: e.target.value }))}
                          placeholder="Optional"
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
                    >
                      {saving ? 'Creating...' : 'Create Commission'}
                    </button>
                  </form>
                )}
              </div>

              {/* Commission list */}
              <div>
                <p className="text-xs font-bold text-[#718096] mb-3 uppercase tracking-wide">Commission Records</p>
                {brokerLoading ? (
                  <Loader />
                ) : brokerComms.length === 0 ? (
                  <p className="text-sm text-center text-[#718096] py-6">No commission records yet.</p>
                ) : (
                  <div className="space-y-2">
                    {brokerComms.map((c) => (
                      <div key={c.id} className="bg-white rounded-xl border border-[#E8DFCA] overflow-hidden">

                        {/* Commission row header */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#F5EFE6] transition-colors"
                          onClick={() => toggleCommExpand(c.id, selBroker.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-[#2d3748]">
                                {c.flat_number} · {c.project_name}
                              </p>
                              <CommBadge status={c.status} />
                            </div>
                            <p className="text-xs text-[#718096] mt-0.5">
                              {c.customer_name} · {c.commission_pct}% commission
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-[#2d3748]">{inr(c.commission_amount)}</p>
                            {c.balance_payable > 0 && (
                              <p className="text-xs text-red-500">Due: {inr(c.balance_payable)}</p>
                            )}
                          </div>
                          {expandedComm === c.id
                            ? <ChevronUp size={14} className="text-[#6D94C5]" />
                            : <ChevronDown size={14} className="text-[#718096]" />
                          }
                        </div>

                        {/* Progress bar */}
                        <div className="px-4 pb-2">
                          <ProgressBar paid={Number(c.paid_amount)} total={Number(c.commission_amount)} />
                        </div>

                        {/* Expanded commission detail */}
                        {expandedComm === c.id && (
                          <div className="border-t border-[#F5EFE6] bg-[#F5EFE6] p-4 space-y-3">
                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                ['Booking Value', inr(c.booking_value)],
                                ['Comm Earned',   inr(c.commission_amount)],
                                ['Paid',          inr(c.paid_amount)],
                              ].map(([label, val]) => (
                                <div key={label} className="bg-white rounded-lg p-2.5">
                                  <p className="text-xs text-[#718096]">{label}</p>
                                  <p className="text-sm font-bold text-[#2d3748]">{val}</p>
                                </div>
                              ))}
                            </div>

                            {/* Payment log */}
                            {commPayLog.length > 0 && (
                              <div className="bg-white rounded-lg overflow-hidden">
                                <p className="text-xs font-bold text-[#718096] px-3 py-2 border-b border-[#E8DFCA]">
                                  Payment History
                                </p>
                                {commPayLog.map((log, idx) => (
                                  <div key={log.id} className="flex items-center justify-between px-3 py-2.5 border-b border-[#F5EFE6] last:border-0">
                                    <div>
                                      <p className="text-xs font-semibold text-[#2d3748]">
                                        #{idx + 1} · {log.payment_mode}
                                        {log.payment_reference && ` · ${log.payment_reference}`}
                                      </p>
                                      <p className="text-xs text-[#718096]">
                                        {fmtDate(log.payment_date)} · {log.paid_by_name}
                                      </p>
                                    </div>
                                    <p className="font-bold text-green-600 text-sm">{inr(log.amount)}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Pay button */}
                            {c.status !== 'paid' && (
                              <button
                                onClick={() => setPayModal({
                                  broker_id:     selBroker.id,
                                  commission_id: c.id,
                                  balance:       c.balance_payable,
                                  brokerName:    selBroker.name,
                                  flatNumber:    c.flat_number,
                                  commAmount:    c.commission_amount,
                                })}
                                className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-xs font-semibold rounded-xl hover:bg-green-600 transition-all"
                              >
                                <IndianRupee size={12} /> Pay Commission
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit + Toggle action buttons */}
              <div className="flex gap-3 pt-2 border-t border-[#E8DFCA]">
                <button
                  onClick={() => { handleEditClick(selBroker); setSelBroker(null); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
                >
                  <Pencil size={13} /> Edit Broker
                </button>
                <button
                  onClick={() => handleToggleActive(selBroker)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                    selBroker.is_active
                      ? 'bg-red-50 text-red-500 hover:bg-red-100'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {selBroker.is_active
                    ? <><ToggleLeft size={13} /> Deactivate</>
                    : <><ToggleRight size={13} /> Activate</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ PAY COMMISSION MODAL ═════════════════════════════════════ */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPayModal(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="bg-green-500 px-6 py-4">
              <p className="font-bold text-white flex items-center gap-2">
                <IndianRupee size={16} /> Pay Commission
              </p>
              <p className="text-green-100 text-sm mt-0.5">
                {payModal.brokerName} · Flat {payModal.flatNumber}
              </p>
            </div>

            <form onSubmit={handlePayCommission} className="p-6 space-y-4">

              {/* Balance due */}
              <div className="bg-green-50 rounded-xl px-4 py-3 flex justify-between items-center">
                <p className="text-sm font-semibold text-[#2d3748]">Balance Payable</p>
                <p className="text-xl font-bold text-green-600">{inr(payModal.balance)}</p>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Amount <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
                  <input
                    type="number"
                    value={payForm.amount}
                    onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder={`Max: ${inr(payModal.balance)}`}
                    required
                    className={`${inputCls} pl-8`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPayForm((p) => ({ ...p, amount: String(payModal.balance) }))}
                  className="text-xs text-[#6D94C5] hover:underline mt-1"
                >
                  Pay full balance ({inr(payModal.balance)})
                </button>
              </div>

              {/* Date + Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Payment Date</label>
                  <input
                    type="date"
                    value={payForm.payment_date}
                    onChange={(e) => setPayForm((p) => ({ ...p, payment_date: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Payment Mode</label>
                  <select
                    value={payForm.payment_mode}
                    onChange={(e) => setPayForm((p) => ({ ...p, payment_mode: e.target.value }))}
                    className={inputCls}
                  >
                    {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Reference No.</label>
                <input
                  value={payForm.payment_reference}
                  onChange={(e) => setPayForm((p) => ({ ...p, payment_reference: e.target.value }))}
                  placeholder="Cheque / UTR number"
                  className={inputCls}
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Remarks</label>
                <input
                  value={payForm.remarks}
                  onChange={(e) => setPayForm((p) => ({ ...p, remarks: e.target.value }))}
                  placeholder="Optional"
                  className={inputCls}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 disabled:opacity-60 transition-all"
                >
                  {saving ? 'Recording...' : 'Confirm Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => setPayModal(null)}
                  className="flex-1 py-2.5 bg-[#E8DFCA] text-[#4a5568] text-sm font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}