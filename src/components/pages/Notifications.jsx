import React, { useEffect, useState, useCallback } from 'react';
import {
  Bell, Send, MessageSquare, Mail,
  AlertCircle, CheckCircle, X,
  Search, Filter, RefreshCw,
  Users, ClipboardList, Clock,
  Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  sendPaymentReceiptApi, sendPaymentReminderApi,
  sendBookingConfirmedApi, sendOverdueAlertsApi,
  sendCustomApi, getNotifLogApi,
} from '../../services/repository/notificationRepository';
import { getBookingsApi }  from '../../services/repository/bookingRepository';
import { getProjectsApi }  from '../../services/repository/projectRepository';
import { getCustomersApi } from '../../services/repository/customerRepository';
import { getPaymentsByBookingApi } from '../../services/repository/paymentRepository';
import { getScheduleApi }  from '../../services/repository/bookingRepository';
import Loader from '../common/Loader';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ['Send Alert', 'Overdue Blast', 'Custom Message', 'Log'];

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp',   icon: '📱', color: 'bg-green-500 text-white' },
  { value: 'email',    label: 'Email',       icon: '✉️',  color: 'bg-blue-500 text-white'  },
  { value: 'both',     label: 'Both',        icon: '🔔',  color: 'bg-[#6D94C5] text-white'  },
];

const ALERT_TYPES = [
  {
    id:          'receipt',
    title:       'Payment Receipt',
    description: 'Send after recording a payment. Includes amount, date, mode, and balance due.',
    icon:        CheckCircle,
    color:       'text-green-600',
    bg:          'bg-green-50 border-green-200',
    needsPayment: true,
  },
  {
    id:          'reminder',
    title:       'Payment Reminder',
    description: 'Remind customer of an upcoming or overdue milestone.',
    icon:        Clock,
    color:       'text-orange-500',
    bg:          'bg-orange-50 border-orange-200',
    needsSchedule: true,
  },
  {
    id:          'confirmed',
    title:       'Booking Confirmed',
    description: 'Send booking confirmation with flat details and agreement value.',
    icon:        ClipboardList,
    color:       'text-blue-600',
    bg:          'bg-blue-50 border-blue-200',
  },
];

const STATUS_STYLE = {
  sent:    'bg-green-100 text-green-700',
  failed:  'bg-red-100 text-red-600',
  pending: 'bg-orange-100 text-orange-600',
};

const CHANNEL_STYLE = {
  whatsapp: 'bg-green-100 text-green-700',
  email:    'bg-blue-100 text-blue-700',
  both:     'bg-[#CBDCEB] text-[#6D94C5]',
};

const TYPE_LABEL = {
  payment_receipt:  'Payment Receipt',
  payment_reminder: 'Reminder',
  booking_confirmed:'Booking Confirmed',
  overdue_alert:    'Overdue Alert',
  custom:           'Custom',
};

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

const inputCls =
  'w-full px-4 py-2.5 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] transition-colors';

