import React, { useState, useEffect } from 'react';
import { FaTag, FaPlus, FaEdit, FaTrash, FaExclamationTriangle, FaTimes, FaCheck, FaCog, FaSave, FaAws } from 'react-icons/fa';
import { getCategories, addCategory, updateCategory, deleteCategory, getAiThresholdConfig, updateSystemSetting } from '../../data/store';
import { getTickets } from '../../data/store';
import Alert from '../../components/common/Alert';

const PRIORITY_OPTIONS = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
const EMPTY_FORM = { name: '', description: '', defaultPriority: 'MEDIUM', aiKeywords: '', rekognitionLabel: '' };

const Categories = () => {
  const [categories, setCategories] = useState(getCategories);
  const [tickets] = useState(getTickets);
  const [thresholds, setThresholds] = useState(getAiThresholdConfig);
  const [thresholdEdits, setThresholdEdits] = useState({});
  const [savingThreshold, setSavingThreshold] = useState(null);
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createError, setCreateError] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editError, setEditError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { setThresholds(getAiThresholdConfig()); }, []);

  const refresh = () => {
    setCategories(getCategories());
    setThresholds(getAiThresholdConfig());
  };

  const showAlert = (msg, type) => {
    setAlert({ msg, type });
    setTimeout(() => setAlert({ msg: '', type: '' }), 5000);
  };

  const distinctTicketCategories = [...new Set(tickets.filter(t => t.category).map(t => t.category))].length;

  const stats = [
    { label: 'Total Categories', value: categories.length, icon: FaTag },
    { label: 'Ticket Categories (distinct)', value: distinctTicketCategories, icon: FaCog },
  ];

  const openCreate = () => {
    setCreateForm(EMPTY_FORM);
    setCreateError('');
    setShowCreate(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      setCreateError('Category name is required.');
      return;
    }
    const keywords = createForm.aiKeywords.split(',').map(k => k.trim()).filter(Boolean);
    const r = await addCategory(createForm.name, createForm.description, createForm.defaultPriority, keywords, createForm.rekognitionLabel.trim() || createForm.name.trim());
    if (r.success) {
      showAlert(`Category "${r.data.name}" created.`, 'success');
      setShowCreate(false);
      refresh();
    } else {
      setCreateError(r.error);
    }
  };

  const openEdit = (cat) => {
    setEditTarget(cat);
    setEditForm({
      name: cat.name || '',
      description: cat.description || '',
      defaultPriority: cat.defaultPriority || 'MEDIUM',
      aiKeywords: Array.isArray(cat.aiKeywords) ? cat.aiKeywords.join(', ') : '',
      rekognitionLabel: cat.rekognitionLabel || cat.name || '',
    });
    setEditError('');
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      setEditError('Category name is required.');
      return;
    }
    const keywords = editForm.aiKeywords.split(',').map(k => k.trim()).filter(Boolean);
    const r = await updateCategory(editTarget.id, {
      name: editForm.name,
      description: editForm.description,
      defaultPriority: editForm.defaultPriority,
      aiKeywords: keywords,
      rekognitionLabel: editForm.rekognitionLabel.trim() || editForm.name.trim(),
    });
    if (r.success) {
      showAlert('Category updated.', 'success');
      setEditTarget(null);
      refresh();
    } else {
      setEditError(r.error);
    }
  };

  const promptDelete = (cat) => {
    const isReferenced = tickets.some(t => t.category === cat.name);
    if (isReferenced) {
      setConfirmDelete({
        blocked: true,
        category: cat,
        message: `Cannot delete "${cat.name}" — ${tickets.filter(t => t.category === cat.name).length} ticket(s) reference this category (ON DELETE RESTRICT).`,
      });
    } else {
      setConfirmDelete({
        blocked: false,
        category: cat,
        message: `Permanently delete category "${cat.name}"? This cannot be undone.`,
      });
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete || confirmDelete.blocked) return;
    const r = await deleteCategory(confirmDelete.category.id);
    if (r.success) {
      showAlert(`Category "${confirmDelete.category.name}" deleted.`, 'success');
      setConfirmDelete(null);
      refresh();
    } else {
      showAlert(r.error, 'error');
    }
  };

  const handleThresholdEdit = (key, value) => {
    setThresholdEdits(p => ({ ...p, [key]: value }));
  };

  const saveThreshold = async (key) => {
    const val = parseFloat(thresholdEdits[key]);
    if (isNaN(val) || val < 0 || val > 1) {
      showAlert(`${key} must be a float between 0 and 1.`, 'error');
      return;
    }
    setSavingThreshold(key);
    const r = await updateSystemSetting(key, val);
    if (r.success) {
      showAlert(`${key} updated to ${val}.`, 'success');
      setThresholdEdits(p => { const n = { ...p }; delete n[key]; return n; });
      refresh();
    } else {
      showAlert(r.error, 'error');
    }
    setSavingThreshold(null);
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaTag /> Categories <span className="req-ref">MOD-003</span></span>
          <button className="btn btn-teal" onClick={openCreate}><FaPlus /> Add Category</button>
        </div>
        <Alert msg={alert.msg} type={alert.type} />
        <div className="stat-grid">
          {stats.map((s, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-value"><s.icon /> {s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaTag /> Maintenance Taxonomy</span>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Description</th>
                <th>Default Priority</th>
                <th>AI Keywords</th>
                <th>Rekognition Label</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr><td colSpan="7" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No categories defined.</td></tr>
              ) : (
                categories.map(cat => {
                  const isReferenced = tickets.some(t => t.category === cat.name);
                  return (
                    <tr key={cat.id}>
                      <td className="cell-mono">{cat.id}</td>
                      <td>{cat.name}</td>
                      <td>{cat.description || '—'}</td>
                      <td>
                        <span className={`badge ${
                          cat.defaultPriority === 'URGENT' ? 'badge-danger' :
                          cat.defaultPriority === 'HIGH' ? 'badge-warning' :
                          cat.defaultPriority === 'MEDIUM' ? 'badge-info' : 'badge-completed'
                        }`}>{cat.defaultPriority}</span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {Array.isArray(cat.aiKeywords) ? cat.aiKeywords.join(', ') : '—'}
                      </td>
                      <td>
                        <code style={{ fontSize: 11, color: 'var(--info)' }}>{cat.rekognitionLabel || cat.name}</code>
                      </td>
                      <td>
                        <div className="action-cell">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(cat)} title="Edit"><FaEdit /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => promptDelete(cat)} title={isReferenced ? 'Cannot delete: tickets reference this category' : 'Delete'}>
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaAws /> Rekognition labelCategoryMap <span className="req-ref">MOD-003</span></span>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Rekognition Label</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.id}>
                  <td><strong>{cat.name}</strong></td>
                  <td><code style={{ color: 'var(--teal)' }}>{cat.rekognitionLabel || cat.name}</code></td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr><td colSpan="2" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No categories defined.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaCog /> AI Threshold Configuration <span className="req-ref">MOD-003</span></span>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Setting</th>
                <th>Value</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {thresholds.map((t, i) => {
                const isEditing = thresholdEdits[t.key] !== undefined;
                const displayVal = isEditing ? thresholdEdits[t.key] : t.value;
                return (
                  <tr key={i}>
                    <td className="cell-mono">{t.key}</td>
                    <td>
                      <input
                        type="number" step="0.01" min="0" max="1"
                        className="form-input"
                        style={{ width: 80, fontSize: 12, padding: '2px 6px' }}
                        value={displayVal}
                        onChange={e => handleThresholdEdit(t.key, e.target.value)}
                      />
                    </td>
                    <td style={{ fontSize: 12 }}>{t.description}</td>
                    <td>
                      {isEditing ? (
                        <button
                          className="btn btn-teal btn-sm"
                          onClick={() => saveThreshold(t.key)}
                          disabled={savingThreshold === t.key}
                        >
                          <FaSave /> Save
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="modal" onClick={() => setShowCreate(false)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header">
              <span><FaPlus /> Add Category <span className="req-ref">MOD-003</span></span>
              <button className="modal-close-btn" onClick={() => setShowCreate(false)}><FaTimes /></button>
            </div>
            <form onSubmit={handleCreate}>
              {createError && <Alert msg={createError} type="error" />}
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" name="name" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" name="description" value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Default Priority</label>
                <select className="form-select" value={createForm.defaultPriority} onChange={e => setCreateForm({ ...createForm, defaultPriority: e.target.value })}>
                  {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">AI Keywords (comma-separated)</label>
                <input className="form-input" name="aiKeywords" value={createForm.aiKeywords} onChange={e => setCreateForm({ ...createForm, aiKeywords: e.target.value })} placeholder="e.g. leak, pipe, faucet" />
              </div>
              <div className="form-group">
                <label className="form-label">Rekognition Label</label>
                <input className="form-input" name="rekognitionLabel" value={createForm.rekognitionLabel} onChange={e => setCreateForm({ ...createForm, rekognitionLabel: e.target.value })} placeholder="Defaults to category name" />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-teal"><FaPlus /> Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="modal" onClick={() => setEditTarget(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header">
              <span><FaEdit /> Edit Category — {editTarget.name}</span>
              <button className="modal-close-btn" onClick={() => setEditTarget(null)}><FaTimes /></button>
            </div>
            <form onSubmit={handleEdit}>
              {editError && <Alert msg={editError} type="error" />}
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" name="name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" name="description" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Default Priority</label>
                <select className="form-select" value={editForm.defaultPriority} onChange={e => setEditForm({ ...editForm, defaultPriority: e.target.value })}>
                  {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">AI Keywords (comma-separated)</label>
                <input className="form-input" name="aiKeywords" value={editForm.aiKeywords} onChange={e => setEditForm({ ...editForm, aiKeywords: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Rekognition Label</label>
                <input className="form-input" name="rekognitionLabel" value={editForm.rekognitionLabel} onChange={e => setEditForm({ ...editForm, rekognitionLabel: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><FaCheck /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal" onClick={() => setConfirmDelete(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="edit-modal-header">
              <span><FaExclamationTriangle /> Confirm Delete</span>
              <button className="modal-close-btn" onClick={() => setConfirmDelete(null)}><FaTimes /></button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ marginBottom: 16, lineHeight: 1.6, color: 'var(--text)' }}>{confirmDelete.message}</p>
              {confirmDelete.blocked && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  <FaExclamationTriangle /> Action blocked — tickets reference this category (ON DELETE RESTRICT).
                </div>
              )}
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
                {!confirmDelete.blocked && (
                  <button className="btn btn-danger" onClick={executeDelete}><FaTrash /> Delete</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
