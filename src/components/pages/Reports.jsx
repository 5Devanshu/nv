import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart2, TrendingUp, IndianRupee,
  Home, Users, Building2, Filter,
  RefreshCw, ChevronRight,
} from 'lucide-react';
import {
  getDashboardApi, getProjectReportApi,
  getSalesReportApi, getMonthlySalesApi,
  getCollectionReportApi, getMonthlyCollApi,
  getExpenseReportApi, getBrokerPerfApi,
  getInventorySnapApi,
} from '../../services/repository/reportRepository';
import { getProjectsApi } from '../../services/repository/projectRepository';
import Loader from '../common/Loader';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = [
  'Dashboard', 'Project Report', 'Sales',
  'Collections', 'Expenses', 'Broker Performance', 'Inventory',
];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const inr     = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';
const pct = (v) => `${Number(v || 0).toFixed(1)}%`;

// ─── Reusable stat card ───────────────────────────────────────────────────────
const StatCard = ({ label, value, color = 'text-[#6D94C5]', icon: Icon, sub }) => (
  <div className="bg-white rounded-2xl border border-[#E8DFCA] p-5">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-xs text-[#718096] font-medium mb-1">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-[#718096] mt-1">{sub}</p>}
      </div>
      {Icon && (
        <div className="w-9 h-9 bg-[#CBDCEB] rounded-xl flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-[#6D94C5]" />
        </div>
      )}
    </div>
  </div>
);

// ─── Simple CSS bar chart ──────────────────────────────────────────────────────
const BarChart = ({ data, labelKey, valueKey, color = 'bg-[#6D94C5]', formatValue = inr }) => {
  const maxVal = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d, i) => {
        const h = Math.max((Number(d[valueKey]) / maxVal) * 100, 2);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <p className="text-xs text-[#718096] text-center opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {formatValue(d[valueKey])}
            </p>
            <div
              className={`w-full ${color} rounded-t-lg transition-all hover:opacity-80 cursor-default`}
              style={{ height: `${h}%` }}
              title={`${d[labelKey]}: ${formatValue(d[valueKey])}`}
            />
            <p className="text-xs text-[#718096] text-center whitespace-nowrap truncate w-full">
              {d[labelKey]}
            </p>
          </div>
        );
      })}
    </div>
  );
};

