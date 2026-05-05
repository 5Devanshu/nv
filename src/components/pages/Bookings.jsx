import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, ClipboardList, User, Search,
  ChevronDown, ChevronUp, Pencil, X,
  CalendarDays, IndianRupee, AlertCircle,
  CheckCircle, UserPlus, Trash2, Clock,
} from 'lucide-react';
import {
  getBookingsApi, getBookingByIdApi,
  createBookingApi, updateBookingApi,
  cancelBookingApi, updateBookingStatusApi,
  getScheduleApi, addScheduleApi, removeScheduleApi,
} from '../../services/repository/bookingRepository';
import { getCustomersApi, createCustomerApi } from '../../services/repository/customerRepository';
import { getProjectsApi }                      from '../../services/repository/projectRepository';
import { getFlatsApi }                         from '../../services/repository/flatRepository';
import { getBrokersApi }                       from '../../services/repository/brokerRepository';
import Loader from '../common/Loader';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS            = ['All Bookings', 'New Booking', 'Customers'];
const BOOKING_STATUSES = ['booked', 'agreement_signed', 'registered', 'cancelled'];
const PAYMENT_MODES   = ['cash', 'cheque', 'NEFT', 'RTGS', 'UPI'];

const STATUS_STYLE = {
  booked:           'bg-blue-100 text-blue-700',
  agreement_signed: 'bg-purple-100 text-purple-700',
  registered:       'bg-green-100 text-green-700',
  cancelled:        'bg-red-100 text-red-600',
};

const inr  = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const inputCls =
  'w-full px-4 py-2.5 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] transition-colors';

const EMPTY_BOOKING = {
  project_id: '', flat_id: '', customer_id: '',
  broker_id: '', booking_date: new Date().toISOString().split('T')[0],
  booking_amount: '', agreement_value: '', discount: '0', remarks: '',
};

const EMPTY_CUSTOMER = {
  name: '', phone: '', email: '',
  pan_number: '', aadhaar_number: '', address: '',
};

const EMPTY_SCHEDULE = { milestone: '', due_date: '', amount_due: '' };

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-500'}`}>
    {status?.replace('_', ' ')}
  </span>
);

