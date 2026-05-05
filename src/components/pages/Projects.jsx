import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Building2, MapPin, Layers, Home,
  ChevronDown, ChevronUp, Pencil, Trash2,
  CheckCircle, X, Settings,
} from 'lucide-react';
import {
  getProjectsApi, getProjectSummaryApi,
  createProjectApi, updateProjectApi, deleteProjectApi,
  getConfigsApi, addConfigApi, removeConfigApi,
} from '../../services/repository/projectRepository';
import Loader from '../common/Loader';

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS       = ['All Projects', 'Add Project', 'Configurations'];
const STATUSES   = ['upcoming', 'active', 'completed', 'on_hold'];
const AREA_UNITS = ['sqft', 'sqm', 'acre', 'gunta'];
const CONFIGS    = ['Studio', '1 BHK', '1.5 BHK', '2 BHK', '2.5 BHK', '3 BHK', '4 BHK', 'Penthouse', 'Shop', 'Office'];

const STATUS_STYLE = {
  active:    'bg-green-100 text-green-700',
  upcoming:  'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
  on_hold:   'bg-orange-100 text-orange-600',
};

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

const inputCls =
  'w-full px-4 py-2.5 border border-[#E8DFCA] rounded-xl text-sm bg-white focus:outline-none focus:border-[#6D94C5] transition-colors';