// ─── Progress bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ paid, total, height = 'h-2' }) => {
  const p     = total ? Math.min(Math.round((Number(paid) / Number(total)) * 100), 100) : 0;
  const color = p >= 100 ? 'bg-green-500' : p >= 60 ? 'bg-[#6D94C5]' : p >= 30 ? 'bg-orange-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-[#E8DFCA] rounded-full ${height} overflow-hidden`}>
        <div className={`${height} rounded-full ${color} transition-all`} style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs font-bold text-[#718096] w-8">{p}%</span>
    </div>
  );
};

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, sub }) => (
  <div className="px-5 py-4 bg-[#F5EFE6] border-b border-[#E8DFCA]">
    <p className="font-bold text-[#2d3748] text-sm">{title}</p>
    {sub && <p className="text-xs text-[#718096] mt-0.5">{sub}</p>}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Reports() {
  const [tab,      setTab]     = useState(0);
  const [projects, setProjects]= useState([]);
  const [loading,  setLoading] = useState(false);
  const [msg,      setMsg]     = useState({ text: '', type: '' });

  // Tab 0 — Dashboard
  const [dashboard, setDashboard] = useState(null);

  // Tab 1 — Project Report
  const [selProject, setSelProject] = useState('');
  const [projReport, setProjReport] = useState(null);

  // Tab 2 — Sales
  const [salesData,     setSalesData]     = useState(null);
  const [monthlySales,  setMonthlySales]  = useState(null);
  const [salesProject,  setSalesProject]  = useState('');
  const [salesFrom,     setSalesFrom]     = useState('');
  const [salesTo,       setSalesTo]       = useState('');
  const [salesYear,     setSalesYear]     = useState(String(new Date().getFullYear()));

  // Tab 3 — Collections
  const [collData,    setCollData]    = useState(null);
  const [monthlyCol,  setMonthlyCol]  = useState(null);
  const [collProject, setCollProject] = useState('');
  const [collFrom,    setCollFrom]    = useState('');
  const [collTo,      setCollTo]      = useState('');
  const [collYear,    setCollYear]    = useState(String(new Date().getFullYear()));

  // Tab 4 — Expenses
  const [expReport,   setExpReport]   = useState(null);
  const [expProject,  setExpProject]  = useState('');
  const [expFrom,     setExpFrom]     = useState('');
  const [expTo,       setExpTo]       = useState('');

  // Tab 5 — Broker Performance
  const [brokerPerf,  setBrokerPerf]  = useState(null);
  const [bpProject,   setBpProject]   = useState('');

  // Tab 6 — Inventory
  const [inventory,   setInventory]   = useState(null);
  const [invProject,  setInvProject]  = useState('');

  // ── Flash ──────────────────────────────────────────────────
  const flash = useCallback((text, type = 'error') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
  }, []);

  // ── Load projects for all dropdowns ───────────────────────
  useEffect(() => {
    getProjectsApi()
      .then(({ data }) => setProjects(data.data?.projects || []))
      .catch(() => {});
  }, []);

  // ── Load dashboard on mount ────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getDashboardApi();
      setDashboard(data.data);
    } catch { flash('Failed to load dashboard'); }
    setLoading(false);
  }, [flash]);

  useEffect(() => { if (tab === 0) loadDashboard(); }, [tab, loadDashboard]);

  // ── Project report ─────────────────────────────────────────
  const loadProjectReport = async () => {
    if (!selProject) return flash('Select a project');
    setLoading(true);
    try {
      const { data } = await getProjectReportApi(selProject);
      setProjReport(data.data);
    } catch { flash('Failed to load project report'); }
    setLoading(false);
  };

  // ── Sales report ───────────────────────────────────────────
  const loadSales = async () => {
    setLoading(true);
    try {
      const params = {};
      if (salesProject) params.project_id = salesProject;
      if (salesFrom)    params.from_date   = salesFrom;
      if (salesTo)      params.to_date     = salesTo;
      const { data } = await getSalesReportApi(params);
      setSalesData(data.data);
    } catch { flash('Failed to load sales report'); }
    setLoading(false);
  };

  const loadMonthlySales = async () => {
    if (!salesYear) return;
    setLoading(true);
    try {
      const { data } = await getMonthlySalesApi({ year: salesYear });
      setMonthlySales(data.data);
    } catch { flash('Failed to load monthly sales'); }
    setLoading(false);
  };

  useEffect(() => { if (tab === 2) { loadSales(); loadMonthlySales(); } }, [tab]);

  // ── Collections report ─────────────────────────────────────
  const loadCollections = async () => {
    setLoading(true);
    try {
      const params = {};
      if (collProject) params.project_id = collProject;
      if (collFrom)    params.from_date   = collFrom;
      if (collTo)      params.to_date     = collTo;
      const { data } = await getCollectionReportApi(params);
      setCollData(data.data);
    } catch { flash('Failed to load collections'); }
    setLoading(false);
  };

  const loadMonthlyCol = async () => {
    if (!collYear) return;
    setLoading(true);
    try {
      const { data } = await getMonthlyCollApi({ year: collYear });
      setMonthlyCol(data.data);
    } catch { flash('Failed to load monthly collections'); }
    setLoading(false);
  };

  useEffect(() => { if (tab === 3) { loadCollections(); loadMonthlyCol(); } }, [tab]);

  // ── Expense report ─────────────────────────────────────────
  const loadExpenses = async () => {
    setLoading(true);
    try {
      const params = {};
      if (expProject) params.project_id = expProject;
      if (expFrom)    params.from_date   = expFrom;
      if (expTo)      params.to_date     = expTo;
      const { data } = await getExpenseReportApi(params);
      setExpReport(data.data);
    } catch { flash('Failed to load expense report'); }
    setLoading(false);
  };

  useEffect(() => { if (tab === 4) loadExpenses(); }, [tab]);

  // ── Broker performance ─────────────────────────────────────
  const loadBrokerPerf = async () => {
    setLoading(true);
    try {
      const params = bpProject ? { project_id: bpProject } : {};
      const { data } = await getBrokerPerfApi(params);
      setBrokerPerf(data.data);
    } catch { flash('Failed to load broker performance'); }
    setLoading(false);
  };

  useEffect(() => { if (tab === 5) loadBrokerPerf(); }, [tab]);

  // ── Inventory snapshot ─────────────────────────────────────
  const loadInventory = async () => {
    setLoading(true);
    try {
      const params = invProject ? { project_id: invProject } : {};
      const { data } = await getInventorySnapApi(params);
      setInventory(data.data);
    } catch { flash('Failed to load inventory'); }
    setLoading(false);
  };

  useEffect(() => { if (tab === 6) loadInventory(); }, [tab]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#2d3748]">Reports</h2>
        <p className="text-xs text-[#718096]">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
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
      <div className="flex gap-1 bg-[#E8DFCA] p-1 rounded-xl flex-wrap">
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

      {/* ══ TAB 0: DASHBOARD ═════════════════════════════════════════ */}
      {tab === 0 && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              onClick={loadDashboard}
              className="flex items-center gap-2 px-4 py-2 bg-[#E8DFCA] text-[#4a5568] text-sm font-semibold rounded-xl hover:bg-[#d4cdb8] transition-all"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {loading ? <Loader /> : dashboard ? (
            <>
              {/* This month highlight */}
              <div className="bg-[#6D94C5] rounded-2xl p-5 text-white">
                <p className="text-sm text-white/70 mb-1">This Month Collections</p>
                <p className="text-3xl font-bold">{inr(dashboard.this_month?.collected_this_month)}</p>
                <p className="text-white/70 text-sm mt-1">
                  {dashboard.this_month?.payments_this_month || 0} payment transactions
                </p>
              </div>

              {/* Main KPI grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Flats"      value={dashboard.flats?.total_flats     || 0}          icon={Home}        />
                <StatCard label="Available"         value={dashboard.flats?.available_flats  || 0}         color="text-green-600" />
                <StatCard label="Blocked"           value={dashboard.flats?.blocked_flats    || 0}         color="text-orange-500" />
                <StatCard label="Sold"              value={dashboard.flats?.sold_flats       || 0}         color="text-red-500" />
                <StatCard label="Total Sales Value" value={inr(dashboard.sales?.total_sales_value)}        icon={TrendingUp}  color="text-[#6D94C5]" />
                <StatCard label="Amount Received"   value={inr(dashboard.collections?.total_amount_received)} color="text-green-600" />
                <StatCard label="Amount Pending"    value={inr(dashboard.collections?.total_amount_pending)}  color="text-red-500" />
                <StatCard label="Total Bookings"    value={dashboard.sales?.total_bookings  || 0}          icon={Users} />
              </div>

              {/* Booking status strip */}
              <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                <SectionHeader title="Booking Status Breakdown" />
                <div className="grid grid-cols-4 divide-x divide-[#F5EFE6]">
                  {[
                    ['Booked',           dashboard.sales?.booked,           'text-blue-600'],
                    ['Agreement Signed', dashboard.sales?.agreement_signed, 'text-purple-600'],
                    ['Registered',       dashboard.sales?.registered,       'text-green-600'],
                    ['Cancelled',        dashboard.sales?.cancelled,        'text-red-500'],
                  ].map(([label, val, color]) => (
                    <div key={label} className="px-5 py-4 text-center">
                      <p className={`text-2xl font-bold ${color}`}>{val || 0}</p>
                      <p className="text-xs text-[#718096] mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overdue + Expenses + Commission strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                  <p className="text-xs text-red-500 font-semibold mb-1">Overdue Milestones</p>
                  <p className="text-2xl font-bold text-red-600">{inr(dashboard.overdue?.overdue_amount)}</p>
                  <p className="text-xs text-red-400 mt-1">{dashboard.overdue?.overdue_milestones || 0} milestones past due</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
                  <p className="text-xs text-orange-500 font-semibold mb-1">Project Expenses Pending</p>
                  <p className="text-2xl font-bold text-orange-600">{inr(dashboard.expenses?.expenses_pending)}</p>
                  <p className="text-xs text-orange-400 mt-1">Total: {inr(dashboard.expenses?.total_expenses)}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                  <p className="text-xs text-purple-500 font-semibold mb-1">Commission Pending</p>
                  <p className="text-2xl font-bold text-purple-600">{inr(dashboard.broker_commissions?.total_commission_pending)}</p>
                  <p className="text-xs text-purple-400 mt-1">Paid: {inr(dashboard.broker_commissions?.total_commission_paid)}</p>
                </div>
              </div>

              {/* Per-project cards */}
              {dashboard.projects?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="Project-wise Summary" sub="All active projects" />
                  <div className="divide-y divide-[#F5EFE6]">
                    {dashboard.projects.map((p) => (
                      <div key={p.project_id} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-[#2d3748]">{p.project_name}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${
                                p.project_status === 'active'    ? 'bg-green-100 text-green-700' :
                                p.project_status === 'upcoming'  ? 'bg-blue-100 text-blue-700'   :
                                p.project_status === 'completed' ? 'bg-gray-100 text-gray-600'   :
                                'bg-orange-100 text-orange-600'
                              }`}>
                                {p.project_status?.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="flex gap-4 mt-1">
                              <span className="text-xs text-green-600 font-medium">✅ {p.sold} sold</span>
                              <span className="text-xs text-[#6D94C5] font-medium">🔵 {p.available} available</span>
                              <span className="text-xs text-orange-500 font-medium">🔒 {p.blocked} blocked</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-[#6D94C5]">{inr(p.collected)}</p>
                            <p className="text-xs text-red-500">Pending: {inr(p.pending)}</p>
                          </div>
                        </div>
                        <ProgressBar paid={Number(p.collected)} total={Number(p.sales_value)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <BarChart2 size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096]">Click Refresh to load dashboard</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 1: PROJECT REPORT ════════════════════════════════════ */}
      {tab === 1 && (
        <div className="space-y-5">

          {/* Selector */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-5 flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Select Project</label>
              <select
                value={selProject}
                onChange={(e) => { setSelProject(e.target.value); setProjReport(null); }}
                className="w-full px-4 py-2.5 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]"
              >
                <option value="">— Choose a project —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button
              onClick={loadProjectReport}
              disabled={!selProject || loading}
              className="px-6 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
            >
              {loading ? 'Loading...' : 'Generate Report'}
            </button>
          </div>

          {loading ? <Loader /> : projReport ? (
            <>
              {/* Project header */}
              <div className="bg-[#6D94C5] rounded-2xl p-5 text-white">
                <p className="text-xl font-bold">{projReport.project?.name}</p>
                <p className="text-[#CBDCEB] text-sm mt-0.5">
                  {projReport.project?.sector_location} · Plot: {projReport.project?.plot_number || '—'}
                </p>
                <div className="flex gap-4 mt-3 flex-wrap">
                  <p className="text-white/70 text-xs">Floors: {projReport.project?.total_floors || '—'}</p>
                  <p className="text-white/70 text-xs">Planned Flats: {projReport.project?.total_flats || '—'}</p>
                  <p className="text-white/70 text-xs">Status: {projReport.project?.project_status?.replace('_',' ')}</p>
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Listed Flats"     value={projReport.inventory?.total_flats     || 0} />
                <StatCard label="Sold"             value={projReport.inventory?.sold            || 0} color="text-red-500" />
                <StatCard label="Available"        value={projReport.inventory?.available       || 0} color="text-green-600" />
                <StatCard label="Blocked"          value={projReport.inventory?.blocked         || 0} color="text-orange-500" />
                <StatCard label="Sales Value"      value={inr(projReport.sales?.total_sales_value)}   color="text-[#6D94C5]" />
                <StatCard label="Collected"        value={inr(projReport.sales?.total_collected)}      color="text-green-600" />
                <StatCard label="Pending"          value={inr(projReport.sales?.total_pending)}        color="text-red-500" />
                <StatCard label="Gross Profit"     value={inr(projReport.sales?.gross_profit)}
                  color={Number(projReport.sales?.gross_profit) >= 0 ? 'text-green-600' : 'text-red-500'}
                  sub={`Margin: ${pct(projReport.sales?.gross_profit_margin)}`}
                />
              </div>

              {/* Config-wise breakdown */}
              {projReport.by_config?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="Unit Type Breakdown" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5EFE6]">
                        <tr>
                          {['Config', 'Total', 'Available', 'Blocked', 'Sold', 'Avg Price', 'Sold Value', 'Fill Rate'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5EFE6]">
                        {projReport.by_config.map((c) => {
                          const fillRate = c.total ? Math.round(((Number(c.sold) + Number(c.blocked)) / Number(c.total)) * 100) : 0;
                          return (
                            <tr key={c.configuration} className="hover:bg-[#F5EFE6] transition-colors">
                              <td className="px-4 py-3">
                                <span className="text-xs bg-[#CBDCEB] text-[#2d3748] px-2.5 py-1 rounded-lg font-semibold">{c.configuration}</span>
                              </td>
                              <td className="px-4 py-3 font-bold text-[#2d3748]">{c.total}</td>
                              <td className="px-4 py-3 text-green-600 font-semibold">{c.available}</td>
                              <td className="px-4 py-3 text-orange-500 font-semibold">{c.blocked}</td>
                              <td className="px-4 py-3 text-red-500 font-semibold">{c.sold}</td>
                              <td className="px-4 py-3 text-[#718096]">{inr(c.avg_price)}</td>
                              <td className="px-4 py-3 font-semibold text-[#6D94C5]">{inr(c.sold_value)}</td>
                              <td className="px-4 py-3 w-32">
                                <ProgressBar paid={Number(c.sold) + Number(c.blocked)} total={Number(c.total)} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Expense + Commission summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="Expenses Summary" />
                  <div className="p-5 space-y-3">
                    {[
                      ['Total Expense',  inr(projReport.expenses?.total_expenses),  'text-[#2d3748]'],
                      ['Paid',           inr(projReport.expenses?.expenses_paid),   'text-green-600'],
                      ['Pending',        inr(projReport.expenses?.expenses_pending),'text-red-500'],
                    ].map(([label, val, color]) => (
                      <div key={label} className="flex justify-between items-center py-1 border-b border-[#F5EFE6] last:border-0">
                        <p className="text-sm text-[#718096]">{label}</p>
                        <p className={`font-bold text-sm ${color}`}>{val}</p>
                      </div>
                    ))}
                    {projReport.expenses?.by_category?.filter(Boolean).slice(0, 4).map((cat) => cat && (
                      <div key={cat.category} className="flex justify-between text-xs text-[#718096]">
                        <span>↳ {cat.category}</span>
                        <span>{inr(cat.total_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="Broker Commissions" />
                  <div className="p-5 space-y-3">
                    {[
                      ['Total Commission',  inr(projReport.broker_commissions?.total_commission),  'text-[#2d3748]'],
                      ['Paid',             inr(projReport.broker_commissions?.commission_paid),   'text-green-600'],
                      ['Pending',          inr(projReport.broker_commissions?.commission_pending),'text-red-500'],
                    ].map(([label, val, color]) => (
                      <div key={label} className="flex justify-between items-center py-1 border-b border-[#F5EFE6] last:border-0">
                        <p className="text-sm text-[#718096]">{label}</p>
                        <p className={`font-bold text-sm ${color}`}>{val}</p>
                      </div>
                    ))}

                    {/* P&L summary box */}
                    <div className="bg-[#F5EFE6] rounded-xl p-4 mt-2">
                      <p className="text-xs font-bold text-[#718096] mb-2">P&L Summary</p>
                      {[
                        ['Sales Value',   inr(projReport.sales?.total_sales_value),  'text-[#6D94C5]'],
                        ['− Expenses',   `−${inr(projReport.expenses?.total_expenses)}`, 'text-red-500'],
                        ['Gross Profit',  inr(projReport.sales?.gross_profit), Number(projReport.sales?.gross_profit) >= 0 ? 'text-green-600' : 'text-red-500'],
                        ['Margin',        pct(projReport.sales?.gross_profit_margin), 'text-[#6D94C5]'],
                      ].map(([label, val, color]) => (
                        <div key={label} className="flex justify-between py-1">
                          <p className="text-xs text-[#718096]">{label}</p>
                          <p className={`text-xs font-bold ${color}`}>{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <Building2 size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">Select a project and generate its full report</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 2: SALES ═════════════════════════════════════════════ */}
      {tab === 2 && (
        <div className="space-y-5">

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Project</label>
              <select value={salesProject} onChange={(e) => setSalesProject(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[140px]">
                <option value="">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">From</label>
              <input type="date" value={salesFrom} onChange={(e) => setSalesFrom(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">To</label>
              <input type="date" value={salesTo} onChange={(e) => setSalesTo(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]" />
            </div>
            <button onClick={loadSales} disabled={loading}
              className="px-5 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all">
              Apply
            </button>
          </div>

          {loading ? <Loader /> : salesData && (
            <>
              {/* Sales KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Bookings"    value={salesData.totals?.total_bookings     || 0} icon={Users} />
                <StatCard label="Total Sales Value" value={inr(salesData.totals?.total_sales_value)}  color="text-[#6D94C5]" />
                <StatCard label="Total Discount"    value={inr(salesData.totals?.total_discount)}     color="text-orange-500" />
                <StatCard label="Registered"        value={salesData.totals?.registered_count    || 0} color="text-green-600" />
              </div>

              {/* By config */}
              {salesData.by_config?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="Sales by Configuration" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5EFE6]">
                        <tr>
                          {['Configuration', 'Units Sold', 'Sales Value', 'Avg Sale Price'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5EFE6]">
                        {salesData.by_config.map((c) => (
                          <tr key={c.configuration} className="hover:bg-[#F5EFE6] transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-xs bg-[#CBDCEB] text-[#2d3748] px-2.5 py-1 rounded-lg font-semibold">{c.configuration}</span>
                            </td>
                            <td className="px-4 py-3 font-bold text-[#2d3748]">{c.units_sold}</td>
                            <td className="px-4 py-3 font-semibold text-[#6D94C5]">{inr(c.sales_value)}</td>
                            <td className="px-4 py-3 text-[#718096]">{inr(c.avg_sale_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* By project */}
              {salesData.by_project?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="Sales by Project" />
                  {salesData.by_project.map((p) => (
                    <div key={p.project_name} className="flex items-center justify-between px-5 py-3 border-b border-[#F5EFE6] last:border-0 hover:bg-[#F5EFE6]">
                      <p className="font-semibold text-[#2d3748]">{p.project_name}</p>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-[#718096]">{p.units_sold} units</span>
                        <p className="font-bold text-[#6D94C5]">{inr(p.sales_value)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Monthly trend chart */}
              <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8DFCA] bg-[#F5EFE6]">
                  <p className="font-bold text-[#2d3748] text-sm">Monthly Sales Trend</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={salesYear}
                      onChange={(e) => setSalesYear(e.target.value)}
                      className="w-20 px-2 py-1 border border-[#E8DFCA] rounded-lg text-xs focus:outline-none focus:border-[#6D94C5]"
                    />
                    <button onClick={loadMonthlySales} className="text-xs px-3 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all">
                      Load
                    </button>
                  </div>
                </div>
                <div className="p-5">
                  {monthlySales?.monthly_sales?.length > 0 ? (
                    <BarChart
                      data={monthlySales.monthly_sales}
                      labelKey="month_label"
                      valueKey="sales_value"
                    />
                  ) : (
                    <p className="text-center text-sm text-[#718096] py-8">No data for selected year</p>
                  )}
                </div>
              </div>

              {/* Recent bookings */}
              {salesData.recent_bookings?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="Recent Bookings" sub={`Last ${salesData.recent_bookings.length} bookings`} />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5EFE6]">
                        <tr>
                          {['Date', 'Customer', 'Project', 'Flat', 'Value', 'Status'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5EFE6]">
                        {salesData.recent_bookings.map((b) => (
                          <tr key={b.id} className="hover:bg-[#F5EFE6] transition-colors">
                            <td className="px-4 py-3 text-xs text-[#718096] whitespace-nowrap">{fmtDate(b.booking_date)}</td>
                            <td className="px-4 py-3 font-semibold text-[#2d3748]">{b.customer_name}</td>
                            <td className="px-4 py-3 text-xs text-[#718096]">{b.project_name}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-[#CBDCEB] text-[#2d3748] px-2 py-0.5 rounded-lg font-medium">{b.flat_number}</span>
                            </td>
                            <td className="px-4 py-3 font-bold text-[#6D94C5]">{inr(b.final_value)}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold capitalize">
                                {b.status?.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ TAB 3: COLLECTIONS ═══════════════════════════════════════ */}
      {tab === 3 && (
        <div className="space-y-5">

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Project</label>
              <select value={collProject} onChange={(e) => setCollProject(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[140px]">
                <option value="">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">From</label>
              <input type="date" value={collFrom} onChange={(e) => setCollFrom(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">To</label>
              <input type="date" value={collTo} onChange={(e) => setCollTo(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]" />
            </div>
            <button onClick={loadCollections} disabled={loading}
              className="px-5 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all">
              Apply
            </button>
          </div>

          {loading ? <Loader /> : collData && (
            <>
              {/* Collection KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Collected"      value={inr(collData.totals?.total_collected)}           color="text-green-600" icon={IndianRupee} />
                <StatCard label="Payment Count"        value={collData.totals?.payment_count        || 0}       />
                <StatCard label="Booking Collected"    value={inr(collData.totals?.booking_collected)}          color="text-blue-600" />
                <StatCard label="Instalment Collected" value={inr(collData.totals?.instalment_collected)}       color="text-[#6D94C5]" />
              </div>

              {/* By payment type breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* By type */}
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="By Payment Type" />
                  <div className="divide-y divide-[#F5EFE6]">
                    {[
                      ['Booking',      collData.totals?.booking_collected],
                      ['Agreement',    collData.totals?.agreement_collected],
                      ['Instalment',   collData.totals?.instalment_collected],
                      ['Registration', collData.totals?.registration_collected],
                      ['Other',        collData.totals?.other_amount],
                    ].map(([label, val]) => (
                      <div key={label} className="flex items-center justify-between px-5 py-3">
                        <p className="text-sm text-[#718096] capitalize">{label}</p>
                        <p className="font-bold text-[#2d3748]">{inr(val)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* By payment mode */}
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="By Payment Mode" />
                  <div className="divide-y divide-[#F5EFE6]">
                    {[
                      ['Cash',   collData.totals?.cash_collected],
                      ['Cheque', collData.totals?.cheque_collected],
                      ['NEFT',   collData.totals?.neft_collected],
                      ['RTGS',   collData.totals?.rtgs_collected],
                      ['UPI',    collData.totals?.upi_collected],
                    ].map(([label, val]) => (
                      <div key={label} className="flex items-center justify-between px-5 py-3">
                        <p className="text-sm text-[#718096]">{label}</p>
                        <p className="font-bold text-[#2d3748]">{inr(val)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top outstanding */}
              {collData.top_outstanding?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="Top Outstanding Balances" sub="Bookings with highest pending amount" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5EFE6]">
                        <tr>
                          {['Customer', 'Project', 'Flat', 'Agreement', 'Paid', 'Balance', 'Progress'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5EFE6]">
                        {collData.top_outstanding.map((o) => (
                          <tr key={o.booking_id} className="hover:bg-[#F5EFE6] transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[#2d3748]">{o.customer_name}</p>
                              <p className="text-xs text-[#718096]">{o.phone}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-[#718096]">{o.project_name}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-[#CBDCEB] text-[#2d3748] px-2 py-0.5 rounded-lg font-medium">{o.flat_number}</span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#2d3748]">{inr(o.final_value)}</td>
                            <td className="px-4 py-3 font-semibold text-green-600">{inr(o.total_paid)}</td>
                            <td className="px-4 py-3 font-bold text-red-500">{inr(o.balance_due)}</td>
                            <td className="px-4 py-3 w-32">
                              <ProgressBar paid={Number(o.total_paid)} total={Number(o.final_value)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Monthly trend chart */}
              <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8DFCA] bg-[#F5EFE6]">
                  <p className="font-bold text-[#2d3748] text-sm">Monthly Collection Trend</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={collYear}
                      onChange={(e) => setCollYear(e.target.value)}
                      className="w-20 px-2 py-1 border border-[#E8DFCA] rounded-lg text-xs focus:outline-none focus:border-[#6D94C5]"
                    />
                    <button onClick={loadMonthlyCol} className="text-xs px-3 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all">
                      Load
                    </button>
                  </div>
                </div>
                <div className="p-5">
                  {monthlyCol?.monthly_collections?.length > 0 ? (
                    <BarChart
                      data={monthlyCol.monthly_collections}
                      labelKey="month_label"
                      valueKey="total_collected"
                      color="bg-green-500"
                    />
                  ) : (
                    <p className="text-center text-sm text-[#718096] py-8">No data for selected year</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ TAB 4: EXPENSES ══════════════════════════════════════════ */}
      {tab === 4 && (
        <div className="space-y-5">

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Project</label>
              <select value={expProject} onChange={(e) => setExpProject(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[140px]">
                <option value="">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">From</label>
              <input type="date" value={expFrom} onChange={(e) => setExpFrom(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">To</label>
              <input type="date" value={expTo} onChange={(e) => setExpTo(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]" />
            </div>
            <button onClick={loadExpenses} disabled={loading}
              className="px-5 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all">
              Apply
            </button>
          </div>

          {loading ? <Loader /> : expReport && (
            <>
              {/* Expense KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Entries"  value={expReport.totals?.entry_count    || 0} />
                <StatCard label="Total Expense"  value={inr(expReport.totals?.total_expense)}   color="text-[#2d3748]" />
                <StatCard label="Total Paid"     value={inr(expReport.totals?.total_paid)}       color="text-green-600" />
                <StatCard label="Total Pending"  value={inr(expReport.totals?.total_pending)}    color="text-red-500" />
                <StatCard label="Base Amount"    value={inr(expReport.totals?.total_base_amount)} />
                <StatCard label="Total GST"      value={inr(expReport.totals?.total_gst)}        color="text-orange-500" />
              </div>

              {/* Category breakdown with horizontal percentage bars */}
              {expReport.by_category?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="Expense by Category" />
                  <div className="p-5 space-y-4">
                    {expReport.by_category.map((cat) => (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-[#2d3748]">{cat.category}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-[#718096]">{cat.entry_count} entries</span>
                            <span className="text-sm font-bold text-[#2d3748]">{inr(cat.total_amount)}</span>
                            <span className="text-xs bg-[#CBDCEB] text-[#6D94C5] px-2 py-0.5 rounded-full font-semibold">
                              {pct(cat.percentage_of_total)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1 bg-[#E8DFCA] rounded-full h-2 overflow-hidden">
                            <div className="h-2 bg-[#6D94C5] rounded-full" style={{ width: `${Math.min(cat.percentage_of_total, 100)}%` }} />
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-[#718096] mt-1">
                          <span>Paid: {inr(cat.paid_amount)}</span>
                          <span>Pending: {inr(cat.pending_amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By project (when all selected) */}
              {!expProject && expReport.by_project?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="Expense by Project" />
                  <div className="divide-y divide-[#F5EFE6]">
                    {expReport.by_project.map((p) => (
                      <div key={p.project_name} className="flex items-center justify-between px-5 py-4 hover:bg-[#F5EFE6]">
                        <p className="font-semibold text-[#2d3748]">{p.project_name}</p>
                        <div className="text-right">
                          <p className="font-bold text-[#2d3748]">{inr(p.total_amount)}</p>
                          <p className="text-xs text-green-600">Paid: {inr(p.paid_amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ TAB 5: BROKER PERFORMANCE ════════════════════════════════ */}
      {tab === 5 && (
        <div className="space-y-5">

          {/* Filter */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Project</label>
              <select value={bpProject} onChange={(e) => setBpProject(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[160px]">
                <option value="">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button onClick={loadBrokerPerf} disabled={loading}
              className="px-5 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all">
              Apply
            </button>
          </div>

          {loading ? <Loader /> : brokerPerf?.brokers?.length > 0 ? (
            <>
              {/* Summary totals */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Brokers"           value={brokerPerf.total || 0}                                            icon={Users} />
                <StatCard label="Total Sales Value" value={inr(brokerPerf.brokers.reduce((s, b) => s + Number(b.total_sales_value || 0), 0))} color="text-[#6D94C5]" />
                <StatCard label="Commission Pending"value={inr(brokerPerf.brokers.reduce((s, b) => s + Number(b.commission_pending || 0), 0))} color="text-orange-500" />
              </div>

              {/* Broker performance table */}
              <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                <SectionHeader title="Broker Performance Ranking" sub="Sorted by total sales value" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F5EFE6]">
                      <tr>
                        {['#', 'Broker', 'Deals', 'Sales Value', 'Commission Earned', 'Comm Paid', 'Comm Pending', 'Sales Contribution'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5EFE6]">
                      {brokerPerf.brokers.map((b, idx) => (
                        <tr key={b.broker_id} className="hover:bg-[#F5EFE6] transition-colors">
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-[#718096]'}`}>
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#2d3748]">{b.broker_name}</p>
                            {b.company && <p className="text-xs text-[#718096]">{b.company}</p>}
                            {b.phone   && <p className="text-xs text-[#718096]">📞 {b.phone}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-[#CBDCEB] text-[#6D94C5] px-2.5 py-1 rounded-full font-semibold">
                              {b.total_deals}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-[#6D94C5]">{inr(b.total_sales_value)}</td>
                          <td className="px-4 py-3 font-semibold text-[#2d3748]">{inr(b.total_commission_earned)}</td>
                          <td className="px-4 py-3 font-semibold text-green-600">{inr(b.commission_paid)}</td>
                          <td className="px-4 py-3 font-semibold text-orange-500">{inr(b.commission_pending)}</td>
                          <td className="px-4 py-3 w-36">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-[#E8DFCA] rounded-full h-2 overflow-hidden">
                                <div className="h-2 bg-[#6D94C5] rounded-full"
                                  style={{ width: `${Math.min(Number(b.sales_contribution_pct || 0), 100)}%` }} />
                              </div>
                              <span className="text-xs font-bold text-[#718096] w-10">
                                {pct(b.sales_contribution_pct)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#F5EFE6]">
                        <td colSpan={3} className="px-4 py-3 text-xs font-bold text-[#718096]">Total</td>
                        <td className="px-4 py-3 font-bold text-[#6D94C5]">
                          {inr(brokerPerf.brokers.reduce((s, b) => s + Number(b.total_sales_value || 0), 0))}
                        </td>
                        <td className="px-4 py-3 font-bold text-[#2d3748]">
                          {inr(brokerPerf.brokers.reduce((s, b) => s + Number(b.total_commission_earned || 0), 0))}
                        </td>
                        <td className="px-4 py-3 font-bold text-green-600">
                          {inr(brokerPerf.brokers.reduce((s, b) => s + Number(b.commission_paid || 0), 0))}
                        </td>
                        <td className="px-4 py-3 font-bold text-orange-500">
                          {inr(brokerPerf.brokers.reduce((s, b) => s + Number(b.commission_pending || 0), 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : !loading && (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <Users size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No broker data available</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 6: INVENTORY ═════════════════════════════════════════ */}
      {tab === 6 && (
        <div className="space-y-5">

          {/* Filter */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex gap-3 items-end flex-wrap">
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Project</label>
              <select value={invProject} onChange={(e) => setInvProject(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[160px]">
                <option value="">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button onClick={loadInventory} disabled={loading}
              className="px-5 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all">
              Apply
            </button>
          </div>

          {loading ? <Loader /> : inventory && (
            <>
              {/* Totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Flats"       value={inventory.totals?.total_flats || 0}             icon={Home} />
                <StatCard label="Available"         value={inventory.totals?.available   || 0}             color="text-green-600" />
                <StatCard label="Blocked"           value={inventory.totals?.blocked     || 0}             color="text-orange-500" />
                <StatCard label="Sold"              value={inventory.totals?.sold        || 0}             color="text-red-500" />
                <StatCard label="Total Value"       value={inr(inventory.totals?.total_value)}             color="text-[#6D94C5]" />
                <StatCard label="Sold Value"        value={inr(inventory.totals?.sold_value)}              color="text-red-500" />
                <StatCard label="Available Value"   value={inr(inventory.totals?.available_value)}        color="text-green-600" />
              </div>

              {/* Config-wise snapshot */}
              {inventory.by_config?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="Inventory by Configuration" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5EFE6]">
                        <tr>
                          {['Configuration', 'Total', 'Available', 'Blocked', 'Sold', 'Avg Carpet', 'Avg Saleable', 'Avg Price', 'Fill Rate'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5EFE6]">
                        {inventory.by_config.map((c) => {
                          const fill = c.total_units
                            ? Math.round(((Number(c.sold) + Number(c.blocked)) / Number(c.total_units)) * 100)
                            : 0;
                          return (
                            <tr key={c.configuration} className="hover:bg-[#F5EFE6] transition-colors">
                              <td className="px-4 py-3">
                                <span className="text-xs bg-[#CBDCEB] text-[#2d3748] px-2.5 py-1 rounded-lg font-semibold">{c.configuration}</span>
                              </td>
                              <td className="px-4 py-3 font-bold text-[#2d3748]">{c.total_units}</td>
                              <td className="px-4 py-3 text-green-600 font-semibold">{c.available}</td>
                              <td className="px-4 py-3 text-orange-500 font-semibold">{c.blocked}</td>
                              <td className="px-4 py-3 text-red-500 font-semibold">{c.sold}</td>
                              <td className="px-4 py-3 text-xs text-[#718096]">
                                {Number(c.avg_carpet_area || 0).toFixed(0)} sqft
                              </td>
                              <td className="px-4 py-3 text-xs text-[#718096]">
                                {Number(c.avg_saleable_area || 0).toFixed(0)} sqft
                              </td>
                              <td className="px-4 py-3 font-semibold text-[#6D94C5]">{inr(c.avg_price)}</td>
                              <td className="px-4 py-3 w-32">
                                <ProgressBar paid={Number(c.sold) + Number(c.blocked)} total={Number(c.total_units)} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Floor-wise snapshot */}
              {inventory.by_floor?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <SectionHeader title="Inventory by Floor" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5EFE6]">
                        <tr>
                          {['Project', 'Floor', 'Total', 'Available', 'Blocked', 'Sold', 'Fill Rate'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5EFE6]">
                        {inventory.by_floor.map((f, idx) => {
                          const fill = f.total_units
                            ? Math.round(((Number(f.sold) + Number(f.blocked)) / Number(f.total_units)) * 100)
                            : 0;
                          return (
                            <tr key={idx} className="hover:bg-[#F5EFE6] transition-colors">
                              <td className="px-4 py-3 text-xs text-[#718096]">{f.project_name}</td>
                              <td className="px-4 py-3 font-bold text-[#2d3748]">Floor {f.floor}</td>
                              <td className="px-4 py-3 font-semibold">{f.total_units}</td>
                              <td className="px-4 py-3 text-green-600 font-semibold">{f.available}</td>
                              <td className="px-4 py-3 text-orange-500 font-semibold">{f.blocked}</td>
                              <td className="px-4 py-3 text-red-500 font-semibold">{f.sold}</td>
                              <td className="px-4 py-3 w-32">
                                <ProgressBar paid={Number(f.sold) + Number(f.blocked)} total={Number(f.total_units)} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}