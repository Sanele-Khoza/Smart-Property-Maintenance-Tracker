import React, { useState } from 'react';
import { FaCog, FaSave, FaExclamationTriangle, FaTimes, FaCheck, FaClock, FaDatabase, FaAws, FaShieldAlt, FaImage, FaKey, FaUserLock, FaChartLine, FaRobot } from 'react-icons/fa';
import { getSystemSettings, updateSystemSetting, getSlaConfig, updateSlaConfig } from '../../data/store';
import Alert from '../../components/common/Alert';

const CATEGORY_META = {
  ai:   { label: 'AI Classification', icon: FaRobot, color: 'var(--info)' },
  auth: { label: 'Authentication & Security', icon: FaShieldAlt, color: 'var(--teal)' },
  general: { label: 'General', icon: FaCog, color: 'var(--text-dim)' },
  sla:  { label: 'SLA & Auto-Assignment', icon: FaClock, color: 'var(--amber)' },
  provider: { label: 'Provider Management', icon: FaUserLock, color: 'var(--teal)' },
  db:   { label: 'Database', icon: FaDatabase, color: 'var(--info)' },
  aws:  { label: 'AWS Integration', icon: FaAws, color: 'var(--amber)' },
};

const PRIORITY_ORDER = ['EMERGENCY', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'];

const Settings = () => {
  const [settings, setSettings] = useState(getSystemSettings);
  const [slaConfig, setSlaConfig] = useState(getSlaConfig);
  const [edits, setEdits] = useState({});
  const [slaEdits, setSlaEdits] = useState({});
  const [saving, setSaving] = useState(null);
  const [alert, setAlert] = useState({ msg: '', type: '' });

  const showAlert = (msg, type) => {
    setAlert({ msg, type });
    setTimeout(() => setAlert({ msg: '', type: '' }), 5000);
  };

  const grouped = {};
  settings.forEach(s => {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  });

  const refresh = () => {
    setSettings(getSystemSettings());
    setSlaConfig(getSlaConfig());
  };

  const handleEdit = (key, value) => {
    setEdits(p => ({ ...p, [key]: value }));
  };

  const handleSlaEdit = (priority, field, value) => {
    const key = `${priority}.${field}`;
    setSlaEdits(p => ({ ...p, [key]: value }));
  };

  const saveSetting = async (key) => {
    const raw = edits[key];
    if (raw === undefined || raw === '') return;
    const orig = settings.find(s => s.key === key);
    let parsed;
    if (orig.type === 'boolean') {
      parsed = raw === 'true' || raw === true;
    } else if (orig.type === 'int') {
      parsed = parseInt(raw, 10);
      if (isNaN(parsed) || parsed < 0) { showAlert(`${key} must be a positive integer.`, 'error'); return; }
    } else {
      parsed = parseFloat(raw);
      if (isNaN(parsed) || parsed < 0) { showAlert(`${key} must be a positive number.`, 'error'); return; }
      if (key.startsWith('AI_') && parsed > 1) { showAlert(`${key} must be ≤ 1.0 for AI thresholds.`, 'error'); return; }
    }
    setSaving(key);
    const r = await updateSystemSetting(key, parsed);
    if (r.success) {
      showAlert(`${key} updated to ${parsed}.`, 'success');
      setEdits(p => { const n = { ...p }; delete n[key]; return n; });
      refresh();
    } else {
      showAlert(r.error, 'error');
    }
    setSaving(null);
  };

  const saveSlaField = async (priority, field) => {
    const key = `${priority}.${field}`;
    const raw = slaEdits[key];
    if (raw === undefined || raw === '') return;
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 0) { showAlert(`${priority} ${field} must be a positive integer.`, 'error'); return; }
    setSaving(key);
    const r = await updateSlaConfig(priority, { [field]: val });
    if (r.success) {
      showAlert(`${priority} ${field} updated to ${val}.`, 'success');
      setSlaEdits(p => { const n = { ...p }; delete n[key]; return n; });
      refresh();
    } else {
      showAlert(r.error, 'error');
    }
    setSaving(null);
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaCog /> System Settings <span className="req-ref">MOD-003 / SDD §5</span></span>
        </div>
        <Alert msg={alert.msg} type={alert.type} />
        {Object.entries(grouped).map(([category, items]) => {
          const meta = CATEGORY_META[category] || { label: category, icon: FaCog, color: 'var(--text-dim)' };
          const Icon = meta.icon;
          return (
            <div key={category} style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: meta.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon /> {meta.label}
              </h4>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>Key</th>
                      <th style={{ width: '12%' }}>Value</th>
                      <th style={{ width: '12%' }}>Type</th>
                      <th style={{ width: '31%' }}>Description</th>
                      <th style={{ width: '10%' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(s => {
                      const isEditing = edits[s.key] !== undefined;
                      const displayVal = isEditing ? edits[s.key] : s.value;
                      const isBoolean = s.type === 'boolean';
                      const checked = isBoolean && (isEditing
                        ? edits[s.key] === 'true' || edits[s.key] === true
                        : s.value === 'true' || s.value === true);
                      return (
                        <tr key={s.key}>
                          <td className="cell-mono" style={{ fontSize: 11 }}>{s.key}</td>
                          <td>
                            {isBoolean ? (
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e => handleEdit(s.key, String(e.target.checked))}
                                />
                                <span style={{ fontSize: 10, color: checked ? 'var(--success)' : 'var(--text-dim)' }}>
                                  {checked ? 'ON' : 'OFF'}
                                </span>
                              </label>
                            ) : (
                              <input
                                type="number"
                                step={s.type === 'int' ? '1' : '0.01'}
                                min="0"
                                className="form-input"
                                style={{ width: 80, fontSize: 11, padding: '2px 6px' }}
                                value={displayVal}
                                onChange={e => handleEdit(s.key, e.target.value)}
                              />
                            )}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.type}</td>
                          <td style={{ fontSize: 11 }}>{s.description}</td>
                          <td>
                            {isEditing ? (
                              <button className="btn btn-teal btn-sm" onClick={() => saveSetting(s.key)} disabled={saving === s.key} style={{ fontSize: 9, padding: '2px 6px' }}>
                                <FaSave /> Save
                              </button>
                            ) : (
                              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaClock /> SLA Configuration <span className="req-ref">MOD-003 / SDD §5</span></span>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Response (min)</th>
                <th />
                <th>Resolution (min)</th>
                <th />
                <th>Warning %</th>
                <th />
                <th>Auto-Assign Delay (min)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {PRIORITY_ORDER.map(priority => {
                const sla = slaConfig.find(s => s.priority === priority);
                if (!sla) return null;
                const respKey = `${priority}.responseMinutes`;
                const resolKey = `${priority}.resolutionMinutes`;
                const warnKey = `${priority}.warningPercent`;
                const assignKey = `${priority}.autoAssignMinutes`;
                const respEdit = slaEdits[respKey] !== undefined;
                const resolEdit = slaEdits[resolKey] !== undefined;
                const warnEdit = slaEdits[warnKey] !== undefined;
                const assignEdit = slaEdits[assignKey] !== undefined;
                const respVal = respEdit ? slaEdits[respKey] : sla.responseMinutes;
                const resolVal = resolEdit ? slaEdits[resolKey] : sla.resolutionMinutes;
                const warnVal = warnEdit ? slaEdits[warnKey] : sla.warningPercent;
                const assignVal = assignEdit ? slaEdits[assignKey] : sla.autoAssignMinutes ?? '';
                return (
                  <tr key={priority} style={['EMERGENCY', 'URGENT'].includes(priority) ? { backgroundColor: 'rgba(220,60,60,0.04)' } : {}}>
                    <td><strong style={{ color: ['EMERGENCY', 'URGENT'].includes(priority) ? 'var(--danger)' : 'inherit' }}>{priority}</strong></td>
                    <td>
                      <input type="number" min="1" className="form-input" style={{ width: 70, fontSize: 11, padding: '2px 6px' }} value={respVal} onChange={e => handleSlaEdit(priority, 'responseMinutes', e.target.value)} />
                    </td>
                    <td>
                      {respEdit ? (
                        <button className="btn btn-teal btn-sm" onClick={() => saveSlaField(priority, 'responseMinutes')} disabled={saving === respKey} style={{ fontSize: 9, padding: '2px 5px' }}>
                          <FaSave />
                        </button>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <input type="number" min="1" className="form-input" style={{ width: 70, fontSize: 11, padding: '2px 6px' }} value={resolVal} onChange={e => handleSlaEdit(priority, 'resolutionMinutes', e.target.value)} />
                    </td>
                    <td>
                      {resolEdit ? (
                        <button className="btn btn-teal btn-sm" onClick={() => saveSlaField(priority, 'resolutionMinutes')} disabled={saving === resolKey} style={{ fontSize: 9, padding: '2px 5px' }}>
                          <FaSave />
                        </button>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <input type="number" min="50" max="100" className="form-input" style={{ width: 60, fontSize: 11, padding: '2px 6px' }} value={warnVal} onChange={e => handleSlaEdit(priority, 'warningPercent', e.target.value)} />
                    </td>
                    <td>
                      {warnEdit ? (
                        <button className="btn btn-teal btn-sm" onClick={() => saveSlaField(priority, 'warningPercent')} disabled={saving === warnKey} style={{ fontSize: 9, padding: '2px 5px' }}>
                          <FaSave />
                        </button>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <input type="number" min="1" className="form-input" style={{ width: 80, fontSize: 11, padding: '2px 6px' }} value={assignVal} onChange={e => handleSlaEdit(priority, 'autoAssignMinutes', e.target.value)} />
                    </td>
                    <td>
                      {assignEdit ? (
                        <button className="btn btn-teal btn-sm" onClick={() => saveSlaField(priority, 'autoAssignMinutes')} disabled={saving === assignKey} style={{ fontSize: 9, padding: '2px 5px' }}>
                          <FaSave />
                        </button>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Settings;
