import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Upload, FileText, Search, Filter,
  Download, Pencil, Trash2, X,
  File, Image, FileSpreadsheet,
  CheckCircle, FolderOpen, Eye,
} from 'lucide-react';
import {
  uploadDocumentApi, getDocumentsApi,
  updateDocLabelApi, deleteDocumentApi,
  getDocsByBookingApi, getDocsByCustomerApi,
  getDocsByProjectApi, downloadDocumentApi,
} from '../../services/repository/documentRepository';
import { getProjectsApi }  from '../../services/repository/projectRepository';
import { getBookingsApi }  from '../../services/repository/bookingRepository';
import { getCustomersApi } from '../../services/repository/customerRepository';
import Loader from '../common/Loader';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS     = ['Upload', 'Browse All', 'By Booking', 'By Customer', 'By Project'];
const DOC_TYPES = [
  'agreement', 'kyc', 'payment_receipt', 'approval',
  'plan', 'noc', 'legal', 'marketing', 'other',
];
const ACCEPTED_MIME = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xlsx,.xls';

const TYPE_STYLE = {
  agreement:       'bg-blue-100 text-blue-700',
  kyc:             'bg-purple-100 text-purple-700',
  payment_receipt: 'bg-green-100 text-green-700',
  approval:        'bg-orange-100 text-orange-600',
  plan:            'bg-[#CBDCEB] text-[#6D94C5]',
  noc:             'bg-teal-100 text-teal-700',
  legal:           'bg-red-100 text-red-600',
  marketing:       'bg-pink-100 text-pink-700',
  other:           'bg-gray-100 text-gray-600',
};

const fmtDate  = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';
const fmtSize  = (bytes) => {
  if (!bytes) return '—';
  const kb = bytes / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
};

const inputCls =
  'w-full px-4 py-2.5 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] transition-colors';

// ─── File icon based on MIME type ─────────────────────────────────────────────
const FileIcon = ({ mimeType, size = 16 }) => {
  if (mimeType?.startsWith('image/'))
    return <Image size={size} className="text-green-500" />;
  if (mimeType === 'application/pdf')
    return <FileText size={size} className="text-red-500" />;
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel'))
    return <FileSpreadsheet size={size} className="text-green-700" />;
  return <File size={size} className="text-[#6D94C5]" />;
};