// ─── Progress bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ paid, total }) => {
  const pct = total ? Math.min(Math.round((paid / total) * 100), 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-[#E8DFCA] rounded-full h-1.5 overflow-hidden">
        <div className="h-1.5 bg-[#6D94C5] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-[#718096] w-8">{pct}%</span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Bookings() {
  const [tab,       setTab]      = useState(0);
  const [bookings,  setBookings] = useState([]);
  const [customers, setCustomers]= useState([]);
  const [projects,  setProjects] = useState([]);
  const [flats,     setFlats]    = useState([]);
  const [brokers,   setBrokers]  = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [saving,    setSaving]   = useState(false);
  const [msg,       setMsg]      = useState({ text: '', type: '' });

  // Booking form
  const [form,        setForm]       = useState(EMPTY_BOOKING);
  const [editId,      setEditId]     = useState(null);
  const [schedules,   setSchedules]  = useState([]);    // inline schedule rows

  // Filters
  const [fProject, setFProject] = useState('');
  const [fStatus,  setFStatus]  = useState('');
  const [search,   setSearch]   = useState('');

  // Expanded booking detail
  const [expanded, setExpanded] = useState(null);
  const [detail,   setDetail]   = useState(null);       // full booking with schedule

  // Customer quick-create
  const [showCustForm, setShowCustForm] = useState(false);
  const [custForm,     setCustForm]     = useState(EMPTY_CUSTOMER);

  // Customer search
  const [custSearch, setCustSearch] = useState('');

  // Cancel modal
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // Status change modal
  const [statusModal, setStatusModal] = useState(null);

  // Schedule modal (for existing booking)
  const [schedModal,    setSchedModal]    = useState(null); // booking object
  const [schedRows,     setSchedRows]     = useState([]);
  const [newSchedRow,   setNewSchedRow]   = useState(EMPTY_SCHEDULE);
  const [schedLoading,  setSchedLoading]  = useState(false);

  // ── Flash ──────────────────────────────────────────────────
  const flash = useCallback((text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
  }, []);

  // ── Load base data ─────────────────────────────────────────
  const loadBase = useCallback(async () => {
    try {
      const [pRes, cRes, brRes] = await Promise.all([
        getProjectsApi(),
        getCustomersApi(),
        getBrokersApi({ is_active: 'true' }),
      ]);
      setProjects(pRes.data.data?.projects   || []);
      setCustomers(cRes.data.data?.customers || []);
      setBrokers(brRes.data.data?.brokers    || []);
    } catch {/* silent */}
  }, []);

  // ── Load bookings ──────────────────────────────────────────
  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fProject) params.project_id = fProject;
      if (fStatus)  params.status     = fStatus;
      const { data } = await getBookingsApi(params);
      setBookings(data.data?.bookings || []);
    } catch {
      flash('Failed to load bookings', 'error');
    }
    setLoading(false);
  }, [fProject, fStatus, flash]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadBookings(); }, [loadBookings]);

  // ── Load available flats when project changes ──────────────
  useEffect(() => {
    if (!form.project_id) { setFlats([]); return; }
    getFlatsApi({ project_id: form.project_id, status: 'available' })
      .then(({ data }) => setFlats(data.data?.flats || []))
      .catch(() => setFlats([]));
  }, [form.project_id]);

  // ── Filtered bookings ──────────────────────────────────────
  const displayed = bookings.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.customer_name?.toLowerCase().includes(q) ||
      b.flat_number?.toLowerCase().includes(q)   ||
      b.project_name?.toLowerCase().includes(q)
    );
  });

  // ── Filtered customers for list tab ───────────────────────
  const filteredCustomers = customers.filter((c) => {
    if (!custSearch) return true;
    const q = custSearch.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q)  ||
      c.phone?.includes(q)               ||
      c.email?.toLowerCase().includes(q)
    );
  });

  // ── Form handler ───────────────────────────────────────────
  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const resetForm = () => {
    setForm(EMPTY_BOOKING);
    setEditId(null);
    setSchedules([]);
    setShowCustForm(false);
    setCustForm(EMPTY_CUSTOMER);
  };

  // ── Final value auto-calc ──────────────────────────────────
  const finalValue = () => {
    const agr = parseFloat(form.agreement_value) || 0;
    const dis = parseFloat(form.discount)         || 0;
    return agr - dis;
  };

  // ── Schedule rows (inline on new booking) ─────────────────
  const addScheduleRow = () =>
    setSchedules((p) => [...p, { ...EMPTY_SCHEDULE }]);

  const removeScheduleRow = (idx) =>
    setSchedules((p) => p.filter((_, i) => i !== idx));

  const updateScheduleRow = (idx, field, value) =>
    setSchedules((p) => p.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  // ── Customer quick-create ──────────────────────────────────
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!custForm.name.trim()) return flash('Customer name is required', 'error');
    setSaving(true);
    try {
      const { data } = await createCustomerApi(custForm);
      const newCust = data.data;
      setCustomers((p) => [newCust, ...p]);
      setForm((p) => ({ ...p, customer_id: String(newCust.id) }));
      setShowCustForm(false);
      setCustForm(EMPTY_CUSTOMER);
      flash('Customer created and selected');
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to create customer', 'error');
    }
    setSaving(false);
  };

  // ── Submit booking ─────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.project_id)  return flash('Select a project', 'error');
    if (!form.flat_id)     return flash('Select a flat', 'error');
    if (!form.customer_id) return flash('Select a customer', 'error');
    if (!form.booking_amount) return flash('Booking amount is required', 'error');

    setSaving(true);
    try {
      const payload = {
        ...form,
        project_id:     Number(form.project_id),
        flat_id:        Number(form.flat_id),
        customer_id:    Number(form.customer_id),
        broker_id:      form.broker_id ? Number(form.broker_id) : null,
        booking_amount: Number(form.booking_amount),
        agreement_value:form.agreement_value ? Number(form.agreement_value) : null,
        discount:       Number(form.discount) || 0,
        payment_schedules: schedules
          .filter((s) => s.milestone && s.amount_due)
          .map((s) => ({ ...s, amount_due: Number(s.amount_due) })),
      };

      if (editId) {
        await updateBookingApi(editId, payload);
        flash('Booking updated');
      } else {
        await createBookingApi(payload);
        flash('Booking created — flat is now blocked');
      }
      resetForm();
      loadBookings();
      setTab(0);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to save booking', 'error');
    }
    setSaving(false);
  };

  // ── Load full booking detail ───────────────────────────────
  const loadDetail = async (id) => {
    try {
      const { data } = await getBookingByIdApi(id);
      setDetail(data.data);
      setExpanded(id);
    } catch {
      flash('Failed to load booking detail', 'error');
    }
  };

  const toggleExpand = (id) => {
    if (expanded === id) { setExpanded(null); setDetail(null); }
    else loadDetail(id);
  };

  // ── Cancel booking ─────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelModal) return;
    setSaving(true);
    try {
      await cancelBookingApi(cancelModal.id, { cancellation_reason: cancelReason });
      flash('Booking cancelled — flat reset to available');
      setCancelModal(null);
      setCancelReason('');
      loadBookings();
      setDetail(null);
      setExpanded(null);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to cancel', 'error');
    }
    setSaving(false);
  };

  // ── Status change ──────────────────────────────────────────
  const handleStatusChange = async (status) => {
    if (!statusModal) return;
    setSaving(true);
    try {
      await updateBookingStatusApi(statusModal.id, status);
      flash(`Status updated to ${status.replace('_', ' ')}`);
      setStatusModal(null);
      loadBookings();
      if (expanded === statusModal.id) loadDetail(statusModal.id);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to update status', 'error');
    }
    setSaving(false);
  };

  // ── Load schedule for modal ────────────────────────────────
  const openScheduleModal = async (booking) => {
    setSchedModal(booking);
    setSchedLoading(true);
    try {
      const { data } = await getScheduleApi(booking.id);
      setSchedRows(data.data?.schedule || []);
    } catch {
      flash('Failed to load schedule', 'error');
    }
    setSchedLoading(false);
  };

  // ── Add milestone ──────────────────────────────────────────
  const handleAddMilestone = async (e) => {
    e.preventDefault();
    if (!newSchedRow.milestone || !newSchedRow.amount_due)
      return flash('Milestone and amount are required', 'error');
    setSaving(true);
    try {
      await addScheduleApi(schedModal.id, {
        ...newSchedRow,
        amount_due: Number(newSchedRow.amount_due),
      });
      flash('Milestone added');
      setNewSchedRow(EMPTY_SCHEDULE);
      const { data } = await getScheduleApi(schedModal.id);
      setSchedRows(data.data?.schedule || []);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to add milestone', 'error');
    }
    setSaving(false);
  };

  // ── Remove milestone ───────────────────────────────────────
  const handleRemoveMilestone = async (sid) => {
    if (!window.confirm('Remove this milestone?')) return;
    try {
      await removeScheduleApi(schedModal.id, sid);
      flash('Milestone removed');
      const { data } = await getScheduleApi(schedModal.id);
      setSchedRows(data.data?.schedule || []);
    } catch (err) {
      flash(err.response?.data?.message || 'Cannot remove a paid milestone', 'error');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#2d3748]">Bookings & Sales</h2>
        <button
          onClick={() => { resetForm(); setTab(1); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
        >
          <Plus size={15} /> New Booking
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
      <div className="flex gap-2 bg-[#E8DFCA] p-1 rounded-xl w-fit">
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

      {/* ══ TAB 0: ALL BOOKINGS ══════════════════════════════════════ */}
      {tab === 0 && (
        <div className="space-y-4">

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 space-y-3">
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Customer / flat / project..."
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
            </div>
            <div className="flex gap-2 flex-wrap">
              {['', ...BOOKING_STATUSES].map((s) => (
                <button
                  key={s}
                  onClick={() => setFStatus(s)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                    fStatus === s
                      ? 'bg-[#6D94C5] text-white'
                      : 'bg-[#F5EFE6] text-[#718096] hover:border-[#6D94C5] border border-transparent'
                  }`}
                >
                  {s ? s.replace('_', ' ') : 'All Status'}
                </button>
              ))}
            </div>
          </div>

          {/* Booking cards */}
          {loading ? (
            <Loader />
          ) : displayed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <ClipboardList size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No bookings found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayed.map((b) => (
                <div key={b.id} className={`bg-white rounded-2xl border overflow-hidden ${
                  b.status === 'cancelled' ? 'border-red-100 opacity-70' : 'border-[#E8DFCA]'
                }`}>

                  {/* Card header */}
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="w-10 h-10 bg-[#CBDCEB] rounded-xl flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-[#6D94C5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#2d3748] truncate">{b.customer_name}</p>
                      <p className="text-xs text-[#718096] mt-0.5">
                        {b.project_name} · Flat {b.flat_number}
                        {b.configuration && ` · ${b.configuration}`}
                        {b.floor !== undefined && ` · Floor ${b.floor}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={b.status} />
                      <button
                        onClick={() => toggleExpand(b.id)}
                        className="p-1.5 text-[#718096] hover:text-[#6D94C5] transition-colors"
                      >
                        {expanded === b.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Key metrics row */}
                  <div className="grid grid-cols-3 divide-x divide-[#F5EFE6] border-t border-[#F5EFE6]">
                    <div className="px-5 py-3">
                      <p className="text-xs text-[#718096]">Agreement Value</p>
                      <p className="font-bold text-[#2d3748]">{inr(b.final_value)}</p>
                    </div>
                    <div className="px-5 py-3">
                      <p className="text-xs text-[#718096]">Received</p>
                      <p className="font-bold text-green-600">{inr(b.total_paid)}</p>
                    </div>
                    <div className="px-5 py-3">
                      <p className="text-xs text-[#718096]">Balance Due</p>
                      <p className={`font-bold ${Number(b.balance_due) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {inr(b.balance_due)}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {b.final_value > 0 && (
                    <div className="px-5 py-2 border-t border-[#F5EFE6]">
                      <ProgressBar paid={Number(b.total_paid)} total={Number(b.final_value)} />
                    </div>
                  )}

                  {/* Expanded detail */}
                  {expanded === b.id && detail && detail.id === b.id && (
                    <div className="border-t border-[#F5EFE6] px-5 py-5 space-y-5 bg-[#F5EFE6]">

                      {/* Info grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          ['Booking Date',   fmtDate(detail.booking_date)],
                          ['Booking Amount', inr(detail.booking_amount)],
                          ['Agreement Value',inr(detail.agreement_value)],
                          ['Discount',       inr(detail.discount)],
                          ['Customer Phone', detail.customer_phone || '—'],
                          ['Customer Email', detail.customer_email || '—'],
                          ['PAN',            detail.pan_number     || '—'],
                          ['Broker',         detail.broker_name    || 'Direct'],
                        ].map(([label, value]) => (
                          <div key={label} className="bg-white rounded-xl p-3">
                            <p className="text-xs text-[#718096] mb-0.5">{label}</p>
                            <p className="text-sm font-semibold text-[#2d3748] truncate">{value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Payment schedule */}
                      {detail.payment_schedule?.length > 0 && (
                        <div className="bg-white rounded-xl overflow-hidden">
                          <div className="px-4 py-3 border-b border-[#E8DFCA] flex items-center justify-between">
                            <p className="text-sm font-bold text-[#2d3748]">Payment Schedule</p>
                            <button
                              onClick={() => openScheduleModal(b)}
                              className="text-xs text-[#6D94C5] font-semibold hover:underline"
                            >
                              Manage
                            </button>
                          </div>
                          <div className="divide-y divide-[#F5EFE6]">
                            {detail.payment_schedule.map((s) => (
                              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                                <div>
                                  <p className="text-sm font-semibold text-[#2d3748]">{s.milestone}</p>
                                  <p className="text-xs text-[#718096]">Due: {fmtDate(s.due_date)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-[#2d3748]">{inr(s.amount_due)}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                    s.is_paid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'
                                  }`}>
                                    {s.is_paid ? 'Paid' : 'Pending'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Remarks */}
                      {detail.remarks && (
                        <p className="text-xs text-[#718096]">Remarks: {detail.remarks}</p>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openScheduleModal(b)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#CBDCEB] text-[#6D94C5] text-xs font-semibold rounded-xl hover:bg-[#b8d0e8] transition-all"
                        >
                          <CalendarDays size={13} /> Schedule
                        </button>
                        <button
                          onClick={() => setStatusModal(b)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 text-purple-600 text-xs font-semibold rounded-xl hover:bg-purple-100 transition-all"
                        >
                          <CheckCircle size={13} /> Update Status
                        </button>
                        {b.status !== 'cancelled' && b.status !== 'registered' && (
                          <button
                            onClick={() => { setCancelModal(b); setCancelReason(''); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 text-xs font-semibold rounded-xl hover:bg-red-100 transition-all"
                          >
                            <X size={13} /> Cancel Booking
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

      {/* ══ TAB 1: NEW BOOKING ═══════════════════════════════════════ */}
      {tab === 1 && (
        <div className="space-y-5">

          {/* Main booking form */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-6">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2 mb-6">
              <ClipboardList size={16} className="text-[#6D94C5]" />
              {editId ? 'Edit Booking' : 'New Booking'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Row 1 — Project + Flat */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                    Project <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="project_id"
                    value={form.project_id}
                    onChange={(e) => setForm((p) => ({ ...p, project_id: e.target.value, flat_id: '' }))}
                    required
                    className={inputCls}
                  >
                    <option value="">— Select Project —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                    Flat <span className="text-red-400">*</span>
                    {form.project_id && (
                      <span className="ml-2 font-normal text-[#718096]">
                        ({flats.length} available)
                      </span>
                    )}
                  </label>
                  <select
                    name="flat_id"
                    value={form.flat_id}
                    onChange={handleChange}
                    required
                    disabled={!form.project_id}
                    className={`${inputCls} disabled:bg-[#F5EFE6] disabled:cursor-not-allowed`}
                  >
                    <option value="">— Select Available Flat —</option>
                    {flats.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.flat_number} · Floor {f.floor} · {f.configuration}
                        {f.total_price ? ` · ${inr(f.total_price)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2 — Customer */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#718096]">
                    Customer <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCustForm(!showCustForm)}
                    className="flex items-center gap-1 text-xs text-[#6D94C5] font-semibold hover:underline"
                  >
                    <UserPlus size={12} />
                    {showCustForm ? 'Cancel' : 'Quick Add Customer'}
                  </button>
                </div>

                {/* Quick-create customer form */}
                {showCustForm && (
                  <div className="mb-3 p-4 bg-[#F5EFE6] rounded-xl border border-[#E8DFCA]">
                    <p className="text-xs font-bold text-[#718096] mb-3">New Customer</p>
                    <form onSubmit={handleCreateCustomer} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        value={custForm.name}
                        onChange={(e) => setCustForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Full Name *"
                        required
                        className={inputCls}
                      />
                      <input
                        value={custForm.phone}
                        onChange={(e) => setCustForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="Phone"
                        className={inputCls}
                      />
                      <input
                        value={custForm.email}
                        onChange={(e) => setCustForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="Email"
                        type="email"
                        className={inputCls}
                      />
                      <input
                        value={custForm.pan_number}
                        onChange={(e) => setCustForm((p) => ({ ...p, pan_number: e.target.value.toUpperCase() }))}
                        placeholder="PAN Number"
                        className={inputCls}
                      />
                      <input
                        value={custForm.aadhaar_number}
                        onChange={(e) => setCustForm((p) => ({ ...p, aadhaar_number: e.target.value }))}
                        placeholder="Aadhaar Number"
                        className={inputCls}
                      />
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
                      >
                        {saving ? 'Creating...' : 'Create & Select'}
                      </button>
                    </form>
                  </div>
                )}

                <select
                  name="customer_id"
                  value={form.customer_id}
                  onChange={handleChange}
                  required
                  className={inputCls}
                >
                  <option value="">— Select Customer —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.phone ? ` · ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 3 — Broker + Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Broker (Optional)</label>
                  <select name="broker_id" value={form.broker_id} onChange={handleChange} className={inputCls}>
                    <option value="">— Direct / No Broker —</option>
                    {brokers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.company ? ` · ${b.company}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Booking Date</label>
                  <input
                    name="booking_date"
                    type="date"
                    value={form.booking_date}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Row 4 — Amounts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                    Booking Amount <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
                    <input
                      name="booking_amount"
                      type="number"
                      value={form.booking_amount}
                      onChange={handleChange}
                      placeholder="e.g. 100000"
                      required
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Agreement Value</label>
                  <div className="relative">
                    <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
                    <input
                      name="agreement_value"
                      type="number"
                      value={form.agreement_value}
                      onChange={handleChange}
                      placeholder="e.g. 5000000"
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">Discount</label>
                  <div className="relative">
                    <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
                    <input
                      name="discount"
                      type="number"
                      value={form.discount}
                      onChange={handleChange}
                      placeholder="0"
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                </div>
              </div>

              {/* Final value display */}
              {form.agreement_value && (
                <div className="bg-[#CBDCEB] rounded-xl px-4 py-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#2d3748]">Final Agreement Value</p>
                  <p className="text-lg font-bold text-[#6D94C5]">{inr(finalValue())}</p>
                </div>
              )}

              {/* Row 5 — Remarks */}
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Remarks</label>
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Optional notes..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Payment schedule section */}
              <div className="border-t border-[#E8DFCA] pt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-[#2d3748] flex items-center gap-2">
                    <CalendarDays size={15} className="text-[#6D94C5]" />
                    Payment Schedule
                    <span className="text-xs font-normal text-[#718096]">(optional — add after booking if preferred)</span>
                  </p>
                  <button
                    type="button"
                    onClick={addScheduleRow}
                    className="flex items-center gap-1 text-xs text-[#6D94C5] font-semibold hover:underline"
                  >
                    <Plus size={12} /> Add Milestone
                  </button>
                </div>

                {schedules.length > 0 && (
                  <div className="space-y-2">
                    {schedules.map((s, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          value={s.milestone}
                          onChange={(e) => updateScheduleRow(idx, 'milestone', e.target.value)}
                          placeholder="Milestone (e.g. On Slab)"
                          className="col-span-5 px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm focus:outline-none focus:border-[#6D94C5]"
                        />
                        <input
                          type="date"
                          value={s.due_date}
                          onChange={(e) => updateScheduleRow(idx, 'due_date', e.target.value)}
                          className="col-span-3 px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm focus:outline-none focus:border-[#6D94C5]"
                        />
                        <input
                          type="number"
                          value={s.amount_due}
                          onChange={(e) => updateScheduleRow(idx, 'amount_due', e.target.value)}
                          placeholder="Amount"
                          className="col-span-3 px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm focus:outline-none focus:border-[#6D94C5]"
                        />
                        <button
                          type="button"
                          onClick={() => removeScheduleRow(idx)}
                          className="col-span-1 p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-[#718096] mt-1">
                      Total scheduled: {inr(schedules.reduce((s, r) => s + (Number(r.amount_due) || 0), 0))}
                    </p>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
                >
                  {saving ? 'Saving...' : editId ? 'Update Booking' : 'Create Booking'}
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

          {/* Info note */}
          <div className="bg-[#CBDCEB] rounded-xl p-4 text-xs text-[#2d3748]">
            <p className="font-bold mb-1">💡 Booking Note</p>
            <p>Creating a booking will automatically set the flat status to <strong>Blocked</strong>.
            When the booking status is updated to <strong>Registered</strong>, the flat will be marked as <strong>Sold</strong>.
            Cancelling a booking resets the flat to <strong>Available</strong>.</p>
          </div>
        </div>
      )}

      {/* ══ TAB 2: CUSTOMERS ════════════════════════════════════════ */}
      {tab === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex items-center gap-3">
            <Search size={14} className="text-[#718096]" />
            <input
              value={custSearch}
              onChange={(e) => setCustSearch(e.target.value)}
              placeholder="Search by name, phone, or email..."
              className="flex-1 text-sm focus:outline-none bg-transparent"
            />
            {custSearch && (
              <button onClick={() => setCustSearch('')} className="text-[#718096] hover:text-red-400">
                <X size={13} />
              </button>
            )}
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <User size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No customers found</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
              <div className="px-5 py-3 bg-[#F5EFE6] border-b border-[#E8DFCA]">
                <p className="text-xs font-bold text-[#718096]">{filteredCustomers.length} customers</p>
              </div>
              <div className="divide-y divide-[#F5EFE6]">
                {filteredCustomers.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-4 hover:bg-[#F5EFE6] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#CBDCEB] rounded-xl flex items-center justify-center flex-shrink-0">
                        <User size={15} className="text-[#6D94C5]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#2d3748]">{c.name}</p>
                        <div className="flex gap-3 mt-0.5">
                          {c.phone && <p className="text-xs text-[#718096]">{c.phone}</p>}
                          {c.email && <p className="text-xs text-[#718096]">{c.email}</p>}
                        </div>
                        {(c.pan_number || c.aadhaar_number) && (
                          <div className="flex gap-3 mt-0.5">
                            {c.pan_number     && <p className="text-xs text-[#718096]">PAN: {c.pan_number}</p>}
                            {c.aadhaar_number && <p className="text-xs text-[#718096]">Aadhaar: ••••{c.aadhaar_number.slice(-4)}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.total_bookings > 0 && (
                        <span className="text-xs bg-[#CBDCEB] text-[#6D94C5] px-2.5 py-1 rounded-full font-semibold">
                          {c.total_bookings} booking{c.total_bookings > 1 ? 's' : ''}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setForm((p) => ({ ...p, customer_id: String(c.id) }));
                          setTab(1);
                        }}
                        className="text-xs px-3 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all"
                      >
                        Book
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ CANCEL MODAL ════════════════════════════════════════════ */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCancelModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <AlertCircle size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-bold text-[#2d3748]">Cancel Booking</p>
                <p className="text-xs text-[#718096]">{cancelModal.customer_name} · Flat {cancelModal.flat_number}</p>
              </div>
            </div>
            <p className="text-sm text-[#4a5568] mb-4">
              This will cancel the booking and reset the flat status to <strong>Available</strong>.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Reason (optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Reason for cancellation..."
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex-1 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 disabled:opacity-60 transition-all"
              >
                {saving ? 'Cancelling...' : 'Yes, Cancel Booking'}
              </button>
              <button
                onClick={() => setCancelModal(null)}
                className="flex-1 py-2.5 bg-[#E8DFCA] text-[#4a5568] text-sm font-semibold rounded-xl transition-all"
              >
                Keep Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ STATUS CHANGE MODAL ══════════════════════════════════════ */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setStatusModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <p className="font-bold text-[#2d3748] mb-1">Update Booking Status</p>
            <p className="text-xs text-[#718096] mb-5">
              {statusModal.customer_name} · Flat {statusModal.flat_number}
            </p>
            <div className="space-y-2">
              {BOOKING_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={saving || s === statusModal.status}
                  className={`w-full py-2.5 px-4 text-sm font-semibold rounded-xl capitalize text-left transition-all ${
                    s === statusModal.status
                      ? 'bg-[#6D94C5] text-white cursor-default'
                      : 'bg-[#F5EFE6] text-[#4a5568] hover:bg-[#CBDCEB] hover:text-[#2d3748]'
                  }`}
                >
                  {s.replace('_', ' ')}
                  {s === statusModal.status && ' ✓ Current'}
                  {s === 'registered' && s !== statusModal.status && (
                    <span className="ml-2 text-xs text-orange-500">(marks flat as Sold)</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStatusModal(null)}
              className="w-full mt-4 py-2 bg-[#E8DFCA] text-[#4a5568] text-sm font-semibold rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══ SCHEDULE MANAGE MODAL ════════════════════════════════════ */}
      {schedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSchedModal(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="bg-[#6D94C5] px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-white flex items-center gap-2">
                  <CalendarDays size={15} /> Payment Schedule
                </p>
                <p className="text-[#CBDCEB] text-xs mt-0.5">
                  {schedModal.customer_name} · Flat {schedModal.flat_number}
                </p>
              </div>
              <button
                onClick={() => setSchedModal(null)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-all text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Add milestone form */}
              <form onSubmit={handleAddMilestone} className="bg-[#F5EFE6] rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-[#718096]">Add New Milestone</p>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    value={newSchedRow.milestone}
                    onChange={(e) => setNewSchedRow((p) => ({ ...p, milestone: e.target.value }))}
                    placeholder="Milestone name *"
                    className={inputCls}
                  />
                  <input
                    type="date"
                    value={newSchedRow.due_date}
                    onChange={(e) => setNewSchedRow((p) => ({ ...p, due_date: e.target.value }))}
                    className={inputCls}
                  />
                  <input
                    type="number"
                    value={newSchedRow.amount_due}
                    onChange={(e) => setNewSchedRow((p) => ({ ...p, amount_due: e.target.value }))}
                    placeholder="Amount *"
                    className={inputCls}
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
                >
                  {saving ? 'Adding...' : 'Add Milestone'}
                </button>
              </form>

              {/* Existing milestones */}
              {schedLoading ? (
                <Loader />
              ) : schedRows.length === 0 ? (
                <p className="text-center text-sm text-[#718096] py-4">No milestones yet.</p>
              ) : (
                <div className="space-y-2">
                  {schedRows.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        s.is_paid
                          ? 'bg-green-50 border-green-200'
                          : s.due_date && new Date(s.due_date) < new Date()
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-white border-[#E8DFCA]'
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-[#2d3748] text-sm">{s.milestone}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-xs text-[#718096]">
                            <Clock size={10} className="inline mr-1" />
                            {fmtDate(s.due_date)}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            s.is_paid
                              ? 'bg-green-100 text-green-700'
                              : s.due_date && new Date(s.due_date) < new Date()
                              ? 'bg-orange-100 text-orange-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {s.is_paid ? 'Paid' : s.due_date && new Date(s.due_date) < new Date() ? 'Overdue' : 'Upcoming'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-[#2d3748]">{inr(s.amount_due)}</p>
                        {!s.is_paid && (
                          <button
                            onClick={() => handleRemoveMilestone(s.id)}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                            title="Remove milestone"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="flex justify-between items-center px-4 py-3 bg-[#F5EFE6] rounded-xl border border-[#E8DFCA]">
                    <p className="text-sm font-bold text-[#718096]">Total Scheduled</p>
                    <p className="text-sm font-bold text-[#6D94C5]">
                      {inr(schedRows.reduce((s, r) => s + Number(r.amount_due), 0))}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}