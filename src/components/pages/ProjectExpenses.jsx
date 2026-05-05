import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Receipt, Search, Filter,
  Pencil, Trash2, X, IndianRupee,
  ChevronDown, ChevronUp, CheckCircle,
  AlertCircle, Tag, BarChart2,
} from 'lucide-react';
import {
  getCategoriesApi, createCategoryApi, deactivateCategoryApi,
  getExpensesApi, getExpenseSummaryApi,
  getUnpaidExpensesApi,
  createExpenseApi, updateExpenseApi, deleteExpenseApi,
  payExpenseApi, getExpensePaymentsApi,
} from '../../services/repository/expenseRepository';
import { getProjectsApi } from '../../services/repository/projectRepository';
import Loader from '../common/Loader';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS          = ['All Expenses', 'Add Expense', 'Summary', 'Unpaid', 'Categories'];
const PAYMENT_MODES = ['cash', 'cheque', 'NEFT', 'RTGS', 'UPI'];

const PAY_STATUS_STYLE = {
  unpaid:  'bg-red-100 text-red-600',
  partial: 'bg-orange-100 text-orange-600',
  paid:    'bg-green-100 text-green-700',
};

const inr     = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const inputCls =
  'w-full px-4 py-2.5 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] transition-colors';

const EMPTY_FORM = {
  project_id: '', category_id: '', vendor_name: '',
  description: '', expense_date: new Date().toISOString().split('T')[0],
  invoice_number: '', amount: '', gst_amount: '0',
  payment_mode: '', payment_reference: '', remarks: '',
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

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color = 'text-[#6D94C5]', sub }) => (
  <div className="bg-white rounded-xl border border-[#E8DFCA] p-4">
    <p className="text-xs text-[#718096] font-medium mb-1">{label}</p>
    <p className={`text-lg font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-[#718096] mt-0.5">{sub}</p>}
  </div>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────
const PayStatusBadge = ({ status }) => (
  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${PAY_STATUS_STYLE[status] || 'bg-gray-100 text-gray-500'}`}>
    {status}
  </span>
);