// ─── Doc type badge ───────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => (
  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${TYPE_STYLE[type] || 'bg-gray-100 text-gray-500'}`}>
    {type?.replace('_', ' ')}
  </span>
);

// ─── Document card (reused across all tabs) ───────────────────────────────────
const DocCard = ({ doc, onDownload, onRename, onDelete, showEntity = true }) => (
  <div className="flex items-center gap-3 px-5 py-4 hover:bg-[#F5EFE6] transition-colors group">
    <div className="w-10 h-10 bg-[#F5EFE6] rounded-xl flex items-center justify-center flex-shrink-0">
      <FileIcon mimeType={doc.mime_type} size={18} />
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-semibold text-[#2d3748] truncate max-w-[220px]">
          {doc.doc_label || doc.file_name}
        </p>
        <TypeBadge type={doc.doc_type} />
      </div>
      <div className="flex gap-3 mt-0.5 flex-wrap">
        {doc.doc_label && (
          <p className="text-xs text-[#718096] truncate max-w-[180px]">{doc.file_name}</p>
        )}
        <p className="text-xs text-[#718096]">{fmtSize(doc.file_size)}</p>
        <p className="text-xs text-[#718096]">{fmtDate(doc.uploaded_at)}</p>
        {doc.uploaded_by_name && (
          <p className="text-xs text-[#718096]">by {doc.uploaded_by_name}</p>
        )}
      </div>
      {showEntity && (
        <div className="flex gap-3 mt-0.5">
          {doc.project_name  && <p className="text-xs text-[#CBDCEB]">📁 {doc.project_name}</p>}
          {doc.flat_number   && <p className="text-xs text-[#CBDCEB]">🏢 Flat {doc.flat_number}</p>}
          {doc.customer_name && <p className="text-xs text-[#CBDCEB]">👤 {doc.customer_name}</p>}
        </div>
      )}
    </div>

    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
      <button
        onClick={() => onDownload(doc)}
        className="p-2 text-[#6D94C5] hover:bg-[#CBDCEB] rounded-lg transition-all"
        title="Download"
      >
        <Download size={14} />
      </button>
      <button
        onClick={() => onRename(doc)}
        className="p-2 text-[#718096] hover:bg-[#E8DFCA] rounded-lg transition-all"
        title="Rename label"
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={() => onDelete(doc)}
        className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"
        title="Delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  </div>
);

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyDocs = ({ message = 'No documents found' }) => (
  <div className="py-12 text-center">
    <FolderOpen size={40} className="text-[#CBDCEB] mx-auto mb-3" />
    <p className="text-[#718096] font-medium">{message}</p>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Documents() {
  const [tab,       setTab]      = useState(0);
  const [projects,  setProjects] = useState([]);
  const [bookings,  setBookings] = useState([]);
  const [customers, setCustomers]= useState([]);
  const [loading,   setLoading]  = useState(false);
  const [saving,    setSaving]   = useState(false);
  const [msg,       setMsg]      = useState({ text: '', type: '' });

  // Upload form
  const fileInputRef   = useRef(null);
  const [uploadFile,   setUploadFile]   = useState(null);
  const [uploadForm,   setUploadForm]   = useState({
    doc_type: 'kyc', doc_label: '',
    project_id: '', booking_id: '',
    customer_id: '', flat_id: '', expense_id: '',
  });
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Browse all
  const [allDocs,    setAllDocs]    = useState([]);
  const [fDocType,   setFDocType]   = useState('');
  const [fProject,   setFProject]   = useState('');
  const [search,     setSearch]     = useState('');

  // By booking
  const [selBooking,   setSelBooking]   = useState('');
  const [bookingDocs,  setBookingDocs]  = useState([]);

  // By customer
  const [selCustomer,  setSelCustomer]  = useState('');
  const [customerDocs, setCustomerDocs] = useState([]);

  // By project
  const [selProject,   setSelProject]   = useState('');
  const [projectDocs,  setProjectDocs]  = useState([]);

  // Rename modal
  const [renameModal, setRenameModal] = useState(null);
  const [newLabel,    setNewLabel]    = useState('');

  // Preview modal
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // ── Flash ──────────────────────────────────────────────────
  const flash = useCallback((text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
  }, []);

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

  // ── Load all docs ──────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fDocType)  params.doc_type   = fDocType;
      if (fProject)  params.project_id = fProject;
      const { data } = await getDocumentsApi(params);
      setAllDocs(data.data?.documents || []);
    } catch {
      flash('Failed to load documents', 'error');
    }
    setLoading(false);
  }, [fDocType, fProject, flash]);

  useEffect(() => { if (tab === 1) loadAll(); }, [tab, loadAll]);

  // ── Load by booking ────────────────────────────────────────
  const loadByBooking = async () => {
    if (!selBooking) return;
    setLoading(true);
    try {
      const { data } = await getDocsByBookingApi(selBooking);
      setBookingDocs(data.data?.documents || []);
    } catch { flash('Failed', 'error'); }
    setLoading(false);
  };

  // ── Load by customer ───────────────────────────────────────
  const loadByCustomer = async () => {
    if (!selCustomer) return;
    setLoading(true);
    try {
      const { data } = await getDocsByCustomerApi(selCustomer);
      setCustomerDocs(data.data?.documents || []);
    } catch { flash('Failed', 'error'); }
    setLoading(false);
  };

  // ── Load by project ────────────────────────────────────────
  const loadByProject = async () => {
    if (!selProject) return;
    setLoading(true);
    try {
      const { data } = await getDocsByProjectApi(selProject);
      setProjectDocs(data.data?.documents || []);
    } catch { flash('Failed', 'error'); }
    setLoading(false);
  };

  // ── Handle file selection (input + drag) ──────────────────
  const handleFileSelect = (file) => {
    if (!file) return;
    const allowedTypes = [
      'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!allowedTypes.includes(file.type)) {
      flash('File type not allowed. Use PDF, image, Word, or Excel.', 'error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      flash('File too large. Maximum size is 20 MB.', 'error');
      return;
    }
    setUploadFile(file);
    // Auto-set label to file name (without extension)
    if (!uploadForm.doc_label) {
      const name = file.name.replace(/\.[^.]+$/, '');
      setUploadForm((p) => ({ ...p, doc_label: name }));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  // ── Check at least one entity linked ──────────────────────
  const hasEntityLink = () =>
    uploadForm.project_id  || uploadForm.booking_id ||
    uploadForm.customer_id || uploadForm.flat_id    || uploadForm.expense_id;

  // ── Upload ─────────────────────────────────────────────────
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile)      return flash('Select a file first', 'error');
    if (!hasEntityLink()) return flash('Link to at least one entity (project, booking, or customer)', 'error');

    setSaving(true);
    setUploadProgress(0);

    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      Object.entries(uploadForm).forEach(([key, val]) => {
        if (val) fd.append(key, val);
      });

      await uploadDocumentApi(fd);

      flash('Document uploaded successfully');
      setUploadFile(null);
      setUploadProgress(0);
      setUploadForm({
        doc_type: 'kyc', doc_label: '',
        project_id: '', booking_id: '',
        customer_id: '', flat_id: '', expense_id: '',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      flash(err.response?.data?.message || 'Upload failed', 'error');
    }
    setSaving(false);
  };

  // ── Download ───────────────────────────────────────────────
  const handleDownload = async (doc) => {
    try {
      const response = await downloadDocumentApi(doc.id);
      const url      = window.URL.createObjectURL(new Blob([response.data]));
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      flash('Failed to download file', 'error');
    }
  };

  // ── Preview (images only) ──────────────────────────────────
  const handlePreview = async (doc) => {
    if (!doc.mime_type?.startsWith('image/')) return handleDownload(doc);
    try {
      const response = await downloadDocumentApi(doc.id);
      const url      = window.URL.createObjectURL(new Blob([response.data], { type: doc.mime_type }));
      setPreviewDoc(doc);
      setPreviewUrl(url);
    } catch {
      flash('Failed to preview', 'error');
    }
  };

  // ── Rename label ───────────────────────────────────────────
  const handleRename = (doc) => {
    setRenameModal(doc);
    setNewLabel(doc.doc_label || doc.file_name.replace(/\.[^.]+$/, ''));
  };

  const confirmRename = async () => {
    if (!newLabel.trim() || !renameModal) return;
    setSaving(true);
    try {
      await updateDocLabelApi(renameModal.id, newLabel.trim());
      flash('Label updated');
      setRenameModal(null);
      // Reload whichever tab is active
      if (tab === 1) loadAll();
      if (tab === 2 && selBooking)  loadByBooking();
      if (tab === 3 && selCustomer) loadByCustomer();
      if (tab === 4 && selProject)  loadByProject();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to rename', 'error');
    }
    setSaving(false);
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.doc_label || doc.file_name}"? This cannot be undone.`)) return;
    try {
      await deleteDocumentApi(doc.id);
      flash('Document deleted');
      if (tab === 1) loadAll();
      if (tab === 2 && selBooking)  loadByBooking();
      if (tab === 3 && selCustomer) loadByCustomer();
      if (tab === 4 && selProject)  loadByProject();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  // ── Filtered browse all ────────────────────────────────────
  const filteredDocs = allDocs.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.file_name?.toLowerCase().includes(q)    ||
      d.doc_label?.toLowerCase().includes(q)    ||
      d.customer_name?.toLowerCase().includes(q)||
      d.project_name?.toLowerCase().includes(q)
    );
  });

  // ── Doc list renderer ──────────────────────────────────────
  const renderDocList = (docs, showEntity = true) =>
    docs.length === 0 ? (
      <EmptyDocs />
    ) : (
      <div className="divide-y divide-[#F5EFE6]">
        {docs.map((d) => (
          <DocCard
            key={d.id}
            doc={d}
            showEntity={showEntity}
            onDownload={handleDownload}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ))}
      </div>
    );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#2d3748]">Documents</h2>
        <button
          onClick={() => setTab(0)}
          className="flex items-center gap-2 px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
        >
          <Upload size={15} /> Upload
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

      {/* ══ TAB 0: UPLOAD ════════════════════════════════════════════ */}
      {tab === 0 && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-6">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2 mb-6">
              <Upload size={16} className="text-[#6D94C5]" /> Upload Document
            </h3>

            <form onSubmit={handleUpload} className="space-y-5">

              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-[#6D94C5] bg-[#CBDCEB]/30'
                    : uploadFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-[#E8DFCA] bg-[#F5EFE6] hover:border-[#6D94C5]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_MIME}
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])}
                />

                {uploadFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <FileIcon mimeType={uploadFile.type} size={22} />
                    </div>
                    <p className="font-semibold text-green-700">{uploadFile.name}</p>
                    <p className="text-xs text-[#718096]">{fmtSize(uploadFile.size)}</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors mt-1"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-[#CBDCEB] rounded-xl flex items-center justify-center">
                      <Upload size={22} className="text-[#6D94C5]" />
                    </div>
                    <p className="font-semibold text-[#2d3748]">
                      Drop a file here or click to browse
                    </p>
                    <p className="text-xs text-[#718096]">PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, XLSX · Max 20 MB</p>
                  </div>
                )}
              </div>

              {/* Doc type + Label */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                    Document Type <span className="text-red-400">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DOC_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setUploadForm((p) => ({ ...p, doc_type: t }))}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                          uploadForm.doc_type === t
                            ? 'bg-[#6D94C5] text-white'
                            : `${TYPE_STYLE[t]} hover:opacity-80`
                        }`}
                      >
                        {t.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                    Document Label
                    <span className="ml-1 font-normal text-[#718096]">(human-readable name)</span>
                  </label>
                  <input
                    value={uploadForm.doc_label}
                    onChange={(e) => setUploadForm((p) => ({ ...p, doc_label: e.target.value }))}
                    placeholder="e.g. Aadhaar Card, Sale Agreement Jan 2024"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Entity links */}
              <div>
                <p className="text-xs font-bold text-[#718096] mb-2">
                  Link to Entity <span className="text-red-400">*</span>
                  <span className="ml-1 font-normal">(fill at least one)</span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#718096] mb-1.5">Project</label>
                    <select
                      value={uploadForm.project_id}
                      onChange={(e) => setUploadForm((p) => ({ ...p, project_id: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">— None —</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#718096] mb-1.5">Booking</label>
                    <select
                      value={uploadForm.booking_id}
                      onChange={(e) => setUploadForm((p) => ({ ...p, booking_id: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">— None —</option>
                      {bookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.customer_name} · Flat {b.flat_number}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#718096] mb-1.5">Customer</label>
                    <select
                      value={uploadForm.customer_id}
                      onChange={(e) => setUploadForm((p) => ({ ...p, customer_id: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">— None —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.phone ? ` · ${c.phone}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Entity link summary */}
              {hasEntityLink() && (
                <div className="bg-[#CBDCEB] rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
                  <CheckCircle size={14} className="text-green-600" />
                  <p className="text-xs text-[#2d3748] font-semibold">Linked to:</p>
                  {uploadForm.project_id  && <span className="text-xs bg-white px-2 py-0.5 rounded-lg text-[#6D94C5] font-medium">Project</span>}
                  {uploadForm.booking_id  && <span className="text-xs bg-white px-2 py-0.5 rounded-lg text-[#6D94C5] font-medium">Booking</span>}
                  {uploadForm.customer_id && <span className="text-xs bg-white px-2 py-0.5 rounded-lg text-[#6D94C5] font-medium">Customer</span>}
                </div>
              )}

              {/* Upload button */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving || !uploadFile}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
                >
                  <Upload size={14} />
                  {saving ? 'Uploading...' : 'Upload Document'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUploadFile(null);
                    setUploadForm({ doc_type: 'kyc', doc_label: '', project_id: '', booking_id: '', customer_id: '', flat_id: '', expense_id: '' });
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-6 py-2.5 bg-[#E8DFCA] text-[#4a5568] text-sm font-semibold rounded-xl hover:bg-[#d4cdb8] transition-all"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>

          {/* Allowed types info */}
          <div className="bg-[#CBDCEB] rounded-xl p-4 text-xs text-[#2d3748]">
            <p className="font-bold mb-2">📎 Document Type Guide</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                ['Agreement',       'Sale agreement, MOU'],
                ['KYC',             'Aadhaar, PAN, Passport'],
                ['Payment Receipt', 'Bank receipts, cheques'],
                ['Approval',        'RERA, BCC, municipal'],
                ['Plan',            'Floor plans, layouts'],
                ['NOC',             'Bank NOC, society NOC'],
                ['Legal',           'Title docs, opinions'],
                ['Marketing',       'Brochures, site photos'],
              ].map(([type, desc]) => (
                <div key={type} className="flex items-start gap-1.5">
                  <TypeBadge type={type.toLowerCase().replace(' ', '_')} />
                  <p className="text-[#718096] mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB 1: BROWSE ALL ════════════════════════════════════════ */}
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
                  placeholder="File name, label, customer, project..."
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
              <button onClick={loadAll} disabled={loading}
                className="px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all">
                <Filter size={13} />
              </button>
            </div>

            {/* Doc type chips */}
            <div className="flex gap-2 flex-wrap">
              {['', ...DOC_TYPES].map((t) => (
                <button
                  key={t}
                  onClick={() => setFDocType(t)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                    fDocType === t
                      ? 'bg-[#6D94C5] text-white'
                      : t
                      ? `${TYPE_STYLE[t]} opacity-80 hover:opacity-100`
                      : 'bg-[#F5EFE6] text-[#718096] hover:bg-[#CBDCEB]'
                  }`}
                >
                  {t ? t.replace('_', ' ') : 'All Types'}
                </button>
              ))}
            </div>
          </div>

          {/* Count strip */}
          {filteredDocs.length > 0 && (
            <div className="flex items-center justify-between bg-[#F5EFE6] rounded-xl px-4 py-2.5">
              <p className="text-xs font-semibold text-[#718096]">{filteredDocs.length} documents</p>
              <p className="text-xs text-[#718096]">
                {fmtSize(filteredDocs.reduce((s, d) => s + (d.file_size || 0), 0))} total
              </p>
            </div>
          )}

          {loading ? (
            <Loader />
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
              {renderDocList(filteredDocs)}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 2: BY BOOKING ════════════════════════════════════════ */}
      {tab === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-5 flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Select Booking</label>
              <select
                value={selBooking}
                onChange={(e) => setSelBooking(e.target.value)}
                className={inputCls}
              >
                <option value="">— Choose a booking —</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.customer_name} · {b.project_name} · Flat {b.flat_number}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={loadByBooking}
              disabled={!selBooking || loading}
              className="px-5 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
            >
              Load
            </button>
          </div>

          {loading ? <Loader /> : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
              {selBooking
                ? renderDocList(bookingDocs, false)
                : <EmptyDocs message="Select a booking to view its documents" />
              }
            </div>
          )}

          {/* Quick upload link */}
          {selBooking && (
            <div className="bg-[#CBDCEB] rounded-xl p-4 flex items-center justify-between">
              <p className="text-xs text-[#2d3748] font-semibold">Add a document to this booking</p>
              <button
                onClick={() => {
                  const b = bookings.find((bk) => String(bk.id) === selBooking);
                  setUploadForm((p) => ({ ...p, booking_id: selBooking, customer_id: String(b?.customer_id || '') }));
                  setTab(0);
                }}
                className="text-xs px-3 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all"
              >
                Upload Document
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 3: BY CUSTOMER ═══════════════════════════════════════ */}
      {tab === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-5 flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Select Customer</label>
              <select
                value={selCustomer}
                onChange={(e) => setSelCustomer(e.target.value)}
                className={inputCls}
              >
                <option value="">— Choose a customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.phone ? ` · ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={loadByCustomer}
              disabled={!selCustomer || loading}
              className="px-5 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
            >
              Load
            </button>
          </div>

          {/* KYC type summary */}
          {customerDocs.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {DOC_TYPES.map((t) => {
                const count = customerDocs.filter((d) => d.doc_type === t).length;
                if (!count) return null;
                return (
                  <div key={t} className={`text-xs px-3 py-1.5 rounded-full font-semibold ${TYPE_STYLE[t]}`}>
                    {t.replace('_', ' ')}: {count}
                  </div>
                );
              })}
            </div>
          )}

          {loading ? <Loader /> : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
              {selCustomer
                ? renderDocList(customerDocs, false)
                : <EmptyDocs message="Select a customer to view their documents" />
              }
            </div>
          )}

          {selCustomer && (
            <div className="bg-[#CBDCEB] rounded-xl p-4 flex items-center justify-between">
              <p className="text-xs text-[#2d3748] font-semibold">Upload KYC or other document for this customer</p>
              <button
                onClick={() => {
                  setUploadForm((p) => ({ ...p, customer_id: selCustomer, doc_type: 'kyc' }));
                  setTab(0);
                }}
                className="text-xs px-3 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all"
              >
                Upload KYC
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 4: BY PROJECT ════════════════════════════════════════ */}
      {tab === 4 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-5 flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Select Project</label>
              <select
                value={selProject}
                onChange={(e) => setSelProject(e.target.value)}
                className={inputCls}
              >
                <option value="">— Choose a project —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button
              onClick={loadByProject}
              disabled={!selProject || loading}
              className="px-5 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
            >
              Load
            </button>
          </div>

          {/* Type breakdown pills */}
          {projectDocs.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {DOC_TYPES.map((t) => {
                const count = projectDocs.filter((d) => d.doc_type === t).length;
                if (!count) return null;
                return (
                  <div key={t} className={`text-xs px-3 py-1.5 rounded-full font-semibold ${TYPE_STYLE[t]}`}>
                    {t.replace('_', ' ')}: {count}
                  </div>
                );
              })}
            </div>
          )}

          {loading ? <Loader /> : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
              {selProject
                ? renderDocList(projectDocs, false)
                : <EmptyDocs message="Select a project to view its documents" />
              }
            </div>
          )}

          {selProject && (
            <div className="bg-[#CBDCEB] rounded-xl p-4 flex items-center justify-between">
              <p className="text-xs text-[#2d3748] font-semibold">Upload approvals, plans, or marketing for this project</p>
              <button
                onClick={() => {
                  setUploadForm((p) => ({ ...p, project_id: selProject, doc_type: 'approval' }));
                  setTab(0);
                }}
                className="text-xs px-3 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all"
              >
                Upload
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ RENAME MODAL ═════════════════════════════════════════════ */}
      {renameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRenameModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <p className="font-bold text-[#2d3748] mb-1">Rename Document</p>
            <p className="text-xs text-[#718096] mb-4 truncate">{renameModal.file_name}</p>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
              placeholder="Enter document label"
              autoFocus
              className={inputCls}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={confirmRename}
                disabled={saving || !newLabel.trim()}
                className="flex-1 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
              >
                {saving ? 'Saving...' : 'Save Label'}
              </button>
              <button
                onClick={() => setRenameModal(null)}
                className="flex-1 py-2.5 bg-[#E8DFCA] text-[#4a5568] text-sm font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ IMAGE PREVIEW MODAL ══════════════════════════════════════ */}
      {previewDoc && previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => { setPreviewDoc(null); window.URL.revokeObjectURL(previewUrl); setPreviewUrl(''); }}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-white rounded-t-2xl px-5 py-3">
              <p className="font-semibold text-[#2d3748] truncate">{previewDoc.doc_label || previewDoc.file_name}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#6D94C5] text-white font-semibold rounded-lg hover:bg-[#5a7eb0] transition-all"
                >
                  <Download size={12} /> Download
                </button>
                <button
                  onClick={() => { setPreviewDoc(null); window.URL.revokeObjectURL(previewUrl); setPreviewUrl(''); }}
                  className="p-1.5 text-[#718096] hover:text-red-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <img
              src={previewUrl}
              alt={previewDoc.doc_label || previewDoc.file_name}
              className="w-full rounded-b-2xl max-h-[75vh] object-contain bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}