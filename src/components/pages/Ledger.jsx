import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  BookOpen, Search, User, IndianRupee,
  ChevronDown, ChevronUp, X, Filter,
  CheckCircle, AlertCircle, Printer,
  Calendar, Clock, TrendingUp,
} from 'lucide-react';
import {
  getAllCustomerSummariesApi, getCustomerLedgerApi,
  getStatementApi, getOverdueCustomersApi,
  getFullyPaidCustomersApi,
} from '../../services/repository/ledgerRepository';
import { getProjectsApi } from '../../services/repository/projectRepository';
import Loader from '../common/Loader';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ['All Customers', 'Customer Ledger', 'Statement', 'Overdue', 'Fully Paid'];

const inr     = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const inputCls =
  'w-full px-4 py-2.5 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] transition-colors';

// ─── Progress bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ paid, total, height = 'h-2' }) => {
  const pct   = total ? Math.min(Math.round((paid / total) * 100), 100) : 0;
  const color = pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-[#6D94C5]' : pct >= 30 ? 'bg-orange-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-[#E8DFCA] rounded-full ${height} overflow-hidden`}>
        <div className={`${height} rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-[#718096] w-8">{pct}%</span>
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color = 'text-[#6D94C5]' }) => (
  <div className="bg-white rounded-xl border border-[#E8DFCA] p-4">
    <p className="text-xs text-[#718096] font-medium mb-1">{label}</p>
    <p className={`text-lg font-bold ${color}`}>{value}</p>
  </div>
);

// ─── Milestone status label ────────────────────────────────────────────────────
const MilestoneStatus = ({ status }) => {
  const map = {
    paid:         'bg-green-100 text-green-700',
    overdue:      'bg-red-100 text-red-600',
    upcoming:     'bg-blue-100 text-blue-700',
    no_due_date:  'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${map[status] || 'bg-gray-100 text-gray-500'}`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

// ─── Print helper ─────────────────────────────────────────────────────────────
const printRef = (ref) => {
  const content = ref.current?.innerHTML;
  if (!content) return;
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Account Statement — Nivara Ventures</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; color: #2d3748; padding: 24px; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      h2 { font-size: 14px; margin-bottom: 16px; color: #718096; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #f5f5f5; padding: 8px 12px; text-align: left; font-size: 11px; color: #718096; border-bottom: 1px solid #e2e8f0; }
      td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
      .summary { display: flex; gap: 24px; margin: 16px 0; }
      .summary-box { background: #f5f5f5; padding: 12px 16px; border-radius: 8px; }
      .amount { font-weight: bold; }
      .balance-col { font-weight: bold; color: #c53030; }
      @media print { @page { margin: 16mm; } }
    </style></head><body>${content}</body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Ledger() {
  const [tab,      setTab]      = useState(0);
  const [customers,setCustomers]= useState([]);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState({ text: '', type: '' });

  // All customers filters
  const [search,     setSearch]    = useState('');
  const [fProject,   setFProject]  = useState('');
  const [showOverdue,setShowOverdue] = useState(false);

  // Customer Ledger tab
  const [selCustomerId, setSelCustomerId] = useState('');
  const [ledger,        setLedger]        = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [expandedBooking, setExpandedBooking] = useState(null);

  // Statement tab
  const [stmtCustomerId, setStmtCustomerId] = useState('');
  const [stmtFrom,       setStmtFrom]       = useState('');
  const [stmtTo,         setStmtTo]         = useState('');
  const [statement,      setStatement]      = useState(null);
  const [stmtLoading,    setStmtLoading]    = useState(false);
  const printArea = useRef(null);

  // Overdue tab
  const [overdue,       setOverdue]      = useState([]);
  const [ovProject,     setOvProject]    = useState('');
  const [overdueLoading,setOverdueLoading] = useState(false);

  // Fully Paid tab
  const [fullyPaid,     setFullyPaid]    = useState([]);
  const [fpProject,     setFpProject]    = useState('');
  const [fpLoading,     setFpLoading]    = useState(false);

  // ── Flash ──────────────────────────────────────────────────
  const flash = useCallback((text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
  }, []);

  // ── Load all customers ─────────────────────────────────────
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fProject) params.project_id = fProject;
      if (search)   params.search     = search;
      const [cRes, pRes] = await Promise.all([
        getAllCustomerSummariesApi(params),
        getProjectsApi(),
      ]);
      setCustomers(cRes.data.data?.customers || []);
      setProjects(pRes.data.data?.projects   || []);
    } catch {
      flash('Failed to load customers', 'error');
    }
    setLoading(false);
  }, [fProject, search, flash]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  // ── Load customer ledger ───────────────────────────────────
  const loadLedger = useCallback(async (id) => {
    if (!id) return;
    setLedgerLoading(true);
    setLedger(null);
    setExpandedBooking(null);
    try {
      const { data } = await getCustomerLedgerApi(id);
      setLedger(data.data);
    } catch {
      flash('Failed to load ledger', 'error');
    }
    setLedgerLoading(false);
  }, [flash]);

  useEffect(() => { if (tab === 1 && selCustomerId) loadLedger(selCustomerId); }, [tab, selCustomerId, loadLedger]);

  // ── Load statement ─────────────────────────────────────────
  const loadStatement = useCallback(async () => {
    if (!stmtCustomerId) return flash('Select a customer', 'error');
    setStmtLoading(true);
    setStatement(null);
    try {
      const params = {};
      if (stmtFrom) params.from_date = stmtFrom;
      if (stmtTo)   params.to_date   = stmtTo;
      const { data } = await getStatementApi(stmtCustomerId, params);
      setStatement(data.data);
    } catch {
      flash('Failed to load statement', 'error');
    }
    setStmtLoading(false);
  }, [stmtCustomerId, stmtFrom, stmtTo, flash]);

  // ── Load overdue ───────────────────────────────────────────
  const loadOverdue = useCallback(async () => {
    setOverdueLoading(true);
    try {
      const params = ovProject ? { project_id: ovProject } : {};
      const { data } = await getOverdueCustomersApi(params);
      setOverdue(data.data?.customers || []);
    } catch {
      flash('Failed to load overdue', 'error');
    }
    setOverdueLoading(false);
  }, [ovProject, flash]);

  // ── Load fully paid ────────────────────────────────────────
  const loadFullyPaid = useCallback(async () => {
    setFpLoading(true);
    try {
      const params = fpProject ? { project_id: fpProject } : {};
      const { data } = await getFullyPaidCustomersApi(params);
      setFullyPaid(data.data?.customers || []);
    } catch {
      flash('Failed to load fully paid', 'error');
    }
    setFpLoading(false);
  }, [fpProject, flash]);

  useEffect(() => { if (tab === 3) loadOverdue();  }, [tab, loadOverdue]);
  useEffect(() => { if (tab === 4) loadFullyPaid();}, [tab, loadFullyPaid]);

  // ── Filtered customer list ─────────────────────────────────
  const displayed = customers.filter((c) => {
    if (showOverdue && !c.has_overdue) return false;
    return true;
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#2d3748]">Customer Ledger</h2>
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

      {/* ══ TAB 0: ALL CUSTOMERS ═════════════════════════════════════ */}
      {tab === 0 && (
        <div className="space-y-4">

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 space-y-3">
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, phone, or email..."
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
              <button
                onClick={() => setShowOverdue(!showOverdue)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                  showOverdue
                    ? 'bg-red-50 text-red-600 border-red-300'
                    : 'bg-white text-[#718096] border-[#E8DFCA] hover:border-[#6D94C5]'
                }`}
              >
                <AlertCircle size={12} /> Overdue Only
              </button>
              {(search || fProject || showOverdue) && (
                <button
                  onClick={() => { setSearch(''); setFProject(''); setShowOverdue(false); }}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Summary strip */}
          {customers.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Customers"  value={customers.length} />
              <StatCard label="Total Agreed"     value={inr(customers.reduce((s, c) => s + Number(c.total_agreement_value || 0), 0))} color="text-[#6D94C5]" />
              <StatCard label="Total Collected"  value={inr(customers.reduce((s, c) => s + Number(c.total_paid           || 0), 0))} color="text-green-600" />
              <StatCard label="Total Pending"    value={inr(customers.reduce((s, c) => s + Number(c.total_balance_due    || 0), 0))} color="text-red-500" />
            </div>
          )}

          {/* Customer cards */}
          {loading ? (
            <Loader />
          ) : displayed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <User size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No customers found</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5EFE6]">
                    <tr>
                      {['Customer', 'Bookings', 'Agreed', 'Paid', 'Balance', 'Progress', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5EFE6]">
                    {displayed.map((c) => (
                      <tr key={c.customer_id} className="hover:bg-[#F5EFE6] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-[#CBDCEB] rounded-xl flex items-center justify-center flex-shrink-0">
                              <User size={14} className="text-[#6D94C5]" />
                            </div>
                            <div>
                              <p className="font-semibold text-[#2d3748]">{c.customer_name}</p>
                              <p className="text-xs text-[#718096]">{c.phone}</p>
                            </div>
                            {c.has_overdue && (
                              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">!</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-[#CBDCEB] text-[#6D94C5] px-2.5 py-1 rounded-full font-semibold">
                            {c.total_bookings}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#2d3748]">{inr(c.total_agreement_value)}</td>
                        <td className="px-4 py-3 font-semibold text-green-600">{inr(c.total_paid)}</td>
                        <td className="px-4 py-3 font-bold text-red-500">{inr(c.total_balance_due)}</td>
                        <td className="px-4 py-3 w-32">
                          <ProgressBar paid={Number(c.total_paid)} total={Number(c.total_agreement_value)} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setSelCustomerId(String(c.customer_id));
                                setTab(1);
                              }}
                              className="text-xs px-2.5 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all whitespace-nowrap"
                            >
                              Ledger
                            </button>
                            <button
                              onClick={() => {
                                setStmtCustomerId(String(c.customer_id));
                                setTab(2);
                              }}
                              className="text-xs px-2.5 py-1.5 bg-[#CBDCEB] text-[#6D94C5] font-semibold rounded-lg hover:bg-[#b8d0e8] transition-all"
                            >
                              Stmt
                            </button>
                          </div>
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

      {/* ══ TAB 1: CUSTOMER LEDGER ═══════════════════════════════════ */}
      {tab === 1 && (
        <div className="space-y-5">

          {/* Customer selector */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-5 flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Select Customer</label>
              <select
                value={selCustomerId}
                onChange={(e) => setSelCustomerId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Choose a customer —</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.customer_name}{c.phone ? ` · ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => loadLedger(selCustomerId)}
              disabled={!selCustomerId}
              className="px-5 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-50 transition-all"
            >
              Load Ledger
            </button>
          </div>

          {ledgerLoading ? (
            <Loader />
          ) : ledger ? (
            <div className="space-y-5">

              {/* Customer profile header */}
              <div className="bg-[#6D94C5] rounded-2xl p-5 text-white">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-xl font-bold">{ledger.customer.name}</p>
                    <div className="flex flex-wrap gap-4 mt-1">
                      {ledger.customer.phone && (
                        <p className="text-[#CBDCEB] text-sm">📞 {ledger.customer.phone}</p>
                      )}
                      {ledger.customer.email && (
                        <p className="text-[#CBDCEB] text-sm">✉ {ledger.customer.email}</p>
                      )}
                      {ledger.customer.pan_number && (
                        <p className="text-[#CBDCEB] text-sm">PAN: {ledger.customer.pan_number}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#CBDCEB] text-xs">Overall Progress</p>
                    <p className="text-2xl font-bold">{ledger.summary.overall_percent_paid}%</p>
                  </div>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Bookings"    value={ledger.summary.total_bookings} />
                <StatCard label="Agreement Value"   value={inr(ledger.summary.total_agreement_value)} color="text-[#6D94C5]" />
                <StatCard label="Total Paid"        value={inr(ledger.summary.total_paid)}             color="text-green-600" />
                <StatCard label="Balance Due"       value={inr(ledger.summary.total_balance_due)}      color="text-red-500" />
              </div>

              {/* Overall progress bar */}
              <div className="bg-white rounded-xl border border-[#E8DFCA] p-4">
                <div className="flex justify-between mb-2">
                  <p className="text-xs font-semibold text-[#718096]">Overall Collection Progress</p>
                  <p className="text-xs font-bold text-[#6D94C5]">{ledger.summary.overall_percent_paid}%</p>
                </div>
                <ProgressBar
                  paid={Number(ledger.summary.total_paid)}
                  total={Number(ledger.summary.total_agreement_value)}
                  height="h-3"
                />
              </div>

              {/* Per-booking ledger sections */}
              {ledger.bookings.map((booking) => (
                <div key={booking.booking_id} className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">

                  {/* Booking header */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#F5EFE6] transition-colors"
                    onClick={() => setExpandedBooking(expandedBooking === booking.booking_id ? null : booking.booking_id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#CBDCEB] rounded-xl flex items-center justify-center flex-shrink-0">
                        <BookOpen size={16} className="text-[#6D94C5]" />
                      </div>
                      <div>
                        <p className="font-bold text-[#2d3748]">
                          {booking.project_name} — Flat {booking.flat_number}
                        </p>
                        <p className="text-xs text-[#718096]">
                          Floor {booking.floor} · {booking.configuration}
                          {booking.broker_name && ` · Broker: ${booking.broker_name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-[#718096]">Balance</p>
                        <p className={`font-bold ${Number(booking.totals.balance_due) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {inr(booking.totals.balance_due)}
                        </p>
                      </div>
                      {expandedBooking === booking.booking_id
                        ? <ChevronUp size={16} className="text-[#6D94C5]" />
                        : <ChevronDown size={16} className="text-[#718096]" />
                      }
                    </div>
                  </div>

                  {/* Booking summary strip */}
                  <div className="grid grid-cols-4 divide-x divide-[#F5EFE6] border-t border-[#F5EFE6]">
                    {[
                      ['Agreement', inr(booking.final_value),            'text-[#2d3748]'],
                      ['Paid',      inr(booking.totals.total_paid),      'text-green-600'],
                      ['Balance',   inr(booking.totals.balance_due),     'text-red-500'],
                      ['Progress',  `${booking.totals.percent_paid}%`,   'text-[#6D94C5]'],
                    ].map(([label, val, color]) => (
                      <div key={label} className="px-4 py-2">
                        <p className="text-xs text-[#718096]">{label}</p>
                        <p className={`font-bold text-sm ${color}`}>{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Expanded booking detail */}
                  {expandedBooking === booking.booking_id && (
                    <div className="border-t border-[#F5EFE6] bg-[#F5EFE6] p-5 space-y-5">

                      {/* Payment schedule */}
                      {booking.payment_schedule?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-[#718096] mb-2 uppercase tracking-wide">Payment Schedule</p>
                          <div className="bg-white rounded-xl overflow-hidden border border-[#E8DFCA]">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-[#F5EFE6]">
                                  <tr>
                                    {['Milestone', 'Due Date', 'Amount Due', 'Paid', 'Pending', 'Status'].map((h) => (
                                      <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#F5EFE6]">
                                  {booking.payment_schedule.map((s) => (
                                    <tr key={s.id} className={`${s.milestone_status === 'overdue' ? 'bg-red-50' : ''}`}>
                                      <td className="px-4 py-2.5 font-semibold text-[#2d3748]">{s.milestone}</td>
                                      <td className="px-4 py-2.5 text-xs text-[#718096]">{fmtDate(s.due_date)}</td>
                                      <td className="px-4 py-2.5 font-semibold">{inr(s.amount_due)}</td>
                                      <td className="px-4 py-2.5 text-green-600 font-semibold">{inr(s.amount_paid)}</td>
                                      <td className="px-4 py-2.5 text-red-500 font-semibold">{inr(s.amount_pending)}</td>
                                      <td className="px-4 py-2.5"><MilestoneStatus status={s.milestone_status} /></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Payment ledger rows */}
                      {booking.ledger?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-[#718096] mb-2 uppercase tracking-wide">Payment History</p>
                          <div className="bg-white rounded-xl overflow-hidden border border-[#E8DFCA]">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-[#F5EFE6]">
                                  <tr>
                                    {['#', 'Date', 'Amount', 'Type', 'Mode', 'Reference', 'Milestone', 'Running Total', 'Balance After'].map((h) => (
                                      <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#F5EFE6]">
                                  {booking.ledger.map((row, idx) => (
                                    <tr key={row.id} className="hover:bg-[#F5EFE6] transition-colors">
                                      <td className="px-4 py-2.5 text-xs text-[#718096]">{idx + 1}</td>
                                      <td className="px-4 py-2.5 text-xs text-[#718096] whitespace-nowrap">{fmtDate(row.payment_date)}</td>
                                      <td className="px-4 py-2.5 font-bold text-green-600">{inr(row.amount)}</td>
                                      <td className="px-4 py-2.5">
                                        <span className="text-xs bg-[#CBDCEB] text-[#6D94C5] px-2 py-0.5 rounded-full font-semibold capitalize">{row.payment_type}</span>
                                      </td>
                                      <td className="px-4 py-2.5 text-xs text-[#718096] capitalize">{row.payment_mode}</td>
                                      <td className="px-4 py-2.5 text-xs text-[#718096]">{row.reference_no || '—'}</td>
                                      <td className="px-4 py-2.5 text-xs text-[#718096]">{row.milestone || '—'}</td>
                                      <td className="px-4 py-2.5 font-semibold text-[#6D94C5]">{inr(row.running_total)}</td>
                                      <td className="px-4 py-2.5 font-bold text-red-500">{inr(row.balance_after)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-[#F5EFE6]">
                                    <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-[#718096]">
                                      {booking.ledger.length} payments
                                    </td>
                                    <td className="px-4 py-2.5 font-bold text-green-600">
                                      {inr(booking.totals.total_paid)}
                                    </td>
                                    <td colSpan={5} className="px-4 py-2.5 text-right text-xs font-bold text-red-500">
                                      Balance: {inr(booking.totals.balance_due)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Empty payment state */}
                      {(!booking.ledger || booking.ledger.length === 0) && (
                        <div className="text-center py-6 text-[#718096] text-sm">
                          No payments recorded yet for this booking.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <BookOpen size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">Select a customer to view their full ledger</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 2: STATEMENT ═════════════════════════════════════════ */}
      {tab === 2 && (
        <div className="space-y-5">

          {/* Controls */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-5">
            <p className="text-sm font-bold text-[#2d3748] mb-4 flex items-center gap-2">
              <Printer size={15} className="text-[#6D94C5]" /> Generate Account Statement
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Customer</label>
                <select
                  value={stmtCustomerId}
                  onChange={(e) => setStmtCustomerId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Select Customer —</option>
                  {customers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.customer_name}{c.phone ? ` · ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">From Date</label>
                <input
                  type="date" value={stmtFrom}
                  onChange={(e) => setStmtFrom(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">To Date</label>
                <input
                  type="date" value={stmtTo}
                  onChange={(e) => setStmtTo(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={loadStatement}
                disabled={stmtLoading || !stmtCustomerId}
                className="px-5 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
              >
                {stmtLoading ? 'Loading...' : 'Generate'}
              </button>
              {statement && (
                <button
                  onClick={() => printRef(printArea)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#E8DFCA] text-[#4a5568] text-sm font-semibold rounded-xl hover:bg-[#d4cdb8] transition-all"
                >
                  <Printer size={14} /> Print / Download
                </button>
              )}
            </div>
          </div>

          {stmtLoading ? (
            <Loader />
          ) : statement ? (
            // Printable area
            <div ref={printArea}>
              {/* Statement header */}
              <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                <div className="bg-[#1a365d] px-6 py-5">
                  <h1 className="text-white font-bold text-lg">Account Statement</h1>
                  <p className="text-[#CBDCEB] text-sm">Nivara Ventures — Real Estate Development</p>
                </div>

                <div className="px-6 py-5 border-b border-[#E8DFCA]">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-[#718096]">Customer</p>
                      <p className="font-bold text-[#2d3748]">{statement.customer.name}</p>
                      <p className="text-xs text-[#718096]">{statement.customer.phone}</p>
                    </div>
                    {statement.customer.pan_number && (
                      <div>
                        <p className="text-xs text-[#718096]">PAN</p>
                        <p className="font-semibold text-[#2d3748]">{statement.customer.pan_number}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-[#718096]">Period</p>
                      <p className="font-semibold text-[#2d3748]">
                        {statement.period.from_date ? fmtDate(statement.period.from_date) : 'All time'}
                        {statement.period.to_date && ` to ${fmtDate(statement.period.to_date)}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#718096]">Generated At</p>
                      <p className="font-semibold text-[#2d3748]">{fmtDate(statement.generated_at)}</p>
                    </div>
                  </div>
                </div>

                {/* Summary boxes */}
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#F5EFE6] border-b border-[#F5EFE6]">
                  {[
                    ['Agreement Value',    inr(statement.summary.total_agreement_value), 'text-[#2d3748]'],
                    ['Total Paid',         inr(statement.summary.total_paid),            'text-green-600'],
                    ['Balance Due',        inr(statement.summary.balance_due),           'text-red-500'],
                    ['Total Transactions', statement.summary.total_transactions,         'text-[#6D94C5]'],
                  ].map(([label, val, color]) => (
                    <div key={label} className="px-5 py-4">
                      <p className="text-xs text-[#718096]">{label}</p>
                      <p className={`font-bold text-lg ${color}`}>{val}</p>
                    </div>
                  ))}
                </div>

                {/* Statement table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F5EFE6]">
                      <tr>
                        {['#', 'Date', 'Project', 'Flat', 'Milestone', 'Type', 'Mode', 'Reference', 'Amount', 'Running Total', 'Balance After'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5EFE6]">
                      {statement.statement.map((row, idx) => (
                        <tr key={row.payment_id} className="hover:bg-[#F5EFE6] transition-colors">
                          <td className="px-4 py-3 text-xs text-[#718096]">{idx + 1}</td>
                          <td className="px-4 py-3 text-xs text-[#718096] whitespace-nowrap">{fmtDate(row.payment_date)}</td>
                          <td className="px-4 py-3 text-xs text-[#718096]">{row.project_name}</td>
                          <td className="px-4 py-3 font-medium text-[#2d3748]">{row.flat_number}</td>
                          <td className="px-4 py-3 text-xs text-[#718096]">{row.milestone || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-[#CBDCEB] text-[#6D94C5] px-2 py-0.5 rounded-full font-semibold capitalize">{row.payment_type}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#718096] capitalize">{row.payment_mode}</td>
                          <td className="px-4 py-3 text-xs text-[#718096]">{row.reference_no || '—'}</td>
                          <td className="px-4 py-3 font-bold text-green-600 whitespace-nowrap">{inr(row.amount)}</td>
                          <td className="px-4 py-3 font-semibold text-[#6D94C5] whitespace-nowrap">{inr(row.running_total)}</td>
                          <td className="px-4 py-3 font-bold text-red-500 whitespace-nowrap">{inr(row.balance_after)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#F5EFE6]">
                        <td colSpan={8} className="px-4 py-3 text-xs font-bold text-[#718096]">
                          {statement.statement.length} transactions
                        </td>
                        <td className="px-4 py-3 font-bold text-green-600">{inr(statement.summary.total_paid)}</td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 font-bold text-red-500">{inr(statement.summary.balance_due)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Statement footer */}
                <div className="px-6 py-4 bg-[#F5EFE6] text-xs text-[#718096] text-center">
                  This is a computer-generated statement. No signature required. · Nivara Ventures Real Estate Development
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <Printer size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">Select a customer and click Generate</p>
              <p className="text-xs text-[#718096] mt-1">Optionally filter by date range for a partial period statement</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 3: OVERDUE CUSTOMERS ═════════════════════════════════ */}
      {tab === 3 && (
        <div className="space-y-4">

          {/* Filter */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex items-center gap-3 flex-wrap">
            <Filter size={14} className="text-[#718096]" />
            <select
              value={ovProject}
              onChange={(e) => setOvProject(e.target.value)}
              className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[160px]"
            >
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              onClick={loadOverdue}
              className="px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
            >
              Refresh
            </button>
            <span className="text-xs text-[#718096]">{overdue.length} customers with overdue</span>
          </div>

          {/* Total overdue banner */}
          {overdue.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-500" />
                <p className="font-bold text-red-600">{overdue.length} customers with overdue milestones</p>
              </div>
              <p className="text-xl font-bold text-red-500">
                {inr(overdue.reduce((s, o) => s + Number(o.total_overdue_amount || 0), 0))}
              </p>
            </div>
          )}

          {overdueLoading ? (
            <Loader />
          ) : overdue.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No overdue customers</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overdue.map((o) => (
                <div key={o.customer_id} className="bg-white rounded-2xl border border-red-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <AlertCircle size={16} className="text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[#2d3748]">{o.customer_name}</p>
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                          {o.overdue_milestones} overdue milestone{o.overdue_milestones > 1 ? 's' : ''}
                        </span>
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-semibold">
                          Max {o.max_days_overdue} days late
                        </span>
                      </div>
                      <p className="text-xs text-[#718096] mt-0.5">
                        {o.project_name} · Flat {o.flat_number} · {o.configuration}
                      </p>
                      <p className="text-xs text-[#718096]">
                        Earliest overdue: {fmtDate(o.earliest_overdue_date)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-red-500 text-lg">{inr(o.total_overdue_amount)}</p>
                      {o.phone && (
                        <a href={`tel:${o.phone}`} className="text-xs text-[#6D94C5] hover:underline">
                          📞 {o.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="px-5 pb-3 flex gap-2">
                    <button
                      onClick={() => {
                        setSelCustomerId(String(o.customer_id));
                        setTab(1);
                      }}
                      className="text-xs px-3 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all"
                    >
                      View Ledger
                    </button>
                    <button
                      onClick={() => {
                        setStmtCustomerId(String(o.customer_id));
                        setTab(2);
                      }}
                      className="text-xs px-3 py-1.5 bg-[#CBDCEB] text-[#6D94C5] font-semibold rounded-lg hover:bg-[#b8d0e8] transition-all"
                    >
                      Statement
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 4: FULLY PAID ════════════════════════════════════════ */}
      {tab === 4 && (
        <div className="space-y-4">

          {/* Filter */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex items-center gap-3 flex-wrap">
            <Filter size={14} className="text-[#718096]" />
            <select
              value={fpProject}
              onChange={(e) => setFpProject(e.target.value)}
              className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[160px]"
            >
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              onClick={loadFullyPaid}
              className="px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
            >
              Refresh
            </button>
            <span className="text-xs text-[#718096]">{fullyPaid.length} fully paid bookings</span>
          </div>

          {/* Total collected from fully paid */}
          {fullyPaid.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                <p className="font-bold text-green-700">{fullyPaid.length} fully paid bookings</p>
              </div>
              <p className="text-xl font-bold text-green-600">
                {inr(fullyPaid.reduce((s, f) => s + Number(f.final_value || 0), 0))}
              </p>
            </div>
          )}

          {fpLoading ? (
            <Loader />
          ) : fullyPaid.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <TrendingUp size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No fully paid bookings yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5EFE6]">
                    <tr>
                      {['Customer', 'Project', 'Flat', 'Agreement Value', 'Total Paid', 'Last Payment', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5EFE6]">
                    {fullyPaid.map((f) => (
                      <tr key={f.booking_id} className="hover:bg-[#F5EFE6] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center">
                              <CheckCircle size={14} className="text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-[#2d3748]">{f.customer_name}</p>
                              <p className="text-xs text-[#718096]">{f.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#718096]">{f.project_name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">
                            {f.flat_number}
                          </span>
                          <p className="text-xs text-[#718096] mt-0.5">{f.configuration}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#2d3748]">{inr(f.final_value)}</td>
                        <td className="px-4 py-3 font-bold text-green-600">{inr(f.total_paid)}</td>
                        <td className="px-4 py-3 text-xs text-[#718096]">
                          <div className="flex items-center gap-1">
                            <Clock size={11} />
                            {fmtDate(f.last_payment_date)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setSelCustomerId(String(f.customer_id));
                              setTab(1);
                            }}
                            className="text-xs px-2.5 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all"
                          >
                            Ledger
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
    </div>
  );
}