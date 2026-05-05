import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Home, Layers, Search, Filter,
  Pencil, Trash2, X, UploadCloud,
  CheckCircle, AlertCircle, Lock, BarChart2,
} from 'lucide-react';
import {
  getFlatsApi, getFlatStatsApi,
  createFlatApi, bulkCreateFlatsApi,
  updateFlatApi, updateFlatStatusApi,
  deleteFlatApi,
} from '../../services/repository/flatRepository';
import { getProjectsApi } from '../../services/repository/projectRepository';
import Loader from '../common/Loader';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS         = ['Inventory', 'Add Flat', 'Bulk Add', 'Stats'];
const STATUSES     = ['available', 'blocked', 'sold'];
const CONFIGS      = ['Studio', '1 BHK', '1.5 BHK', '2 BHK', '2.5 BHK', '3 BHK', '4 BHK', 'Penthouse', 'Shop', 'Office'];
const AREA_UNITS   = ['sqft', 'sqm'];
const FACING_OPTS  = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];
const PARKING_OPTS = ['covered', 'open', 'none'];

const STATUS_STYLE = {
  available: { cls: 'bg-green-100 text-green-700',  icon: <CheckCircle size={11} />, label: 'Available' },
  blocked:   { cls: 'bg-orange-100 text-orange-600', icon: <Lock size={11} />,        label: 'Blocked'   },
  sold:      { cls: 'bg-red-100 text-red-600',       icon: <AlertCircle size={11} />, label: 'Sold'      },
};

const inr = (v) =>
  v ? `₹${Number(v).toLocaleString('en-IN')}` : '—';

const inputCls =
  'w-full px-4 py-2.5 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] transition-colors';

const EMPTY_FORM = {
  project_id: '', flat_number: '', floor: '',
  configuration: '2 BHK', carpet_area: '', saleable_area: '',
  area_unit: 'sqft', base_price: '', total_price: '',
  facing: '', parking: 'covered', remarks: '',
};

// ─── Stat pill ────────────────────────────────────────────────────────────────
const Pill = ({ label, value, color = 'text-[#6D94C5]' }) => (
  <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 text-center">
    <p className="text-xs text-[#718096] font-medium mb-1">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
  </div>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.available;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
};