const EMPTY_FORM = {
  name: '', plot_number: '', sector_location: '',
  total_plot_area: '', area_unit: 'sqft',
  total_floors: '', total_flats: '',
  project_status: 'upcoming',
  launch_date: '', expected_completion: '', description: '',
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = 'text-[#6D94C5]' }) => (
  <div className="bg-white rounded-2xl border border-[#E8DFCA] p-5">
    <p className="text-xs text-[#718096] font-medium mb-1">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-[#718096] mt-1">{sub}</p>}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Projects() {
  const [tab,      setTab]      = useState(0);
  const [projects, setProjects] = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState({ text: '', type: '' });

  // Add / Edit form
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [editId,   setEditId]   = useState(null);

  // Project list filters
  const [filterStatus, setFilterStatus] = useState('');

  // Expanded detail card
  const [expanded, setExpanded] = useState(null);

  // Configurations panel (tab 2)
  const [selProject, setSelProject] = useState('');
  const [configs,    setConfigs]    = useState([]);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [newConfig,  setNewConfig]  = useState({ config_name: '1 BHK', total_units: '' });

  // ── Flash ──────────────────────────────────────────────────
  const flash = useCallback((text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3500);
  }, []);

  // ── Load projects ──────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        getProjectsApi(filterStatus ? { status: filterStatus } : {}),
        getProjectSummaryApi(),
      ]);
      setProjects(pRes.data.data?.projects || []);
      setSummary(sRes.data.data || null);
    } catch {
      flash('Failed to load projects', 'error');
    }
    setLoading(false);
  }, [filterStatus, flash]);

  useEffect(() => { load(); }, [load]);

  // ── Load configs for selected project ──────────────────────
  const loadConfigs = useCallback(async (id) => {
    if (!id) return;
    setCfgLoading(true);
    try {
      const { data } = await getConfigsApi(id);
      setConfigs(data.data?.configurations || []);
    } catch {
      flash('Failed to load configurations', 'error');
    }
    setCfgLoading(false);
  }, [flash]);

  useEffect(() => { if (selProject) loadConfigs(selProject); }, [selProject, loadConfigs]);

  // ── Form handlers ──────────────────────────────────────────
  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const resetForm = () => { setForm(EMPTY_FORM); setEditId(null); };

  const handleEditClick = (project) => {
    setForm({
      name:                project.name             || '',
      plot_number:         project.plot_number      || '',
      sector_location:     project.sector_location  || '',
      total_plot_area:     project.total_plot_area  || '',
      area_unit:           project.area_unit        || 'sqft',
      total_floors:        project.total_floors     || '',
      total_flats:         project.total_flats      || '',
      project_status:      project.project_status   || 'upcoming',
      launch_date:         project.launch_date      ? project.launch_date.split('T')[0] : '',
      expected_completion: project.expected_completion ? project.expected_completion.split('T')[0] : '',
      description:         project.description      || '',
    });
    setEditId(project.id);
    setTab(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Submit create / update ─────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return flash('Project name is required', 'error');

    setSaving(true);
    try {
      const payload = {
        ...form,
        total_plot_area: form.total_plot_area ? Number(form.total_plot_area) : null,
        total_floors:    form.total_floors    ? Number(form.total_floors)    : null,
        total_flats:     form.total_flats     ? Number(form.total_flats)     : null,
        launch_date:          form.launch_date          || null,
        expected_completion:  form.expected_completion  || null,
      };

      if (editId) {
        await updateProjectApi(editId, payload);
        flash('Project updated successfully');
      } else {
        await createProjectApi(payload);
        flash('Project created successfully');
      }
      resetForm();
      load();
      setTab(0);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to save project', 'error');
    }
    setSaving(false);
  };

  // ── Delete project ─────────────────────────────────────────
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    try {
      await deleteProjectApi(id);
      flash('Project deleted');
      load();
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to delete project', 'error');
    }
  };

  // ── Add configuration ──────────────────────────────────────
  const handleAddConfig = async (e) => {
    e.preventDefault();
    if (!selProject) return flash('Select a project first', 'error');
    setSaving(true);
    try {
      await addConfigApi(selProject, {
        config_name: newConfig.config_name,
        total_units: Number(newConfig.total_units) || 0,
      });
      flash('Configuration added');
      setNewConfig({ config_name: '1 BHK', total_units: '' });
      loadConfigs(selProject);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to add configuration', 'error');
    }
    setSaving(false);
  };

  // ── Remove configuration ───────────────────────────────────
  const handleRemoveConfig = async (cid) => {
    if (!window.confirm('Remove this configuration?')) return;
    try {
      await removeConfigApi(selProject, cid);
      flash('Configuration removed');
      loadConfigs(selProject);
    } catch (err) {
      flash(err.response?.data?.message || 'Failed to remove', 'error');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#2d3748]">Projects</h2>
        <button
          onClick={() => { resetForm(); setTab(1); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] transition-all"
        >
          <Plus size={15} /> New Project
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

      {/* ══ TAB 0: ALL PROJECTS ══════════════════════════════════════ */}
      {tab === 0 && (
        <div className="space-y-5">

          {/* Summary stat cards */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Projects"  value={summary.total_projects  || 0} />
              <StatCard label="Total Flats"     value={summary.total_flats     || 0} />
              <StatCard label="Flats Sold"      value={summary.flats_sold      || 0} color="text-green-600" />
              <StatCard label="Flats Available" value={summary.flats_available || 0} color="text-[#6D94C5]" />
              <StatCard
                label="Total Sales Value"
                value={inr(summary.total_sales_value)}
                color="text-[#6D94C5]"
              />
              <StatCard label="Flats Blocked"   value={summary.flats_blocked   || 0} color="text-orange-500" />
            </div>
          )}

          {/* Filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-[#718096]">Filter:</span>
            {['', ...STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                  filterStatus === s
                    ? 'bg-[#6D94C5] text-white'
                    : 'bg-white border border-[#E8DFCA] text-[#718096] hover:border-[#6D94C5]'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          {/* Project list */}
          {loading ? (
            <Loader />
          ) : projects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8DFCA] p-12 text-center">
              <Building2 size={40} className="text-[#CBDCEB] mx-auto mb-3" />
              <p className="text-[#718096] font-medium">No projects found</p>
              <p className="text-xs text-[#718096] mt-1">Create your first project to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">

                  {/* Card header */}
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-[#CBDCEB] rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building2 size={18} className="text-[#6D94C5]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[#2d3748] truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {p.sector_location && (
                            <span className="flex items-center gap-1 text-xs text-[#718096]">
                              <MapPin size={10} /> {p.sector_location}
                            </span>
                          )}
                          {p.plot_number && (
                            <span className="text-xs text-[#718096]">Plot: {p.plot_number}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold capitalize ${STATUS_STYLE[p.project_status] || 'bg-gray-100 text-gray-600'}`}>
                        {p.project_status?.replace('_', ' ')}
                      </span>
                      <button
                        onClick={() => handleEditClick(p)}
                        className="p-2 text-[#6D94C5] hover:bg-[#CBDCEB] rounded-lg transition-all"
                        title="Edit project"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete project"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                        className="p-2 text-[#718096] hover:text-[#6D94C5] transition-colors"
                      >
                        {expanded === p.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Flat count pills */}
                  <div className="px-5 pb-4 flex items-center gap-3 flex-wrap">
                    <span className="text-xs bg-[#F5EFE6] text-[#2d3748] px-3 py-1 rounded-full font-medium">
                      🏢 {p.total_flats_listed || 0} listed
                    </span>
                    <span className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
                      ✅ {p.flats_sold || 0} sold
                    </span>
                    <span className="text-xs bg-[#CBDCEB] text-[#6D94C5] px-3 py-1 rounded-full font-medium">
                      🔵 {p.flats_available || 0} available
                    </span>
                    <span className="text-xs bg-orange-50 text-orange-600 px-3 py-1 rounded-full font-medium">
                      🔒 {p.flats_blocked || 0} blocked
                    </span>
                    {p.total_sales_value > 0 && (
                      <span className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-medium">
                        💰 {inr(p.total_sales_value)}
                      </span>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {expanded === p.id && (
                    <div className="px-5 pb-5 border-t border-[#F5EFE6]">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-xs text-[#718096] mb-0.5">Total Plot Area</p>
                          <p className="text-sm font-semibold text-[#2d3748]">
                            {p.total_plot_area ? `${Number(p.total_plot_area).toLocaleString('en-IN')} ${p.area_unit}` : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#718096] mb-0.5">Total Floors</p>
                          <p className="text-sm font-semibold text-[#2d3748]">{p.total_floors || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#718096] mb-0.5">Total Flats (planned)</p>
                          <p className="text-sm font-semibold text-[#2d3748]">{p.total_flats || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#718096] mb-0.5">Launch Date</p>
                          <p className="text-sm font-semibold text-[#2d3748]">
                            {p.launch_date ? new Date(p.launch_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#718096] mb-0.5">Expected Completion</p>
                          <p className="text-sm font-semibold text-[#2d3748]">
                            {p.expected_completion ? new Date(p.expected_completion).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </p>
                        </div>
                        {p.description && (
                          <div className="col-span-2 md:col-span-4">
                            <p className="text-xs text-[#718096] mb-0.5">Description</p>
                            <p className="text-sm text-[#4a5568]">{p.description}</p>
                          </div>
                        )}
                      </div>

                      {/* Quick actions */}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => { setSelProject(String(p.id)); setTab(2); }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-[#CBDCEB] text-[#6D94C5] text-xs font-semibold rounded-lg hover:bg-[#b8d0e8] transition-all"
                        >
                          <Settings size={12} /> Manage Configurations
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 1: ADD / EDIT PROJECT ════════════════════════════════ */}
      {tab === 1 && (
        <div className="bg-white rounded-2xl border border-[#E8DFCA] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2">
              <Building2 size={16} className="text-[#6D94C5]" />
              {editId ? 'Edit Project' : 'Add New Project'}
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

            {/* Row 1 — Name + Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Nivara Heights"
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Status</label>
                <select name="project_status" value={form.project_status} onChange={handleChange} className={inputCls}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2 — Plot + Sector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Plot Number</label>
                <input
                  name="plot_number"
                  value={form.plot_number}
                  onChange={handleChange}
                  placeholder="e.g. Plot No. 42"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Sector / Location</label>
                <input
                  name="sector_location"
                  value={form.sector_location}
                  onChange={handleChange}
                  placeholder="e.g. Sector 21, Navi Mumbai"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Row 3 — Plot Area + Unit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Total Plot Area</label>
                <input
                  name="total_plot_area"
                  type="number"
                  value={form.total_plot_area}
                  onChange={handleChange}
                  placeholder="e.g. 5000"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Area Unit</label>
                <select name="area_unit" value={form.area_unit} onChange={handleChange} className={inputCls}>
                  {AREA_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4 — Floors + Flats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  <Layers size={11} className="inline mr-1" />Total Floors
                </label>
                <input
                  name="total_floors"
                  type="number"
                  value={form.total_floors}
                  onChange={handleChange}
                  placeholder="e.g. 12"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">
                  <Home size={11} className="inline mr-1" />Total Flats (planned)
                </label>
                <input
                  name="total_flats"
                  type="number"
                  value={form.total_flats}
                  onChange={handleChange}
                  placeholder="e.g. 144"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Row 5 — Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Launch Date</label>
                <input
                  name="launch_date"
                  type="date"
                  value={form.launch_date}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#718096] mb-1.5">Expected Completion</label>
                <input
                  name="expected_completion"
                  type="date"
                  value={form.expected_completion}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Row 6 — Description */}
            <div>
              <label className="block text-xs font-semibold text-[#718096] mb-1.5">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="Optional notes about this project..."
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
                {saving ? 'Saving...' : editId ? 'Update Project' : 'Create Project'}
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

      {/* ══ TAB 2: CONFIGURATIONS ════════════════════════════════════ */}
      {tab === 2 && (
        <div className="space-y-5">

          {/* Project selector */}
          <div className="bg-white rounded-2xl border border-[#E8DFCA] p-5">
            <label className="block text-xs font-semibold text-[#718096] mb-2">
              Select Project
            </label>
            <select
              value={selProject}
              onChange={(e) => setSelProject(e.target.value)}
              className={inputCls}
            >
              <option value="">— Choose a project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {selProject && (
            <>
              {/* Add configuration form */}
              <div className="bg-white rounded-2xl border border-[#E8DFCA] p-5">
                <h3 className="font-bold text-[#2d3748] mb-4 flex items-center gap-2">
                  <Settings size={15} className="text-[#6D94C5]" />
                  Add Configuration
                </h3>
                <form onSubmit={handleAddConfig} className="flex gap-3 flex-wrap items-end">
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs font-semibold text-[#718096] mb-1.5">Type</label>
                    <select
                      value={newConfig.config_name}
                      onChange={(e) => setNewConfig((p) => ({ ...p, config_name: e.target.value }))}
                      className={inputCls}
                    >
                      {CONFIGS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-36">
                    <label className="block text-xs font-semibold text-[#718096] mb-1.5">Units</label>
                    <input
                      type="number"
                      value={newConfig.total_units}
                      onChange={(e) => setNewConfig((p) => ({ ...p, total_units: e.target.value }))}
                      placeholder="e.g. 24"
                      className={inputCls}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-[#6D94C5] text-white text-sm font-semibold rounded-xl hover:bg-[#5a7eb0] disabled:opacity-60 transition-all"
                  >
                    {saving ? 'Adding...' : 'Add'}
                  </button>
                </form>
              </div>

              {/* Configurations list */}
              <div className="bg-white rounded-2xl border border-[#E8DFCA] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E8DFCA] flex items-center justify-between">
                  <p className="font-bold text-[#2d3748] text-sm">Current Configurations</p>
                  <span className="text-xs text-[#718096]">
                    {projects.find((p) => String(p.id) === selProject)?.name}
                  </span>
                </div>

                {cfgLoading ? (
                  <div className="p-8"><Loader /></div>
                ) : configs.length === 0 ? (
                  <div className="p-10 text-center text-[#718096] text-sm">
                    No configurations yet. Add 1 BHK, 2 BHK etc. above.
                  </div>
                ) : (
                  <div className="divide-y divide-[#F5EFE6]">
                    {configs.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#F5EFE6] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#CBDCEB] rounded-xl flex items-center justify-center">
                            <Home size={14} className="text-[#6D94C5]" />
                          </div>
                          <div>
                            <p className="font-semibold text-[#2d3748] text-sm">{c.config_name}</p>
                            <p className="text-xs text-[#718096]">{c.total_units || 0} units planned</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-[#F5EFE6] text-[#4a5568] px-3 py-1 rounded-full font-medium">
                            {c.total_units || 0} units
                          </span>
                          <button
                            onClick={() => handleRemoveConfig(c.id)}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                            title="Remove configuration"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {configs.length > 0 && (
                  <div className="px-5 py-3 border-t border-[#F5EFE6] bg-[#F5EFE6]">
                    <p className="text-xs text-[#718096]">
                      Total planned units:{' '}
                      <span className="font-bold text-[#2d3748]">
                        {configs.reduce((s, c) => s + (Number(c.total_units) || 0), 0)}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Info note */}
              <div className="bg-[#CBDCEB] rounded-xl p-4 text-xs text-[#2d3748]">
                <p className="font-bold mb-1 flex items-center gap-1">
                  <CheckCircle size={12} /> About Configurations
                </p>
                <p>
                  Configurations define the flat types in this project (1 BHK, 2 BHK etc.).
                  These are used when adding individual flats in the Flats module and for
                  inventory filtering and reports.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}