// ─── Channel selector ─────────────────────────────────────────────────────────
const ChannelSelector = ({ value, onChange }) => (
  <div className="flex gap-2">
    {CHANNELS.map((ch) => (
      <button
        key={ch.value}
        type="button"
        onClick={() => onChange(ch.value)}
        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
          value === ch.value
            ? ch.color
            : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
        }`}
      >
        <span>{ch.icon}</span> {ch.label}
      </button>
    ))}
  </div>
);

// ─── Result banner ────────────────────────────────────────────────────────────
const ResultBanner = ({ result, onClose }) => {
  if (!result) return null;
  const isSuccess = result.type === 'success';
  return (
    <div className={`flex items-start justify-between px-4 py-3 rounded-xl text-sm font-medium ${
      isSuccess ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
    }`}>
      <div className="flex items-start gap-2">
        {isSuccess ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />}
        <p>{result.message}</p>
      </div>
      <button onClick={onClose} className="ml-3 flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Notifications() {
  const [tab,      setTab]     = useState(0);
  const [projects, setProjects]= useState([]);
  const [bookings, setBookings]= useState([]);
  const [customers,setCustomers]=useState([]);
  const [saving,   setSaving]  = useState(false);
  const [result,   setResult]  = useState(null);

  // Send Alert tab
  const [alertType,     setAlertType]     = useState('receipt');
  const [selBooking,    setSelBooking]     = useState('');
  const [selPayment,    setSelPayment]     = useState('');
  const [selSchedule,   setSelSchedule]   = useState('');
  const [alertChannel,  setAlertChannel]  = useState('both');
  const [bookingPayments, setBookingPayments] = useState([]);
  const [bookingSchedules,setBookingSchedules]=useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [selBookingData, setSelBookingData] = useState(null);

  // Overdue blast tab
  const [blastProject,  setBlastProject]  = useState('');
  const [blastChannel,  setBlastChannel]  = useState('whatsapp');
  const [blastResult,   setBlastResult]   = useState(null);

  // Custom message tab
  const [customTarget,  setCustomTarget]  = useState('booking'); // 'booking' | 'customer'
  const [customBooking, setCustomBooking] = useState('');
  const [customCustomer,setCustomCustomer]= useState('');
  const [customChannel, setCustomChannel] = useState('whatsapp');
  const [customMessage, setCustomMessage] = useState('');
  const [customSubject, setCustomSubject] = useState('');

  // Log tab
  const [logs,       setLogs]       = useState([]);
  const [logsLoading,setLogsLoading]= useState(false);
  const [fChannel,   setFChannel]   = useState('');
  const [fType,      setFType]      = useState('');
  const [fStatus,    setFStatus]    = useState('');
  const [logSearch,  setLogSearch]  = useState('');
  const [expandedLog,setExpandedLog]= useState(null);

  // ── Load base data ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getProjectsApi(),
      getBookingsApi(),
      getCustomersApi(),
    ]).then(([pRes, bRes, cRes]) => {
      setProjects(pRes.data.data?.projects   || []);
      setBookings((bRes.data.data?.bookings  || []).filter((b) => b.status !== 'cancelled'));
      setCustomers(cRes.data.data?.customers || []);
    }).catch(() => {});
  }, []);

  // ── Load notification log ──────────────────────────────────
  const loadLog = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = {};
      if (fChannel) params.channel = fChannel;
      if (fType)    params.type    = fType;
      if (fStatus)  params.status  = fStatus;
      const { data } = await getNotifLogApi(params);
      setLogs(data.data?.logs || []);
    } catch {/* silent */}
    setLogsLoading(false);
  }, [fChannel, fType, fStatus]);

  useEffect(() => { if (tab === 3) loadLog(); }, [tab, loadLog]);

  // ── When booking selected — load its payments + schedule ──
  useEffect(() => {
    if (!selBooking) {
      setBookingPayments([]);
      setBookingSchedules([]);
      setSelBookingData(null);
      setSelPayment('');
      setSelSchedule('');
      return;
    }
    const found = bookings.find((b) => String(b.id) === selBooking);
    setSelBookingData(found || null);

    setBookingLoading(true);
    Promise.all([
      getPaymentsByBookingApi(selBooking),
      getScheduleApi(selBooking),
    ]).then(([pyRes, schRes]) => {
      setBookingPayments(pyRes.data.data?.payments  || []);
      setBookingSchedules((schRes.data.data?.schedule || []).filter((s) => !s.is_paid));
    }).catch(() => {
      setBookingPayments([]);
      setBookingSchedules([]);
    }).finally(() => setBookingLoading(false));
  }, [selBooking, bookings]);

  // ── Flash result ───────────────────────────────────────────
  const showResult = (message, type = 'success') => {
    setResult({ message, type });
    setTimeout(() => setResult(null), 5000);
  };

  // ── Send alert ─────────────────────────────────────────────
  const handleSendAlert = async (e) => {
    e.preventDefault();
    if (!selBooking) return showResult('Select a booking', 'error');

    if (alertType === 'receipt'  && !selPayment)  return showResult('Select a payment to send receipt for', 'error');
    if (alertType === 'reminder' && !selSchedule) return showResult('Select a milestone to send reminder for', 'error');

    setSaving(true);
    try {
      let res;
      if (alertType === 'receipt') {
        res = await sendPaymentReceiptApi({
          booking_id: Number(selBooking),
          payment_id: Number(selPayment),
          channel:    alertChannel,
        });
      } else if (alertType === 'reminder') {
        res = await sendPaymentReminderApi({
          booking_id:  Number(selBooking),
          schedule_id: Number(selSchedule),
          channel:     alertChannel,
        });
      } else {
        res = await sendBookingConfirmedApi({
          booking_id: Number(selBooking),
          channel:    alertChannel,
        });
      }
      const sent = res.data.data?.filter
        ? res.data.data.filter((r) => r.status === 'sent').length
        : 1;
      showResult(`Alert sent successfully via ${alertChannel} (${sent} message${sent > 1 ? 's' : ''})`);
      if (tab === 3) loadLog();
    } catch (err) {
      showResult(err.response?.data?.message || 'Failed to send alert', 'error');
    }
    setSaving(false);
  };

  // ── Send overdue blast ─────────────────────────────────────
  const handleOverdueBlast = async () => {
    setSaving(true);
    setBlastResult(null);
    try {
      const payload = { channel: blastChannel };
      if (blastProject) payload.project_id = Number(blastProject);
      const { data } = await sendOverdueAlertsApi(payload);
      const d = data.data;
      setBlastResult({
        type: 'success',
        message: `Blast complete — ${d.sent} sent, ${d.failed} failed (${d.total} overdue customers)`,
        detail: d,
      });
      if (tab === 3) loadLog();
    } catch (err) {
      setBlastResult({
        type: 'error',
        message: err.response?.data?.message || 'Failed to send overdue alerts',
      });
    }
    setSaving(false);
  };

  // ── Send custom message ────────────────────────────────────
  const handleCustomSend = async (e) => {
    e.preventDefault();
    if (!customMessage.trim()) return showResult('Message is required', 'error');
    if (customTarget === 'booking'  && !customBooking)  return showResult('Select a booking', 'error');
    if (customTarget === 'customer' && !customCustomer) return showResult('Select a customer', 'error');

    setSaving(true);
    try {
      const payload = {
        channel:  customChannel,
        message:  customMessage,
        subject:  customSubject || undefined,
      };
      if (customTarget === 'booking')  payload.booking_id  = Number(customBooking);
      if (customTarget === 'customer') payload.customer_id = Number(customCustomer);

      await sendCustomApi(payload);
      showResult('Custom message sent successfully');
      setCustomMessage('');
      setCustomSubject('');
      if (tab === 3) loadLog();
    } catch (err) {
      showResult(err.response?.data?.message || 'Failed to send message', 'error');
    }
    setSaving(false);
  };

  // ── Filtered logs ──────────────────────────────────────────
  const filteredLogs = logs.filter((l) => {
    if (!logSearch) return true;
    const q = logSearch.toLowerCase();
    return (
      l.recipient_name?.toLowerCase().includes(q)  ||
      l.recipient_phone?.includes(q)               ||
      l.recipient_email?.toLowerCase().includes(q) ||
      l.message?.toLowerCase().includes(q)
    );
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#2d3748]">Notifications</h2>
      </div>

      {/* Global result banner */}
      {result && (
        <ResultBanner result={result} onClose={() => setResult(null)} />
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

      {/* ══ TAB 0: SEND ALERT ════════════════════════════════════════ */}
      {tab === 0 && (
        <div className="space-y-5">

          {/* Alert type selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ALERT_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => {
                    setAlertType(type.id);
                    setSelPayment('');
                    setSelSchedule('');
                  }}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${
                    alertType === type.id
                      ? `${type.bg} border-current shadow-sm`
                      : 'bg-white border-[#E8DFCA] hover:border-[#CBDCEB]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                    alertType === type.id ? 'bg-white/70' : 'bg-[#F5EFE6]'
                  }`}>
                    <Icon size={18} className={type.color} />
                  </div>
                  <p className="font-bold text-[#2d3748] text-sm">{type.title}</p>
                  <p className="text-xs text-[#718096] mt-1">{type.description}</p>
                </button>
              );
            })}
          </div>

          {/* Alert form */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-6">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2 mb-5">
              <Send size={15} className="text-[#6D94C5]" />
              Send {ALERT_TYPES.find((t) => t.id === alertType)?.title}
            </h3>

            <form onSubmit={handleSendAlert} className="space-y-5">

              {/* Booking selector */}
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Booking <span className="text-red-400">*</span>
                </label>
                <select
                  value={selBooking}
                  onChange={(e) => setSelBooking(e.target.value)}
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
              {selBookingData && (
                <div className="bg-[#F5EFE6] rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-[#718096]">Customer</p>
                    <p className="font-bold text-[#2d3748] text-sm">{selBookingData.customer_name}</p>
                    <p className="text-xs text-[#718096]">{selBookingData.customer_phone}</p>
                    <p className="text-xs text-[#718096]">{selBookingData.customer_email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#718096]">Flat</p>
                    <p className="font-bold text-[#2d3748] text-sm">{selBookingData.flat_number}</p>
                    <p className="text-xs text-[#718096]">{selBookingData.project_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#718096]">Agreement Value</p>
                    <p className="font-bold text-[#6D94C5] text-sm">{inr(selBookingData.final_value)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#718096]">Balance Due</p>
                    <p className={`font-bold text-sm ${Number(selBookingData.balance_due) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {inr(selBookingData.balance_due)}
                    </p>
                  </div>
                </div>
              )}

              {/* Receipt — select payment */}
              {alertType === 'receipt' && selBooking && (
                <div>
                  {bookingLoading ? (
                    <p className="text-xs text-[#718096]">Loading payments...</p>
                  ) : (
                    <>
                      <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                        Select Payment <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={selPayment}
                        onChange={(e) => setSelPayment(e.target.value)}
                        required
                        className={inputCls}
                      >
                        <option value="">— Choose a payment —</option>
                        {bookingPayments.map((p) => (
                          <option key={p.id} value={p.id}>
                            {inr(p.amount)} · {p.payment_type} · {p.payment_mode}
                            {p.payment_date ? ` · ${new Date(p.payment_date).toLocaleDateString('en-IN')}` : ''}
                          </option>
                        ))}
                      </select>
                      {bookingPayments.length === 0 && (
                        <p className="text-xs text-orange-500 mt-1">No payments recorded for this booking yet.</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Reminder — select milestone */}
              {alertType === 'reminder' && selBooking && (
                <div>
                  {bookingLoading ? (
                    <p className="text-xs text-[#718096]">Loading schedule...</p>
                  ) : (
                    <>
                      <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                        Select Milestone <span className="text-red-400">*</span>
                        <span className="ml-1 font-normal text-[#718096]">(unpaid only)</span>
                      </label>
                      <select
                        value={selSchedule}
                        onChange={(e) => setSelSchedule(e.target.value)}
                        required
                        className={inputCls}
                      >
                        <option value="">— Choose a milestone —</option>
                        {bookingSchedules.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.milestone}
                            {s.due_date ? ` · Due ${new Date(s.due_date).toLocaleDateString('en-IN')}` : ''}
                            {` · ${inr(s.amount_due)}`}
                            {s.due_date && new Date(s.due_date) < new Date() ? ' ⚠️ OVERDUE' : ''}
                          </option>
                        ))}
                      </select>
                      {bookingSchedules.length === 0 && (
                        <p className="text-xs text-green-600 mt-1">All milestones are paid or no schedule exists.</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Channel selector */}
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-2">Send Via</label>
                <ChannelSelector value={alertChannel} onChange={setAlertChannel} />
                {alertChannel === 'whatsapp' && !selBookingData?.customer_phone && selBookingData && (
                  <p className="text-xs text-orange-500 mt-1.5">⚠️ No phone number on file for this customer.</p>
                )}
                {alertChannel === 'email' && !selBookingData?.customer_email && selBookingData && (
                  <p className="text-xs text-orange-500 mt-1.5">⚠️ No email address on file for this customer.</p>
                )}
              </div>

              {/* Message preview */}
              {selBookingData && (
                <div className="bg-[#F5EFE6] rounded-xl p-4 border border-[#E8DFCA]">
                  <p className="text-xs font-bold text-[#718096] mb-2">Message Preview</p>
                  <div className="bg-white rounded-lg p-3 text-xs text-[#4a5568] font-mono whitespace-pre-wrap leading-relaxed border border-[#E8DFCA]">
                    {alertType === 'receipt' && `Dear ${selBookingData.customer_name},\n\n✅ Payment Received\nProject: ${selBookingData.project_name}\nFlat: ${selBookingData.flat_number}\n${selPayment ? `Amount: ${inr(bookingPayments.find((p) => String(p.id) === selPayment)?.amount)}\n` : ''}Balance Due: ${inr(selBookingData.balance_due)}\n\nThank you.\nNivara Ventures`}
                    {alertType === 'reminder' && `Dear ${selBookingData.customer_name},\n\n🔔 Payment Reminder\nProject: ${selBookingData.project_name}\nFlat: ${selBookingData.flat_number}\n${selSchedule ? `Milestone: ${bookingSchedules.find((s) => String(s.id) === selSchedule)?.milestone || ''}\nAmount Due: ${inr(bookingSchedules.find((s) => String(s.id) === selSchedule)?.amount_due)}\n` : ''}Please arrange payment.\nNivara Ventures`}
                    {alertType === 'confirmed' && `Dear ${selBookingData.customer_name},\n\n🎉 Booking Confirmed!\nProject: ${selBookingData.project_name}\nFlat: ${selBookingData.flat_number}\nAgreement: ${inr(selBookingData.final_value)}\n\nOur team will reach out shortly.\nNivara Ventures`}
                  </div>
                </div>
              )}

              {/* Send button */}
              <button
                type="submit"
                disabled={saving || !selBooking}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
              >
                <Send size={14} />
                {saving ? 'Sending...' : `Send ${ALERT_TYPES.find((t) => t.id === alertType)?.title}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══ TAB 1: OVERDUE BLAST ═════════════════════════════════════ */}
      {tab === 1 && (
        <div className="space-y-5">

          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-6">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2 mb-2">
              <Zap size={16} className="text-orange-500" /> Bulk Overdue Alert
            </h3>
            <p className="text-sm text-[#718096] mb-6">
              Send an overdue payment alert to <strong>all customers</strong> with at least one unpaid milestone past its due date.
              Runs in one click.
            </p>

            {/* Project filter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Filter by Project
                  <span className="ml-1 font-normal text-[#718096]">(leave blank for all)</span>
                </label>
                <select
                  value={blastProject}
                  onChange={(e) => setBlastProject(e.target.value)}
                  className={inputCls}
                >
                  <option value="">All Projects</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Send Via</label>
                <ChannelSelector value={blastChannel} onChange={setBlastChannel} />
              </div>
            </div>

            {/* Warning */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-orange-600">Before you send</p>
                  <p className="text-xs text-orange-500 mt-1">
                    This will message every customer with an overdue payment milestone.
                    Ensure customer phone numbers and email addresses are up to date before blasting.
                  </p>
                </div>
              </div>
            </div>

            {/* Blast button */}
            <button
              onClick={handleOverdueBlast}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-60 transition-all"
            >
              <Zap size={14} />
              {saving ? 'Sending Alerts...' : 'Send Overdue Alerts'}
            </button>
          </div>

          {/* Blast result card */}
          {blastResult && (
            <div className={`rounded-2xl border p-5 ${
              blastResult.type === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-3">
                {blastResult.type === 'success'
                  ? <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                  : <AlertCircle  size={20} className="text-red-500 flex-shrink-0" />
                }
                <div className="flex-1">
                  <p className={`font-bold text-sm ${blastResult.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                    {blastResult.message}
                  </p>
                  {blastResult.detail && (
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      {[
                        ['Total Overdue', blastResult.detail.total, 'text-[#2d3748]'],
                        ['Sent',          blastResult.detail.sent,  'text-green-600'],
                        ['Failed',        blastResult.detail.failed,'text-red-500'],
                      ].map(([label, val, color]) => (
                        <div key={label} className="bg-white rounded-xl p-3 text-center border border-white/50">
                          <p className={`text-xl font-bold ${color}`}>{val}</p>
                          <p className="text-xs text-[#718096] mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setBlastResult(null)} className="text-[#718096] hover:text-red-500 transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Info note */}
          <div className="bg-[#CBDCEB] rounded-xl p-4 text-xs text-[#2d3748]">
            <p className="font-bold mb-1">💡 How Overdue Blast Works</p>
            <p>
              The system finds all payment milestones where <strong>due_date &lt; today</strong> and
              <strong> is_paid = false</strong>, then sends one alert per overdue milestone.
              Each message includes the milestone name, due date, amount, days overdue, and flat details.
              Failed alerts are logged and can be retried individually from the Log tab.
            </p>
          </div>
        </div>
      )}

      {/* ══ TAB 2: CUSTOM MESSAGE ════════════════════════════════════ */}
      {tab === 2 && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-6">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2 mb-5">
              <MessageSquare size={16} className="text-[#6D94C5]" /> Send Custom Message
            </h3>

            <form onSubmit={handleCustomSend} className="space-y-5">

              {/* Target type toggle */}
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-2">Send to</label>
                <div className="flex gap-2">
                  {[
                    { value: 'booking',  label: 'Booking',  icon: ClipboardList },
                    { value: 'customer', label: 'Customer', icon: Users },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setCustomTarget(value);
                        setCustomBooking('');
                        setCustomCustomer('');
                      }}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                        customTarget === value
                          ? 'bg-[#6D94C5] text-white'
                          : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
                      }`}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Entity selector */}
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  {customTarget === 'booking' ? 'Select Booking' : 'Select Customer'}
                  <span className="text-red-400 ml-1">*</span>
                </label>
                {customTarget === 'booking' ? (
                  <select
                    value={customBooking}
                    onChange={(e) => setCustomBooking(e.target.value)}
                    required
                    className={inputCls}
                  >
                    <option value="">— Select Booking —</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.customer_name} · {b.project_name} · Flat {b.flat_number}
                        {b.customer_phone ? ` · 📞 ${b.customer_phone}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={customCustomer}
                    onChange={(e) => setCustomCustomer(e.target.value)}
                    required
                    className={inputCls}
                  >
                    <option value="">— Select Customer —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.phone ? ` · 📞 ${c.phone}` : ''}
                        {c.email ? ` · ✉ ${c.email}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Channel */}
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-2">Send Via</label>
                <ChannelSelector value={customChannel} onChange={setCustomChannel} />
              </div>

              {/* Subject (email only) */}
              {(customChannel === 'email' || customChannel === 'both') && (
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                    Email Subject
                    <span className="ml-1 font-normal text-[#718096]">(optional — defaults to "Message from Nivara Ventures")</span>
                  </label>
                  <input
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="e.g. Important Update Regarding Your Flat"
                    className={inputCls}
                  />
                </div>
              )}

              {/* Message */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#718096]">
                    Message <span className="text-red-400">*</span>
                  </label>
                  <span className="text-xs text-[#718096]">{customMessage.length}/1000</span>
                </div>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value.slice(0, 1000))}
                  rows={5}
                  required
                  placeholder="Type your message here...&#10;&#10;Keep it clear and professional.&#10;For WhatsApp, plain text works best."
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Character/word guide */}
              <div className="bg-[#F5EFE6] rounded-xl p-3 text-xs text-[#718096]">
                <p className="font-semibold mb-1">Message Tips</p>
                <p>📱 <strong>WhatsApp:</strong> Keep under 300 characters for best readability. Plain text, no HTML.</p>
                <p className="mt-1">✉️ <strong>Email:</strong> Message is wrapped in branded Nivara Ventures email template automatically.</p>
              </div>

              {/* Send */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving || !customMessage.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
                >
                  <Send size={14} />
                  {saving ? 'Sending...' : 'Send Message'}
                </button>
                <button
                  type="button"
                  onClick={() => { setCustomMessage(''); setCustomSubject(''); }}
                  className="px-6 py-2.5 bg-[#E8DFCA] text-[#4a5568] text-sm font-semibold rounded-xl hover:bg-[#d4cdb8] transition-all"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ TAB 3: LOG ═══════════════════════════════════════════════ */}
      {tab === 3 && (
        <div className="space-y-4">

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 space-y-3">
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
                <input
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Name, phone, email, message..."
                  className="w-full pl-8 pr-4 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-[#F5EFE6] focus:outline-none focus:border-[#6D94C5]"
                />
              </div>
              <button
                onClick={loadLog}
                disabled={logsLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {/* Channel chips */}
            <div className="flex gap-2 flex-wrap">
              <p className="text-xs font-semibold text-[#718096] self-center">Channel:</p>
              {['', 'whatsapp', 'email'].map((ch) => (
                <button
                  key={ch}
                  onClick={() => setFChannel(ch)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                    fChannel === ch
                      ? 'bg-[#6D94C5] text-white'
                      : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
                  }`}
                >
                  {ch || 'All'}
                </button>
              ))}
            </div>

            {/* Status chips */}
            <div className="flex gap-2 flex-wrap">
              <p className="text-xs font-semibold text-[#718096] self-center">Status:</p>
              {['', 'sent', 'failed', 'pending'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFStatus(s)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                    fStatus === s
                      ? 'bg-[#6D94C5] text-white'
                      : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
                  }`}
                >
                  {s || 'All'}
                </button>
              ))}
            </div>

            {/* Type chips */}
            <div className="flex gap-2 flex-wrap">
              <p className="text-xs font-semibold text-[#718096] self-center">Type:</p>
              {['', 'payment_receipt', 'payment_reminder', 'booking_confirmed', 'overdue_alert', 'custom'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFType(t)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                    fType === t
                      ? 'bg-[#6D94C5] text-white'
                      : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
                  }`}
                >
                  {t ? TYPE_LABEL[t] : 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Log stats strip */}
          {filteredLogs.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Total',   filteredLogs.length,                                                     'text-[#2d3748]'],
                ['Sent',    filteredLogs.filter((l) => l.status === 'sent').length,                  'text-green-600'],
                ['Failed',  filteredLogs.filter((l) => l.status === 'failed').length,                'text-red-500'],
              ].map(([label, val, color]) => (
                <div key={label} className="bg-white rounded-xl border border-[#E8DFCA] p-3 text-center">
                  <p className={`text-xl font-bold ${color}`}>{val}</p>
                  <p className="text-xs text-[#718096]">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Log list */}
          {logsLoading ? (
            <Loader />
          ) : filteredLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <Bell size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No notification logs found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div key={log.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${
                  log.status === 'failed' ? 'border-red-200' : 'border-[#E8DFCA]'
                }`}>
                  {/* Log row */}
                  <div
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[#F5EFE6] transition-colors"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    {/* Channel icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${
                      log.channel === 'whatsapp' ? 'bg-green-50' : 'bg-blue-50'
                    }`}>
                      {log.channel === 'whatsapp' ? '📱' : '✉️'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#2d3748]">{log.recipient_name || '—'}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${CHANNEL_STYLE[log.channel]}`}>
                          {log.channel}
                        </span>
                        <span className="text-xs bg-[#F5EFE6] text-[#718096] px-2 py-0.5 rounded-full">
                          {TYPE_LABEL[log.type] || log.type}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[log.status]}`}>
                          {log.status}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-0.5 flex-wrap">
                        {log.recipient_phone && <p className="text-xs text-[#718096]">📞 {log.recipient_phone}</p>}
                        {log.recipient_email && <p className="text-xs text-[#718096]">✉ {log.recipient_email}</p>}
                        <p className="text-xs text-[#718096]">{fmtDate(log.sent_at)}</p>
                        {log.sent_by_name && <p className="text-xs text-[#718096]">by {log.sent_by_name}</p>}
                      </div>
                    </div>

                    {expandedLog === log.id
                      ? <ChevronUp size={14} className="text-[#6D94C5] flex-shrink-0" />
                      : <ChevronDown size={14} className="text-[#718096] flex-shrink-0" />
                    }
                  </div>

                  {/* Expanded log detail */}
                  {expandedLog === log.id && (
                    <div className="border-t border-[#F5EFE6] bg-[#F5EFE6] px-5 py-4 space-y-3">
                      {/* Provider reference */}
                      {log.provider_ref && (
                        <div className="bg-white rounded-xl px-4 py-2.5">
                          <p className="text-xs text-[#718096]">Provider Reference</p>
                          <p className="text-sm font-mono text-[#2d3748]">{log.provider_ref}</p>
                        </div>
                      )}

                      {/* Error message */}
                      {log.error_message && (
                        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                          <p className="text-xs font-bold text-red-600 mb-0.5">Error Message</p>
                          <p className="text-xs text-red-500">{log.error_message}</p>
                        </div>
                      )}

                      {/* Message preview */}
                      {log.message && (
                        <div className="bg-white rounded-xl px-4 py-3">
                          <p className="text-xs font-bold text-[#718096] mb-1.5">Message Sent</p>
                          <p className="text-xs text-[#4a5568] whitespace-pre-wrap leading-relaxed font-mono">
                            {log.message.length > 300
                              ? `${log.message.slice(0, 300)}...`
                              : log.message
                            }
                          </p>
                        </div>
                      )}

                      {/* Retry button for failed */}
                      {log.status === 'failed' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setAlertType('receipt');
                              if (log.booking_id) {
                                setSelBooking(String(log.booking_id));
                              }
                              setTab(0);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#6D94C5] text-white text-xs font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
                          >
                            <RefreshCw size={12} /> Retry Alert
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}