// ─── Status Quick-Change Dropdown ─────────────────────────────────────────────
const StatusDropdown = ({ flatId, current, onChanged, onFlash }) => {
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = async (status) => {
    if (status === current) { setOpen(false); return; }
    setSaving(true);
    try {
      await updateFlatStatusApi(flatId, status);
      onChanged();
      onFlash(`Flat marked as ${status}`);
    } catch (err) {
      onFlash(err.response?.data?.message || 'Failed to update status', 'error');
    }
    setSaving(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        className="flex items-center gap-1"
      >
        <StatusBadge status={current} />
      </button>
      {open && (
        <div className="absolute z-20 top-8 left-0 bg-white border border-[#E8DFCA] rounded-xl shadow-lg overflow-hidden w-32">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => handleChange(s)}
              className={`w-full text-left px-3 py-2 text-xs font-semibold capitalize hover:bg-[#F5EFE6] transition-colors ${
                s === current ? 'text-[#6D94C5]' : 'text-[#2d3748]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Flats() {
  const [tab,      setTab]      = useState(0);
  const [flats,    setFlats]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState({ text: '', type: '' });

  // Filters
  const [fProject, setFProject] = useState('');
  const [fStatus,  setFStatus]  = useState('');
  const [fConfig,  setFConfig]  = useState('');
  const [fFloor,   setFFloor]   = useState('');
  const [search,   setSearch]   = useState('');

  // Add / Edit form
  const [form,   setForm]   = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  // Bulk state
  const [bulkProject, setBulkProject] = useState('');
  const [bulkRows,    setBulkRows]    = useState(
    Array.from({ length: 5 }, () => ({ ...EMPTY_FORM, project_id: '' }))
  );
  const [bulkResult, setBulkResult] = useState(null);

  // Detail slide-over
  const [detail, setDetail] = useState(null);

  // ── Flash ──────────────────────────────────────────────────
  const flash = useCallback((text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
  }, []);

  // ── Load flats ─────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (fProject) params.project_id   = fProject;
      if (fStatus)  params.status        = fStatus;
      if (fConfig)  params.configuration = fConfig;
      if (fFloor)   params.floor         = fFloor;

      const [fRes, pRes] = await Promise.all([
        getFlatsApi(params),
        getProjectsApi(),
      ]);
      setFlats(fRes.data.data?.flats    || []);
      setProjects(pRes.data.data?.projects || []);
    } catch {
      flash('Failed to load inventory', 'error');
    }
    setLoading(false);
  }, [fProject, fStatus, fConfig, fFloor, flash]);

  // ── Load stats ─────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const params = fProject ? { project_id: fProject } : {};
      const { data } = await getFlatStatsApi(params);
      setStats(data.data || null);
    } catch {/* silent */}
  }, [fProject]);

  useEffect(() => { load(); loadStats(); }, [load, loadStats]);

  // ── Computed filtered list ─────────────────────────────────
  const displayed = flats.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.flat_number?.toLowerCase().includes(q) ||
      f.buyer_name?.toLowerCase().includes(q)  ||
      f.configuration?.toLowerCase().includes(q)
    );
  });

  // ── Form handlers ──────────────────────────────────────────
  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const resetForm = () => { setForm(EMPTY_FORM); setEditId(null); };

  const handleEditClick = (f) => {
    setForm({
      project_id:    String(f.project_id)   || '',
      flat_number:   f.flat_number           || '',
      floor:         String(f.floor)         || '',
      configuration: f.configuration         || '2 BHK',
      carpet_area:   f.carpet_area           || '',
      saleable_area: f.saleable_area         || '',
      area_unit:     f.area_unit             || 'sqft',
      base_price:    f.base_price            || '',
      total_price:   f.total_price           || '',
      facing:        f.facing                || '',
      parking:       f.parking               || 'covered',
      remarks:       f.remarks               || '',
    });
    setEditId(f.id);
    setDetail(null);
    setTab(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Auto-calc total price ──────────────────────────────────
  const handleAreaOrPrice = (e) => {
    const { name, value } = e.target;
    setForm((p) => {
      const updated = { ...p, [name]: value };
      if (name === 'saleable_area' || name === 'base_price') {
        const area  = parseFloat(name === 'saleable_area' ? value : p.saleable_area) || 0;
        const price = parseFloat(name === 'base_price'    ? value : p.base_price)    || 0;
        if (area && price) updated.total_price = (area * price).toFixed(0);
      }
      return updated;
    });
  };

  // ── Submit create / update ─────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.project_id) return flash('Select a project', 'error');
    if (!form.flat_number.trim()) return flash('Flat number is required', 'error');
    if (!form.floor.toString().trim()) return flash('Floor is required', 'error');

    setSaving(true);
    try {
      const payload = {
        ...form,
        floor:         Number(form.floor),
        carpet_area:   form.carpet_area   ? Number(form.carpet_area)   : null,
        saleable_area: form.saleable_area ? Number(form.saleable_area) : null,
        base_price:    form.base_price    ? Number(form.base_price)    : null,
        total_price:   form.total_price   ? Number(form.total_price)   : null,
        facing:        form.facing        || null,
      };

      if (editId) {
        await updateFlatApi(editId, payload);
        flash('Flat updated successfully');
      } else {
        await createFlatApi(payload);
        flash('Flat added to inventory');
      }
      resetForm();
      load();
      loadStats();
      setTab(0);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to save flat', 'error');
    }
    setSaving(false);
  };

  // ── Delete flat ────────────────────────────────────────────
  const handleDelete = async (id, num) => {
    if (!window.confirm(`Delete Flat ${num}? This cannot be undone.`)) return;
    try {
      await deleteFlatApi(id);
      flash('Flat deleted');
      load();
      loadStats();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to delete flat', 'error');
    }
  };

  // ── Bulk row change ────────────────────────────────────────
  const handleBulkChange = (idx, field, value) => {
    setBulkRows((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // Auto-calc total price inline
      if (field === 'saleable_area' || field === 'base_price') {
        const area  = parseFloat(field === 'saleable_area' ? value : updated[idx].saleable_area) || 0;
        const price = parseFloat(field === 'base_price'    ? value : updated[idx].base_price)    || 0;
        if (area && price) updated[idx].total_price = (area * price).toFixed(0);
      }
      return updated;
    });
  };

  const addBulkRow = () =>
    setBulkRows((p) => [...p, { ...EMPTY_FORM, project_id: bulkProject }]);

  const removeBulkRow = (idx) =>
    setBulkRows((p) => p.filter((_, i) => i !== idx));

  // ── Bulk submit ────────────────────────────────────────────
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!bulkProject) return flash('Select a project for bulk add', 'error');
    const filled = bulkRows.filter((r) => r.flat_number && r.floor !== '');
    if (!filled.length) return flash('Fill at least one flat row', 'error');

    setSaving(true);
    setBulkResult(null);
    try {
      const flats = filled.map((r) => ({
        ...r,
        project_id:    Number(bulkProject),
        floor:         Number(r.floor),
        carpet_area:   r.carpet_area   ? Number(r.carpet_area)   : null,
        saleable_area: r.saleable_area ? Number(r.saleable_area) : null,
        base_price:    r.base_price    ? Number(r.base_price)    : null,
        total_price:   r.total_price   ? Number(r.total_price)   : null,
        facing:        r.facing        || null,
      }));
      const { data } = await bulkCreateFlatsApi({ flats });
      const result = data.data;
      setBulkResult(result);
      flash(`${result.created} flats added${result.skipped ? `, ${result.skipped} skipped (duplicate)` : ''}`);
      load();
      loadStats();
    } catch (err) {
      flash(err.response?.data?.message || 'Bulk add failed', 'error');
    }
    setSaving(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#2d3748]">Flat Inventory</h2>
        <button
          onClick={() => { resetForm(); setTab(1); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
        >
          <Plus size={15} /> Add Flat
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
      <div className="flex gap-2 bg-[#E8DFCA] p-1 rounded-xl w-fit flex-wrap">
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

      {/* ══ TAB 0: INVENTORY ═════════════════════════════════════════ */}
      {tab === 0 && (
        <div className="space-y-4">

          {/* Quick stat pills */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Pill label="Total Flats"     value={stats.total_flats  || 0} />
              <Pill label="Available"       value={stats.available    || 0} color="text-green-600" />
              <Pill label="Blocked"         value={stats.blocked      || 0} color="text-orange-500" />
              <Pill label="Sold"            value={stats.sold         || 0} color="text-red-500" />
            </div>
          )}

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-[#718096]" />

              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718096]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Flat number / buyer / config..."
                  className="w-full pl-8 pr-4 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-[#F5EFE6] focus:outline-none focus:border-[#6D94C5]"
                />
              </div>

              {/* Project filter */}
              <select
                value={fProject}
                onChange={(e) => setFProject(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] min-w-[140px]"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {/* Config filter */}
              <select
                value={fConfig}
                onChange={(e) => setFConfig(e.target.value)}
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]"
              >
                <option value="">All Types</option>
                {CONFIGS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Floor filter */}
              <input
                type="number"
                value={fFloor}
                onChange={(e) => setFFloor(e.target.value)}
                placeholder="Floor"
                className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] w-24"
              />

              {/* Clear */}
              {(fProject || fStatus || fConfig || fFloor || search) && (
                <button
                  onClick={() => { setFProject(''); setFStatus(''); setFConfig(''); setFFloor(''); setSearch(''); }}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>

            {/* Status filter chips */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {['', ...STATUSES].map((s) => (
                <button
                  key={s}
                  onClick={() => setFStatus(s)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                    fStatus === s
                      ? 'bg-[#6D94C5] text-white'
                      : 'bg-[#F5EFE6] text-[#718096] hover:border-[#6D94C5] border border-transparent'
                  }`}
                >
                  {s || 'All Status'}
                </button>
              ))}
            </div>
          </div>

          {/* Flat table */}
          {loading ? (
            <Loader />
          ) : displayed.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <Home size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No flats found</p>
              <p className="text-xs text-[#718096] mt-1">Try adjusting your filters or add flats.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E8DFCA] flex items-center justify-between bg-[#F5EFE6]">
                <p className="text-xs font-bold text-[#718096]">{displayed.length} flats</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F5EFE6]">
                    <tr>
                      {['Flat No.', 'Floor', 'Type', 'Carpet', 'Saleable', 'Price', 'Status', 'Buyer', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#718096] whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5EFE6]">
                    {displayed.map((f) => (
                      <tr key={f.id} className="hover:bg-[#F5EFE6] transition-colors">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setDetail(f)}
                            className="font-bold text-[#6D94C5] hover:underline"
                          >
                            {f.flat_number}
                          </button>
                          {f.project_name && (
                            <p className="text-xs text-[#718096] mt-0.5 truncate max-w-[120px]">{f.project_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#2d3748] font-medium">{f.floor}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-[#CBDCEB] text-[#2d3748] px-2 py-0.5 rounded-lg font-medium whitespace-nowrap">
                            {f.configuration || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#718096] whitespace-nowrap">
                          {f.carpet_area ? `${Number(f.carpet_area).toLocaleString('en-IN')} ${f.area_unit}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#718096] whitespace-nowrap">
                          {f.saleable_area ? `${Number(f.saleable_area).toLocaleString('en-IN')} ${f.area_unit}` : '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#2d3748] whitespace-nowrap">
                          {inr(f.total_price)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusDropdown
                            flatId={f.id}
                            current={f.status}
                            onChanged={load}
                            onFlash={flash}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-[#718096]">
                          {f.buyer_name ? (
                            <div>
                              <p className="font-semibold text-[#2d3748]">{f.buyer_name}</p>
                              <p>{f.buyer_phone}</p>
                            </div>
                          ) : (
                            <span className="text-[#CBDCEB]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditClick(f)}
                              className="p-1.5 text-[#6D94C5] hover:bg-[#CBDCEB] rounded-lg transition-all"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(f.id, f.flat_number)}
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={13} />
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

      {/* ══ TAB 1: ADD / EDIT FLAT ═══════════════════════════════════ */}
      {tab === 1 && (
        <div className="bg-white rounded-2xl border border-[#E8DFCA] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2">
              <Home size={16} className="text-[#6D94C5]" />
              {editId ? 'Edit Flat' : 'Add Flat to Inventory'}
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

            {/* Row 1 — Project + Flat Number + Floor */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Project <span className="text-red-400">*</span>
                </label>
                <select name="project_id" value={form.project_id} onChange={handleChange} required className={inputCls}>
                  <option value="">— Select Project —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Flat Number <span className="text-red-400">*</span>
                </label>
                <input
                  name="flat_number"
                  value={form.flat_number}
                  onChange={handleChange}
                  placeholder="e.g. A-101"
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Floor <span className="text-red-400">*</span>
                </label>
                <input
                  name="floor"
                  type="number"
                  value={form.floor}
                  onChange={handleChange}
                  placeholder="e.g. 3"
                  required
                  className={inputCls}
                />
              </div>
            </div>

            {/* Row 2 — Config + Facing + Parking */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Configuration</label>
                <select name="configuration" value={form.configuration} onChange={handleChange} className={inputCls}>
                  {CONFIGS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Facing</label>
                <select name="facing" value={form.facing} onChange={handleChange} className={inputCls}>
                  <option value="">— Select —</option>
                  {FACING_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Parking</label>
                <select name="parking" value={form.parking} onChange={handleChange} className={inputCls}>
                  {PARKING_OPTS.map((p) => (
                    <option key={p} value={p} className="capitalize">{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3 — Areas + Unit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Carpet Area</label>
                <input
                  name="carpet_area"
                  type="number"
                  value={form.carpet_area}
                  onChange={handleChange}
                  placeholder="e.g. 650"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Saleable Area</label>
                <input
                  name="saleable_area"
                  type="number"
                  value={form.saleable_area}
                  onChange={handleAreaOrPrice}
                  placeholder="e.g. 750"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Area Unit</label>
                <select name="area_unit" value={form.area_unit} onChange={handleChange} className={inputCls}>
                  {AREA_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Row 4 — Pricing */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Base Price (per {form.area_unit})</label>
                <input
                  name="base_price"
                  type="number"
                  value={form.base_price}
                  onChange={handleAreaOrPrice}
                  placeholder="e.g. 7500"
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Total Price
                  <span className="ml-1 font-normal text-[#CBDCEB]">(auto-calculated from saleable area × base price)</span>
                </label>
                <input
                  name="total_price"
                  type="number"
                  value={form.total_price}
                  onChange={handleChange}
                  placeholder="Auto-calculated or enter manually"
                  className={`${inputCls} bg-[#F5EFE6]`}
                />
              </div>
            </div>

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

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
              >
                {saving ? 'Saving...' : editId ? 'Update Flat' : 'Add Flat'}
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

      {/* ══ TAB 2: BULK ADD ══════════════════════════════════════════ */}
      {tab === 2 && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-6">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2 mb-5">
              <UploadCloud size={16} className="text-[#6D94C5]" />
              Bulk Add Flats
            </h3>

            {/* Project selector for bulk */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                Project <span className="text-red-400">*</span>
              </label>
              <select
                value={bulkProject}
                onChange={(e) => { setBulkProject(e.target.value); setBulkResult(null); }}
                className={`${inputCls} max-w-xs`}
              >
                <option value="">— Select Project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Bulk result banner */}
            {bulkResult && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 font-medium">
                ✅ {bulkResult.created} flats added
                {bulkResult.skipped > 0 && ` · ${bulkResult.skipped} skipped (duplicate flat numbers)`}
              </div>
            )}

            {/* Scrollable bulk table */}
            <form onSubmit={handleBulkSubmit}>
              <div className="overflow-x-auto rounded-xl border border-[#E8DFCA]">
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="bg-[#F5EFE6]">
                    <tr>
                      {['#', 'Flat No.*', 'Floor*', 'Config', 'Carpet', 'Saleable', 'Unit', 'Base Price', 'Total Price', 'Facing', 'Parking', ''].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-bold text-[#718096] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5EFE6]">
                    {bulkRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#F5EFE6]">
                        <td className="px-3 py-2 text-[#718096] font-semibold">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <input
                            value={row.flat_number}
                            onChange={(e) => handleBulkChange(idx, 'flat_number', e.target.value)}
                            placeholder="A-101"
                            className="w-20 px-2 py-1.5 border border-[#E8DFCA] rounded-lg focus:outline-none focus:border-[#6D94C5]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={row.floor}
                            onChange={(e) => handleBulkChange(idx, 'floor', e.target.value)}
                            placeholder="3"
                            className="w-14 px-2 py-1.5 border border-[#E8DFCA] rounded-lg focus:outline-none focus:border-[#6D94C5]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.configuration}
                            onChange={(e) => handleBulkChange(idx, 'configuration', e.target.value)}
                            className="px-2 py-1.5 border border-[#E8DFCA] rounded-lg focus:outline-none focus:border-[#6D94C5]"
                          >
                            {CONFIGS.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={row.carpet_area} onChange={(e) => handleBulkChange(idx, 'carpet_area', e.target.value)} placeholder="650" className="w-20 px-2 py-1.5 border border-[#E8DFCA] rounded-lg focus:outline-none focus:border-[#6D94C5]" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={row.saleable_area} onChange={(e) => handleBulkChange(idx, 'saleable_area', e.target.value)} placeholder="750" className="w-20 px-2 py-1.5 border border-[#E8DFCA] rounded-lg focus:outline-none focus:border-[#6D94C5]" />
                        </td>
                        <td className="px-3 py-2">
                          <select value={row.area_unit} onChange={(e) => handleBulkChange(idx, 'area_unit', e.target.value)} className="px-2 py-1.5 border border-[#E8DFCA] rounded-lg focus:outline-none focus:border-[#6D94C5]">
                            {AREA_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={row.base_price} onChange={(e) => handleBulkChange(idx, 'base_price', e.target.value)} placeholder="7500" className="w-20 px-2 py-1.5 border border-[#E8DFCA] rounded-lg focus:outline-none focus:border-[#6D94C5]" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" value={row.total_price} onChange={(e) => handleBulkChange(idx, 'total_price', e.target.value)} placeholder="Auto" className="w-24 px-2 py-1.5 bg-[#F5EFE6] border border-[#E8DFCA] rounded-lg focus:outline-none focus:border-[#6D94C5]" />
                        </td>
                        <td className="px-3 py-2">
                          <select value={row.facing} onChange={(e) => handleBulkChange(idx, 'facing', e.target.value)} className="px-2 py-1.5 border border-[#E8DFCA] rounded-lg focus:outline-none focus:border-[#6D94C5]">
                            <option value="">—</option>
                            {FACING_OPTS.map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={row.parking} onChange={(e) => handleBulkChange(idx, 'parking', e.target.value)} className="px-2 py-1.5 border border-[#E8DFCA] rounded-lg focus:outline-none focus:border-[#6D94C5]">
                            {PARKING_OPTS.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {bulkRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBulkRow(idx)}
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bulk actions */}
              <div className="flex gap-3 mt-4 items-center">
                <button
                  type="button"
                  onClick={addBulkRow}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#E8DFCA] text-[#4a5568] text-sm font-semibold rounded-xl hover:bg-[#d4cdb8] transition-all"
                >
                  <Plus size={13} /> Add Row
                </button>
                <button
                  type="submit"
                  disabled={saving || !bulkProject}
                  className="flex items-center gap-1.5 px-6 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
                >
                  <UploadCloud size={13} />
                  {saving ? 'Uploading...' : 'Bulk Add Flats'}
                </button>
                <span className="text-xs text-[#718096]">
                  {bulkRows.filter((r) => r.flat_number).length} of {bulkRows.length} rows filled
                </span>
              </div>
            </form>

            {/* Note */}
            <div className="mt-5 bg-[#CBDCEB] rounded-xl p-4 text-xs text-[#2d3748]">
              <p className="font-bold mb-1">💡 Bulk Add Notes</p>
              <ul className="space-y-1 list-disc list-inside text-[#4a5568]">
                <li>Flat Number and Floor are required for each row.</li>
                <li>Duplicate flat numbers within the same project are skipped automatically.</li>
                <li>Total Price auto-calculates when you fill Saleable Area and Base Price.</li>
                <li>All flats will be added with status: <strong>Available</strong>.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB 3: STATS ═════════════════════════════════════════════ */}
      {tab === 3 && (
        <div className="space-y-5">

          {/* Project filter for stats */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-4 flex items-center gap-3">
            <BarChart2 size={15} className="text-[#6D94C5]" />
            <select
              value={fProject}
              onChange={(e) => setFProject(e.target.value)}
              className="px-3 py-2 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5]"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <span className="text-xs text-[#718096]">
              {fProject ? projects.find((p) => String(p.id) === fProject)?.name : 'Showing all projects'}
            </span>
          </div>

          {stats ? (
            <>
              {/* Main totals */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Pill label="Total Flats"         value={stats.total_flats  || 0} />
                <Pill label="Available"           value={stats.available    || 0} color="text-green-600" />
                <Pill label="Blocked"             value={stats.blocked      || 0} color="text-orange-500" />
                <Pill label="Sold"                value={stats.sold         || 0} color="text-red-500" />
              </div>

              {/* Value cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  ['Total Inventory Value', stats.total_inventory_value, 'text-[#6D94C5]'],
                  ['Sold Value',            stats.sold_value,            'text-red-500'],
                  ['Available Value',       stats.available_value,       'text-green-600'],
                ].map(([label, val, color]) => (
                  <div key={label} className="bg-white rounded-2xl border border-[#E8DFCA] p-5">
                    <p className="text-xs text-[#718096] font-medium mb-1">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{inr(val)}</p>
                  </div>
                ))}
              </div>

              {/* By configuration */}
              {stats.by_configuration && (
                <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E8DFCA] bg-[#F5EFE6]">
                    <p className="font-bold text-[#2d3748] text-sm">Breakdown by Configuration</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F5EFE6]">
                        <tr>
                          {['Configuration', 'Total', 'Available', 'Blocked', 'Sold', 'Fill Rate'].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-bold text-[#718096]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5EFE6]">
                        {stats.by_configuration.map((cfg) => {
                          const fillRate = cfg.total
                            ? Math.round(((Number(cfg.sold) + Number(cfg.blocked)) / Number(cfg.total)) * 100)
                            : 0;
                          return (
                            <tr key={cfg.configuration} className="hover:bg-[#F5EFE6] transition-colors">
                              <td className="px-5 py-3">
                                <span className="text-xs bg-[#CBDCEB] text-[#2d3748] px-3 py-1 rounded-lg font-semibold">
                                  {cfg.configuration}
                                </span>
                              </td>
                              <td className="px-5 py-3 font-bold text-[#2d3748]">{cfg.total}</td>
                              <td className="px-5 py-3 text-green-600 font-semibold">{cfg.available}</td>
                              <td className="px-5 py-3 text-orange-500 font-semibold">{cfg.blocked}</td>
                              <td className="px-5 py-3 text-red-500 font-semibold">{cfg.sold}</td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-[#E8DFCA] rounded-full h-2 overflow-hidden">
                                    <div
                                      className="h-2 bg-[#6D94C5] rounded-full transition-all"
                                      style={{ width: `${fillRate}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-semibold text-[#718096] w-8">{fillRate}%</span>
                                </div>
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
          ) : (
            <div className="text-center py-12 text-[#718096]">
              <BarChart2 size={36} className="mx-auto mb-3 text-[#CBDCEB]" />
              <p>No stats available. Add flats first.</p>
            </div>
          )}
        </div>
      )}

      {/* ══ DETAIL SLIDE-OVER ════════════════════════════════════════ */}
      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setDetail(null)} />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="bg-[#6D94C5] px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">Flat {detail.flat_number}</p>
                  <p className="text-[#CBDCEB] text-sm mt-0.5">{detail.project_name}</p>
                </div>
                <button
                  onClick={() => setDetail(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-3">
                <StatusBadge status={detail.status} />
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Floor',         detail.floor],
                  ['Configuration', detail.configuration],
                  ['Carpet Area',   detail.carpet_area ? `${Number(detail.carpet_area).toLocaleString('en-IN')} ${detail.area_unit}` : '—'],
                  ['Saleable Area', detail.saleable_area ? `${Number(detail.saleable_area).toLocaleString('en-IN')} ${detail.area_unit}` : '—'],
                  ['Base Price',    detail.base_price   ? `${inr(detail.base_price)} / ${detail.area_unit}` : '—'],
                  ['Total Price',   inr(detail.total_price)],
                  ['Facing',        detail.facing   || '—'],
                  ['Parking',       detail.parking  || '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-[#718096] mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-[#2d3748]">{value}</p>
                  </div>
                ))}
              </div>

              {/* Buyer info */}
              {detail.buyer_name && (
                <div className="bg-[#F5EFE6] rounded-xl p-4">
                  <p className="text-xs font-bold text-[#718096] mb-2">Buyer Details</p>
                  <p className="font-bold text-[#2d3748]">{detail.buyer_name}</p>
                  <p className="text-sm text-[#718096]">{detail.buyer_phone}</p>
                  {detail.buyer_email && <p className="text-sm text-[#718096]">{detail.buyer_email}</p>}
                  {detail.agreement_value && (
                    <p className="text-sm font-semibold text-[#6D94C5] mt-1">
                      Agreement: {inr(detail.final_value || detail.agreement_value)}
                    </p>
                  )}
                </div>
              )}

              {/* Remarks */}
              {detail.remarks && (
                <div>
                  <p className="text-xs text-[#718096] mb-1">Remarks</p>
                  <p className="text-sm text-[#4a5568]">{detail.remarks}</p>
                </div>
              )}

              {/* Status change */}
              <div>
                <p className="text-xs font-bold text-[#718096] mb-2">Change Status</p>
                <div className="flex gap-2">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={async () => {
                        try {
                          await updateFlatStatusApi(detail.id, s);
                          flash(`Flat ${detail.flat_number} marked as ${s}`);
                          setDetail(null);
                          load();
                          loadStats();
                        } catch (err) {
                          flash(err.response?.data?.message || 'Failed', 'error');
                        }
                      }}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl capitalize transition-all ${
                        detail.status === s
                          ? 'bg-[#6D94C5] text-white'
                          : 'bg-[#E8DFCA] text-[#4a5568] hover:bg-[#CBDCEB]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleEditClick(detail)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
                >
                  <Pencil size={13} /> Edit Flat
                </button>
                <button
                  onClick={() => { handleDelete(detail.id, detail.flat_number); setDetail(null); }}
                  className="px-4 py-2.5 bg-red-50 text-red-500 text-sm font-semibold rounded-xl hover:bg-red-100 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}