// ─── Monthly Bar Chart ────────────────────────────────────────────────────────
// Extracted as a component to avoid invalid @const syntax inside JSX
const MonthlyBarChart = ({ data }) => {
  const maxVal = Math.max(...data.map((m) => Number(m.total_amount)), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((m) => {
        const height = Math.max((Number(m.total_amount) / maxVal) * 100, 4);
        return (
          <div key={m.month_label} className="flex-1 flex flex-col items-center gap-1">
            <p className="text-xs text-[#718096] font-medium">{inr(m.total_amount)}</p>
            <div
              className="w-full bg-[#6D94C5] rounded-t-lg transition-all hover:bg-[#5a7eb0]"
              style={{ height: `${height}%` }}
              title={`${m.month_label}: ${inr(m.total_amount)}`}
            />
            <p className="text-xs text-[#718096] whitespace-nowrap">{m.month_label}</p>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProjectExpenses() {
  const [tab,        setTab]       = useState(0);
  const [expenses,   setExpenses]  = useState([]);
  const [categories, setCategories]= useState([]);
  const [projects,   setProjects]  = useState([]);
  const [summary,    setSummary]   = useState(null);
  const [unpaid,     setUnpaid]    = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [saving,     setSaving]    = useState(false);
  const [msg,        setMsg]       = useState({ text: '', type: '' });

  // Add / Edit form
  const [form,   setForm]   = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  // Filters
  const [fProject, setFProject] = useState('');
  const [fCat,     setFCat]     = useState('');
  const [fStatus,  setFStatus]  = useState('');
  const [fFrom,    setFFrom]    = useState('');
  const [fTo,      setFTo]      = useState('');
  const [fVendor,  setFVendor]  = useState('');
  const [search,   setSearch]   = useState('');

  // Summary project filter
  const [summaryProject, setSummaryProject] = useState('');

  // Unpaid project filter
  const [unpaidProject, setUnpaidProject] = useState('');

  // Expense detail expand
  const [expanded,      setExpanded]      = useState(null);
  const [payLog,        setPayLog]        = useState([]);
  const [payLogLoading, setPayLogLoading] = useState(false);

  // Pay expense modal
  const [payModal, setPayModal] = useState(null);
  const [payForm,  setPayForm]  = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'NEFT',
    payment_reference: '',
    remarks: '',
  });

  // Category management
  const [newCatName, setNewCatName] = useState('');
  const [catSaving,  setCatSaving]  = useState(false);

  // ── Flash ──────────────────────────────────────────────────
  const flash = useCallback((text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
  }, []);

  // ── Load base data ─────────────────────────────────────────
  const loadBase = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        getProjectsApi(),
        getCategoriesApi(),
      ]);
      setProjects(pRes.data.data?.projects     || []);
      setCategories(cRes.data.data?.categories || []);
    } catch {/* silent */}
  }, []);

  // ── Load expenses ──────────────────────────────────────────
  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fProject) params.project_id     = fProject;
      if (fCat)     params.category_id    = fCat;
      if (fStatus)  params.payment_status = fStatus;
      if (fFrom)    params.from_date      = fFrom;
      if (fTo)      params.to_date        = fTo;
      if (fVendor)  params.vendor_name    = fVendor;
      const { data } = await getExpensesApi(params);
      setExpenses(data.data?.expenses || []);
    } catch {
      flash('Failed to load expenses', 'error');
    }
    setLoading(false);
  }, [fProject, fCat, fStatus, fFrom, fTo, fVendor, flash]);

  // ── Load summary ───────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = summaryProject ? { project_id: summaryProject } : {};
      const { data } = await getExpenseSummaryApi(params);
      setSummary(data.data);
    } catch {
      flash('Failed to load summary', 'error');
    }
    setLoading(false);
  }, [summaryProject, flash]);

  // ── Load unpaid ────────────────────────────────────────────
  const loadUnpaid = useCallback(async () => {
    setLoading(true);
    try {
      const params = unpaidProject ? { project_id: unpaidProject } : {};
      const { data } = await getUnpaidExpensesApi(params);
      setUnpaid(data.data?.expenses || []);
    } catch {
      flash('Failed to load unpaid', 'error');
    }
    setLoading(false);
  }, [unpaidProject, flash]);

  useEffect(() => { loadBase(); },                     [loadBase]);
  useEffect(() => { if (tab === 0) loadExpenses(); },  [tab, loadExpenses]);
  useEffect(() => { if (tab === 2) loadSummary(); },   [tab, loadSummary]);
  useEffect(() => { if (tab === 3) loadUnpaid(); },    [tab, loadUnpaid]);

  // ── Auto-calc total ────────────────────────────────────────
  const totalAmount = () => {
    const amt = parseFloat(form.amount)     || 0;
    const gst = parseFloat(form.gst_amount) || 0;
    return amt + gst;
  };

  // ── Filtered display ───────────────────────────────────────
  const displayed = expenses.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.vendor_name?.toLowerCase().includes(q)    ||
      e.category_name?.toLowerCase().includes(q)  ||
      e.project_name?.toLowerCase().includes(q)   ||
      e.invoice_number?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q)
    );
  });

  // ── Form handlers ──────────────────────────────────────────
  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const resetForm = () => { setForm(EMPTY_FORM); setEditId(null); };

  const handleEditClick = (exp) => {
    setForm({
      project_id:        String(exp.project_id)  || '',
      category_id:       String(exp.category_id) || '',
      vendor_name:       exp.vendor_name          || '',
      description:       exp.description          || '',
      expense_date:      exp.expense_date ? exp.expense_date.split('T')[0] : '',
      invoice_number:    exp.invoice_number       || '',
      amount:            exp.amount               || '',
      gst_amount:        exp.gst_amount           || '0',
      payment_mode:      exp.payment_mode         || '',
      payment_reference: exp.payment_reference    || '',
      remarks:           exp.remarks              || '',
    });
    setEditId(exp.id);
    setTab(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Submit expense ─────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.project_id)  return flash('Select a project', 'error');
    if (!form.category_id) return flash('Select a category', 'error');
    if (!form.amount)      return flash('Amount is required', 'error');

    setSaving(true);
    try {
      const payload = {
        ...form,
        project_id:        Number(form.project_id),
        category_id:       Number(form.category_id),
        amount:            Number(form.amount),
        gst_amount:        Number(form.gst_amount) || 0,
        payment_mode:      form.payment_mode      || null,
        payment_reference: form.payment_reference || null,
        remarks:           form.remarks           || null,
      };
      if (editId) {
        await updateExpenseApi(editId, payload);
        flash('Expense updated');
      } else {
        await createExpenseApi(payload);
        flash('Expense recorded');
      }
      resetForm();
      loadExpenses();
      setTab(0);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to save expense', 'error');
    }
    setSaving(false);
  };

  // ── Delete expense ─────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense? It must have no payments.')) return;
    try {
      await deleteExpenseApi(id);
      flash('Expense deleted');
      loadExpenses();
    } catch (err) {
      flash(err.response?.data?.message || 'Cannot delete — payments exist', 'error');
    }
  };

  // ── Expand row — load payment log ──────────────────────────
  const toggleExpand = async (expId) => {
    if (expanded === expId) { setExpanded(null); setPayLog([]); return; }
    setExpanded(expId);
    setPayLogLoading(true);
    try {
      const { data } = await getExpensePaymentsApi(expId);
      setPayLog(data.data?.payments || []);
    } catch { setPayLog([]); }
    setPayLogLoading(false);
  };

  // ── Pay expense ────────────────────────────────────────────
  const handlePayExpense = async (e) => {
    e.preventDefault();
    if (!payForm.amount || !payModal) return flash('Amount is required', 'error');
    setSaving(true);
    try {
      await payExpenseApi(payModal.id, {
        ...payForm,
        amount:            Number(payForm.amount),
        payment_reference: payForm.payment_reference || null,
        remarks:           payForm.remarks           || null,
      });
      flash('Payment recorded against expense');
      setPayModal(null);
      setPayForm({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'NEFT',
        payment_reference: '',
        remarks: '',
      });
      loadExpenses();
      if (tab === 3) loadUnpaid();
      if (expanded) {
        const { data } = await getExpensePaymentsApi(expanded);
        setPayLog(data.data?.payments || []);
      }
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to record payment', 'error');
    }
    setSaving(false);
  };

  // ── Create category ────────────────────────────────────────
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCatSaving(true);
    try {
      await createCategoryApi({ name: newCatName.trim() });
      flash('Category created');
      setNewCatName('');
      loadBase();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to create', 'error');
    }
    setCatSaving(false);
  };

  // ── Deactivate category ────────────────────────────────────
  const handleDeactivateCategory = async (cid, name) => {
    if (!window.confirm(`Deactivate category "${name}"?`)) return;
    try {
      await deactivateCategoryApi(cid);
      flash(`"${name}" deactivated`);
      loadBase();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed', 'error');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#2d3748]">Project Expenses</h2>
        <button
          onClick={() => { resetForm(); setTab(1); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
        >
          <Plus size={15} /> Add Expense
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
          </button>
        ))}
      </div>

      {/* ══ TAB 0: ALL EXPENSES ══════════════════════════════════════ */}
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
                  placeholder="Vendor / category / invoice / description..."
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
              <select
                value={fCat}
                onChange={(e) => setFCat(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[130px]"
              >
                <option value="">All Categories</option>
                {categories.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
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
              {(fProject || fCat || fStatus || fFrom || fTo || search) && (
                <button
                  onClick={() => { setFProject(''); setFCat(''); setFStatus(''); setFFrom(''); setFTo(''); setSearch(''); }}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>

            {/* Status chips */}
            <div className="flex gap-2 flex-wrap">
              {['', 'unpaid', 'partial', 'paid'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFStatus(s)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                    fStatus === s
                      ? 'bg-[#6D94C5] text-white'
                      : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
                  }`}
                >
                  {s || 'All Status'}
                </button>
              ))}
            </div>
          </div>

          {/* Total banner */}
          {displayed.length > 0 && (
            <div className="bg-[#6D94C5] rounded-2xl px-5 py-4 grid grid-cols-3 divide-x divide-white/20 text-white">
              {[
                ['Total Expense', inr(displayed.reduce((s, e) => s + Number(e.total_amount), 0))],
                ['Total Paid',    inr(displayed.reduce((s, e) => s + Number(e.paid_amount), 0))],
                ['Total Unpaid',  inr(displayed.reduce((s, e) => s + Number(e.balance_payable || 0), 0))],
              ].map(([label, val]) => (
                <div key={label} className="px-4">
                  <p className="text-xs text-white/70">{label}</p>
                  <p className="font-bold text-lg">{val}</p>
                </div>
              ))}
            </div>
          )}

          {/* Expense list */}
          {loading ? (
            <Loader />
          ) : displayed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <Receipt size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No expenses found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map((exp) => (
                <div key={exp.id} className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">

                  {/* Expense row */}
                  <div
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[#F5EFE6] transition-colors"
                    onClick={() => toggleExpand(exp.id)}
                  >
                    <div className="w-10 h-10 bg-[#CBDCEB] rounded-xl flex items-center justify-center flex-shrink-0">
                      <Receipt size={16} className="text-[#6D94C5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[#2d3748]">{exp.vendor_name || 'No Vendor'}</p>
                        <span className="text-xs bg-[#CBDCEB] text-[#2d3748] px-2 py-0.5 rounded-full font-medium">
                          {exp.category_name}
                        </span>
                        <PayStatusBadge status={exp.payment_status} />
                      </div>
                      <p className="text-xs text-[#718096] mt-0.5">
                        {exp.project_name} · {fmtDate(exp.expense_date)}
                        {exp.invoice_number && ` · Invoice: ${exp.invoice_number}`}
                      </p>
                      {exp.description && (
                        <p className="text-xs text-[#718096] truncate">{exp.description}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-3">
                      <div>
                        <p className="font-bold text-[#2d3748]">{inr(exp.total_amount)}</p>
                        {Number(exp.balance_payable) > 0 && (
                          <p className="text-xs text-red-500">Due: {inr(exp.balance_payable)}</p>
                        )}
                      </div>
                      {expanded === exp.id
                        ? <ChevronUp size={15} className="text-[#6D94C5]" />
                        : <ChevronDown size={15} className="text-[#718096]" />
                      }
                    </div>
                  </div>

                  {/* Progress bar */}
                  {exp.total_amount > 0 && (
                    <div className="px-5 pb-2">
                      <ProgressBar paid={Number(exp.paid_amount)} total={Number(exp.total_amount)} />
                    </div>
                  )}

                  {/* Expanded detail */}
                  {expanded === exp.id && (
                    <div className="border-t border-[#F5EFE6] bg-[#F5EFE6] p-5 space-y-4">

                      {/* Detail grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          ['Base Amount',  inr(exp.amount)],
                          ['GST Amount',   inr(exp.gst_amount)],
                          ['Total Amount', inr(exp.total_amount)],
                          ['Paid Amount',  inr(exp.paid_amount)],
                          ['Balance Due',  inr(exp.balance_payable)],
                          ['Invoice No.',  exp.invoice_number     || '—'],
                          ['Payment Mode', exp.payment_mode       || '—'],
                          ['Reference',    exp.payment_reference  || '—'],
                        ].map(([label, val]) => (
                          <div key={label} className="bg-white rounded-xl p-3">
                            <p className="text-xs text-[#718096] mb-0.5">{label}</p>
                            <p className="text-sm font-semibold text-[#2d3748]">{val}</p>
                          </div>
                        ))}
                      </div>

                      {/* Payment history */}
                      {payLogLoading ? (
                        <div className="text-center py-4 text-xs text-[#718096]">Loading payment log...</div>
                      ) : payLog.length > 0 ? (
                        <div className="bg-white rounded-xl overflow-hidden">
                          <p className="text-xs font-bold text-[#718096] px-4 py-2.5 border-b border-[#E8DFCA]">
                            Payment History
                          </p>
                          {payLog.map((log, idx) => (
                            <div key={log.id} className="flex items-center justify-between px-4 py-3 border-b border-[#F5EFE6] last:border-0">
                              <div>
                                <p className="text-sm font-semibold text-[#2d3748]">
                                  #{idx + 1} · {log.payment_mode}
                                  {log.payment_reference && ` · ${log.payment_reference}`}
                                </p>
                                <p className="text-xs text-[#718096]">
                                  {fmtDate(log.payment_date)} · {log.paid_by_name}
                                </p>
                              </div>
                              <p className="font-bold text-green-600">{inr(log.amount)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#718096]">No payment installments recorded.</p>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2">
                        {exp.payment_status !== 'paid' && (
                          <button
                            onClick={() => setPayModal(exp)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-xs font-semibold rounded-xl hover:bg-green-600 transition-all"
                          >
                            <IndianRupee size={12} /> Record Payment
                          </button>
                        )}
                        <button
                          onClick={() => handleEditClick(exp)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#CBDCEB] text-[#6D94C5] text-xs font-semibold rounded-xl hover:bg-[#b8d0e8] transition-all"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        {Number(exp.paid_amount) === 0 && (
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 text-xs font-semibold rounded-xl hover:bg-red-100 transition-all"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 1: ADD / EDIT EXPENSE ════════════════════════════════ */}
      {tab === 1 && (
        <div className="bg-white rounded-2xl border border-[#E8DFCA] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2">
              <Receipt size={16} className="text-[#6D94C5]" />
              {editId ? 'Edit Expense' : 'Record New Expense'}
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

            {/* Row 1 — Project + Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Project <span className="text-red-400">*</span>
                </label>
                <select name="project_id" value={form.project_id} onChange={handleChange} required className={inputCls}>
                  <option value="">— Select Project —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Category <span className="text-red-400">*</span>
                </label>
                <select name="category_id" value={form.category_id} onChange={handleChange} required className={inputCls}>
                  <option value="">— Select Category —</option>
                  {categories.filter((c) => c.is_active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2 — Vendor + Invoice */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Vendor Name</label>
                <input
                  name="vendor_name"
                  value={form.vendor_name}
                  onChange={handleChange}
                  placeholder="e.g. ABC Constructions Pvt. Ltd."
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Invoice Number</label>
                <input
                  name="invoice_number"
                  value={form.invoice_number}
                  onChange={handleChange}
                  placeholder="e.g. INV-2024-001"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Row 3 — Date + Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Expense Date</label>
                <input
                  name="expense_date"
                  type="date"
                  value={form.expense_date}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Description</label>
                <input
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Brief description of the expense"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Row 4 — Amount + GST + Total */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Amount <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={handleChange}
                    placeholder="Base amount"
                    required
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">GST Amount</label>
                <div className="relative">
                  <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
                  <input
                    name="gst_amount"
                    type="number"
                    step="0.01"
                    value={form.gst_amount}
                    onChange={handleChange}
                    placeholder="0"
                    className={`${inputCls} pl-8`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Total Amount</label>
                <div className="px-4 py-2.5 bg-[#CBDCEB] rounded-xl text-sm font-bold text-[#6D94C5]">
                  {inr(totalAmount())}
                </div>
              </div>
            </div>

            {/* Row 5 — Payment Mode + Reference */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Payment Mode
                  <span className="ml-1 font-normal text-[#718096]">(if already paid)</span>
                </label>
                <select name="payment_mode" value={form.payment_mode} onChange={handleChange} className={inputCls}>
                  <option value="">— Not paid yet —</option>
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Payment Reference</label>
                <input
                  name="payment_reference"
                  value={form.payment_reference}
                  onChange={handleChange}
                  placeholder="Cheque / UTR number"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Remarks</label>
              <textarea
                name="remarks"
                value={form.remarks}
                onChange={handleChange}
                rows={2}
                placeholder="Additional notes..."
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
                {saving ? 'Saving...' : editId ? 'Update Expense' : 'Record Expense'}
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

      {/* ══ TAB 2: SUMMARY ═══════════════════════════════════════════ */}
      {tab === 2 && (
        <div className="space-y-5">

          {/* Project filter */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex items-center gap-3 flex-wrap">
            <BarChart2 size={15} className="text-[#6D94C5]" />
            <select
              value={summaryProject}
              onChange={(e) => setSummaryProject(e.target.value)}
              className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[160px]"
            >
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              onClick={loadSummary}
              className="px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
            >
              Load
            </button>
          </div>

          {loading ? (
            <Loader />
          ) : summary ? (
            <>
              {/* Totals */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Total Entries"    value={summary.totals?.total_entries || 0} />
                <StatCard label="Total Expense"    value={inr(summary.totals?.total_expense)}   color="text-[#2d3748]" />
                <StatCard label="Total Paid"       value={inr(summary.totals?.total_paid)}       color="text-green-600" />
                <StatCard label="Total Unpaid"     value={inr(summary.totals?.total_unpaid)}     color="text-red-500" />
                <StatCard label="Fully Paid"       value={summary.totals?.fully_paid_count || 0} color="text-green-600" sub="entries" />
                <StatCard label="Partial / Unpaid" value={(summary.totals?.partial_count || 0) + (summary.totals?.unpaid_count || 0)} color="text-orange-500" sub="entries" />
              </div>

              {/* By category */}
              {summary.by_category?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E8DFCA] bg-[#F5EFE6]">
                    <p className="font-bold text-[#2d3748] text-sm">Breakdown by Category</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5EFE6]">
                        <tr>
                          {['Category', 'Entries', 'Total Amount', 'Paid', 'Pending', '% of Total'].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-bold text-[#718096] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5EFE6]">
                        {summary.by_category.map((cat) => (
                          <tr key={cat.category} className="hover:bg-[#F5EFE6] transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-[#CBDCEB] rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Tag size={13} className="text-[#6D94C5]" />
                                </div>
                                <p className="font-semibold text-[#2d3748]">{cat.category}</p>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-[#718096]">{cat.entry_count}</td>
                            <td className="px-5 py-3 font-bold text-[#2d3748]">{inr(cat.total_amount)}</td>
                            <td className="px-5 py-3 font-semibold text-green-600">{inr(cat.paid_amount)}</td>
                            <td className="px-5 py-3 font-semibold text-red-500">{inr(cat.pending_amount)}</td>
                            <td className="px-5 py-3 w-36">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-[#E8DFCA] rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-2 bg-[#6D94C5] rounded-full"
                                    style={{ width: `${Math.min(cat.percentage_of_total, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-[#718096] w-10">
                                  {Number(cat.percentage_of_total || 0).toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* By project (only when showing all) */}
              {!summaryProject && summary.by_project?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E8DFCA] bg-[#F5EFE6]">
                    <p className="font-bold text-[#2d3748] text-sm">Breakdown by Project</p>
                  </div>
                  <div className="divide-y divide-[#F5EFE6]">
                    {summary.by_project.map((p) => (
                      <div key={p.project_name} className="flex items-center justify-between px-5 py-4 hover:bg-[#F5EFE6] transition-colors">
                        <div>
                          <p className="font-semibold text-[#2d3748]">{p.project_name}</p>
                          <p className="text-xs text-[#718096]">{p.entry_count} entries</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#2d3748]">{inr(p.total_amount)}</p>
                          <p className="text-xs text-red-500">Pending: {inr(p.pending_amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly trend — uses extracted component to avoid @const in JSX */}
              {summary.monthly_trend?.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E8DFCA] bg-[#F5EFE6]">
                    <p className="font-bold text-[#2d3748] text-sm">Monthly Trend (Last 12 Months)</p>
                  </div>
                  <div className="p-5">
                    <MonthlyBarChart data={summary.monthly_trend} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <BarChart2 size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">Select a project and click Load</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 3: UNPAID ════════════════════════════════════════════ */}
      {tab === 3 && (
        <div className="space-y-4">

          {/* Project filter */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex items-center gap-3 flex-wrap">
            <Filter size={14} className="text-[#718096]" />
            <select
              value={unpaidProject}
              onChange={(e) => setUnpaidProject(e.target.value)}
              className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[160px]"
            >
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              onClick={loadUnpaid}
              className="px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
            >
              Refresh
            </button>
            <span className="text-xs text-[#718096]">{unpaid.length} unpaid / partial</span>
          </div>

          {/* Total unpaid banner */}
          {unpaid.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-500" />
                <p className="font-bold text-red-600">{unpaid.length} unpaid expenses</p>
              </div>
              <p className="text-xl font-bold text-red-500">
                {inr(unpaid.reduce((s, e) => s + Number(e.balance_payable || 0), 0))}
              </p>
            </div>
          )}

          {loading ? (
            <Loader />
          ) : unpaid.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-[#718096] font-medium">All expenses are paid</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unpaid.map((exp) => (
                <div key={exp.id} className="bg-white rounded-2xl border border-orange-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <AlertCircle size={16} className="text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[#2d3748]">{exp.vendor_name || 'No Vendor'}</p>
                        <span className="text-xs bg-[#CBDCEB] text-[#2d3748] px-2 py-0.5 rounded-full font-medium">
                          {exp.category_name}
                        </span>
                        <PayStatusBadge status={exp.payment_status} />
                      </div>
                      <p className="text-xs text-[#718096] mt-0.5">
                        {exp.project_name} · {fmtDate(exp.expense_date)}
                        {exp.invoice_number && ` · ${exp.invoice_number}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-orange-500 text-lg">{inr(exp.balance_payable)}</p>
                      <p className="text-xs text-[#718096]">of {inr(exp.total_amount)}</p>
                    </div>
                  </div>

                  <div className="px-5 pb-2">
                    <ProgressBar paid={Number(exp.paid_amount)} total={Number(exp.total_amount)} />
                  </div>

                  <div className="px-5 py-3 border-t border-[#F5EFE6] flex gap-2">
                    <button
                      onClick={() => setPayModal(exp)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-xs font-semibold rounded-xl hover:bg-green-600 transition-all"
                    >
                      <IndianRupee size={12} /> Pay Now
                    </button>
                    <button
                      onClick={() => handleEditClick(exp)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#CBDCEB] text-[#6D94C5] text-xs font-semibold rounded-xl hover:bg-[#b8d0e8] transition-all"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 4: CATEGORIES ════════════════════════════════════════ */}
      {tab === 4 && (
        <div className="space-y-5">

          {/* Add category form */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-6">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2 mb-5">
              <Tag size={15} className="text-[#6D94C5]" /> Add New Category
            </h3>
            <form onSubmit={handleCreateCategory} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Category Name</label>
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Plumbing, Interior, Branding..."
                  required
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                disabled={catSaving || !newCatName.trim()}
                className="px-5 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
              >
                {catSaving ? 'Adding...' : 'Add'}
              </button>
            </form>
          </div>

          {/* Categories list */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E8DFCA] flex items-center justify-between bg-[#F5EFE6]">
              <p className="font-bold text-[#2d3748] text-sm">All Categories</p>
              <span className="text-xs text-[#718096]">
                {categories.filter((c) => c.is_active).length} active
                {' · '}
                {categories.filter((c) => !c.is_active).length} inactive
              </span>
            </div>
            {categories.length === 0 ? (
              <div className="text-center py-10 text-[#718096] text-sm">No categories yet.</div>
            ) : (
              <div className="divide-y divide-[#F5EFE6]">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`flex items-center justify-between px-5 py-3 hover:bg-[#F5EFE6] transition-colors ${
                      !cat.is_active ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        cat.is_active ? 'bg-[#CBDCEB]' : 'bg-gray-100'
                      }`}>
                        <Tag size={14} className={cat.is_active ? 'text-[#6D94C5]' : 'text-gray-400'} />
                      </div>
                      <div>
                        <p className="font-semibold text-[#2d3748] text-sm">{cat.name}</p>
                        {!cat.is_active && (
                          <p className="text-xs text-gray-400">Inactive</p>
                        )}
                      </div>
                    </div>
                    {cat.is_active && (
                      <button
                        onClick={() => handleDeactivateCategory(cat.id, cat.name)}
                        className="text-xs px-3 py-1.5 bg-red-50 text-red-400 font-semibold rounded-lg hover:bg-red-100 transition-all"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info note */}
          <div className="bg-[#CBDCEB] rounded-xl p-4 text-xs text-[#2d3748]">
            <p className="font-bold mb-1">💡 About Categories</p>
            <p>
              Pre-seeded categories include: Construction, Architect, Consultant, Government Approvals,
              Marketing, Legal, Labour, Material, Electrical, Plumbing, Interior, and Other.
              Deactivating hides from dropdowns but keeps historical records intact.
            </p>
          </div>
        </div>
      )}

      {/* ══ PAY EXPENSE MODAL ════════════════════════════════════════ */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPayModal(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="bg-green-500 px-6 py-4">
              <p className="font-bold text-white flex items-center gap-2">
                <IndianRupee size={16} /> Record Payment Against Expense
              </p>
              <p className="text-green-100 text-sm mt-0.5">
                {payModal.vendor_name || payModal.category_name} · {payModal.project_name}
              </p>
            </div>

            <form onSubmit={handlePayExpense} className="p-6 space-y-4">

              {/* Balance */}
              <div className="bg-[#F5EFE6] rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-xs text-[#718096]">Total Amount</p>
                  <p className="font-semibold text-[#2d3748]">{inr(payModal.total_amount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#718096]">Balance Payable</p>
                  <p className="text-xl font-bold text-green-600">{inr(payModal.balance_payable)}</p>
                </div>
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
                    step="0.01"
                    value={payForm.amount}
                    onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder={`Max: ${inr(payModal.balance_payable)}`}
                    required
                    className={`${inputCls} pl-8`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPayForm((p) => ({ ...p, amount: String(payModal.balance_payable) }))}
                  className="text-xs text-[#6D94C5] hover:underline mt-1"
                >
                  Pay full balance ({inr(payModal.balance_payable)})
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
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Mode</label>
                  <select
                    value={payForm.payment_mode}
                    onChange={(e) => setPayForm((p) => ({ ...p, payment_mode: e.target.value }))}
                    className={inputCls}
                  >
                    {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Reference + Remarks */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Reference No.</label>
                  <input
                    value={payForm.payment_reference}
                    onChange={(e) => setPayForm((p) => ({ ...p, payment_reference: e.target.value }))}
                    placeholder="Cheque / UTR"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Remarks</label>
                  <input
                    value={payForm.remarks}
                    onChange={(e) => setPayForm((p) => ({ ...p, remarks: e.target.value }))}
                    placeholder="Optional"
                    className={inputCls}
                  />
                </div>
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