import React, { useState, useEffect } from "react";
import {
  FaUserCheck,
  FaUnlockAlt,
  FaUserTie,
  FaUsers,
  FaHourglassHalf,
  FaBan,
  FaExclamationTriangle,
  FaCheck,
  FaUserCircle,
  FaEnvelope,
  FaPhone,
  FaShieldAlt,
  FaWrench,
  FaBuilding,
  FaChevronDown,
  FaChevronRight,
  FaEdit,
  FaUndo,
  FaTimes,
  FaIdCard,
  FaBirthdayCake,
  FaBell,
  FaSearch,
  FaLock,
} from "react-icons/fa";
import {
  getUsers,
  approveManager,
  deactivateUser,
  reactivateUser,
  unlockUserAccount,
  updateUser,
  refreshUsers,
} from "../../data/authStore";
import Alert from "../../components/common/Alert";

const ROLE_CONFIG = {
  TENANT: { label: "Tenant", icon: FaUserCircle },
  PROPERTY_MANAGER: { label: "Property Manager", icon: FaBuilding },
  SERVICE_PROVIDER: { label: "Service Provider", icon: FaWrench },
  SYSTEM_ADMIN: { label: "System Admin", icon: FaShieldAlt },
};

const ROLE_OPTIONS = Object.entries(ROLE_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
}));
const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "Pending", label: "Pending" },
  { value: "Suspended", label: "Suspended/Locked" },
  { value: "Deactivated", label: "Deactivated" },
];
const CHANNEL_OPTIONS = [
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "PUSH", label: "Push" },
];

const EMPTY_FORM = {
  name: "",
  surname: "",
  age: "",
  email: "",
  phone: "",
  idNumber: "",
  role: "",
  preferredNotificationChannel: "EMAIL",
};

const Users = () => {
  const [users, setUsers] = useState(getUsers);
  const [alert, setAlert] = useState({ msg: "", type: "" });
  const [expandedId, setExpandedId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editError, setEditError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const refresh = () => {
    setUsers(getUsers());
  };

  useEffect(() => {
    let cancelled = false;
    refreshUsers().then(() => { if (!cancelled) refresh(); });
    const onUsersUpdated = () => { if (!cancelled) refresh(); };
    window.addEventListener('spmt:users-updated', onUsersUpdated);
    return () => { cancelled = true; window.removeEventListener('spmt:users-updated', onUsersUpdated); };
  }, []);

  const showAlert = (msg, type) => {
    setAlert({ msg, type });
    setTimeout(() => setAlert({ msg: "", type: "" }), 4000);
  };

  const handleApprove = async (userId) => {
    const r = await approveManager(userId);
    if (r.success) {
      showAlert(
        r.data?.name
          ? `${r.data.name} ${r.data.surname || ""} approved.`
          : "Account approved.",
        "success",
      );
      refresh();
    } else {
      showAlert(r.error, "error");
    }
  };

  const handleDeactivate = async (userId) => {
    const r = await deactivateUser(userId);
    if (r.success) {
      showAlert("Account deactivated. (REQ-008)", "success");
      refresh();
    } else {
      showAlert(r.error, "error");
    }
  };

  const handleReactivate = async (userId) => {
    const r = await reactivateUser(userId);
    if (r.success) {
      showAlert("Account reactivated.", "success");
      refresh();
    } else {
      showAlert(r.error, "error");
    }
  };

  const handleUnlock = async (userId) => {
    const r = await unlockUserAccount(userId);
    if (r.success) {
      showAlert("Account unlocked. (REQ-006)", "success");
      refresh();
    } else {
      showAlert(r.error, "error");
    }
  };

  const toggleExpand = (userId) => {
    setExpandedId(expandedId === userId ? null : userId);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({
      name: u.name || "",
      surname: u.surname || "",
      age: String(u.age || ""),
      email: u.email || "",
      phone: u.phone || "",
      idNumber: u.idNumber || "",
      role: u.role || "",
      preferredNotificationChannel: u.preferredNotificationChannel || "EMAIL",
    });
    setEditError("");
  };

  const closeEdit = () => {
    setEditUser(null);
    setEditForm(EMPTY_FORM);
    setEditError("");
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (
      !editForm.name ||
      !editForm.surname ||
      !editForm.email ||
      !editForm.phone
    ) {
      setEditError("Name, surname, email, and phone are required.");
      return;
    }
    const r = await updateUser(editUser.id, {
      name: editForm.name.trim(),
      surname: editForm.surname.trim(),
      age: Number(editForm.age) || 0,
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      idNumber: editForm.idNumber.trim(),
      role: editForm.role,
      preferredNotificationChannel: editForm.preferredNotificationChannel,
    });
    if (r.success) {
      showAlert("User updated.", "success");
      closeEdit();
      refresh();
    } else {
      setEditError(r.error);
    }
  };

  const stats = [
    { label: "Total Accounts", value: users.length, icon: FaUsers },
    {
      label: "Active",
      value: users.filter((u) => u.status === "Active").length,
      icon: FaUserCheck,
    },
    {
      label: "Pending",
      value: users.filter((u) => u.status === "Pending").length,
      icon: FaHourglassHalf,
    },
    {
      label: "Suspended",
      value: users.filter((u) => u.status === "Suspended").length,
      icon: FaExclamationTriangle,
    },
    {
      label: "Deactivated",
      value: users.filter((u) => u.status === "Deactivated").length,
      icon: FaBan,
    },
    {
      label: "Pending Mgrs",
      value: users.filter(
        (u) => u.role === "PROPERTY_MANAGER" && u.status === "Pending",
      ).length,
      icon: FaUserTie,
    },
  ];

  const maskIdNumber = (idNumber) => {
    if (!idNumber) return "—";
    const s = String(idNumber);
    if (s.length <= 4) return "*".repeat(s.length);
    return "*".repeat(s.length - 4) + s.slice(-4);
  };

  const statusBadge = (u) => {
    const isLocked = u.status === "Suspended" && u.failedLoginCount >= 5;
    const label = isLocked ? "Locked" : u.status;
    const cls =
      u.status === "Active"
        ? "badge badge-completed"
        : u.status === "Pending"
          ? "badge badge-open"
          : u.status === "Suspended"
            ? "badge badge-suspended"
            : u.status === "Deactivated"
              ? "badge badge-danger"
              : "badge";
    return (
      <span className={cls}>
        {label}
        {u.status === "Active" && !u.approved && (
          <span style={{ display: "block", fontSize: 10, fontWeight: 600 }}>
            Pending approval
          </span>
        )}
      </span>
    );
  };

  const RoleIcon = ({ role }) => {
    const cfg = ROLE_CONFIG[role] || { label: role, icon: FaUserCircle };
    const Icon = cfg.icon;
    return (
      <>
        <Icon /> {cfg.label}
      </>
    );
  };

  const pendingManagers = users.filter(
    (u) => u.role === "PROPERTY_MANAGER" && u.status === "Pending",
  );

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.surname.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q);
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesStatus = !statusFilter || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span>
            <FaUsers /> User Management <span className="req-ref">MOD-001</span>
          </span>
        </div>
        <Alert msg={alert.msg} type={alert.type} />
        <div className="stat-grid">
          {stats.map((s, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-value">
                <s.icon /> {s.value}
              </div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {pendingManagers.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span>
              <FaUserTie /> Pending Manager Approvals{" "}
              <span className="req-ref">REQ-004</span>
            </span>
          </div>
          <p className="phase-note">
            Property Manager accounts awaiting System Administrator approval.
            Two-tier approval: Tenant/Provider accounts are approved by their
            Property Manager (REQ-005).
          </p>
          <div className="data-list">
            {pendingManagers.map((u) => (
              <div className="data-item" key={u.id}>
                <div>
                  <div className="data-item-id">{u.id}</div>
                  <div className="data-item-name">
                    {u.name} {u.surname}
                  </div>
                  <div className="data-item-meta">
                    <FaEnvelope /> {u.email} &middot; <FaPhone /> {u.phone}
                  </div>
                  <div className="data-item-meta">
                    Registered: {u.createdAt}
                  </div>
                </div>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  {statusBadge(u)}
                  <button
                    className="btn btn-teal btn-sm"
                    onClick={() => handleApprove(u.id)}
                    aria-label="Approve manager"
                  >
                    <FaCheck /> Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <span>
            <FaUsers /> All Accounts ({filteredUsers.length} of {users.length})
          </span>
        </div>
        <div className="filter-bar">
          <div className="filter-item">
            <FaSearch />
            <input
              className="form-input filter-input"
              placeholder="Search name, email, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="form-select filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className="form-select filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 30 }}></th>
                <th scope="col">ID</th>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">ID Number</th>
                <th scope="col">Notification</th>
                <th scope="col">Failed Logins</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan="11"
                    className="empty-text"
                    style={{ textAlign: "center", padding: "24px" }}
                  >
                    No accounts match the current filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <React.Fragment key={u.id}>
                    <tr className="user-row" onClick={() => toggleExpand(u.id)}>
                      <td style={{ cursor: "pointer" }}>
                        {expandedId === u.id ? (
                          <FaChevronDown />
                        ) : (
                          <FaChevronRight />
                        )}
                      </td>
                      <td className="cell-mono">{u.id}</td>
                      <td>
                        {u.name} {u.surname}
                      </td>
                      <td className="cell-mono">{u.email}</td>
                      <td>
                        <RoleIcon role={u.role} />
                      </td>
                      <td>{statusBadge(u)}</td>
                      <td className="cell-mono">{maskIdNumber(u.idNumber)}</td>
                      <td>{u.preferredNotificationChannel}</td>
                      <td className="cell-mono">
                        <span
                          className={
                            u.failedLoginCount >= 5
                              ? "failed-count-critical"
                              : u.failedLoginCount >= 3
                                ? "failed-count-warn"
                                : ""
                          }
                        >
                          {u.failedLoginCount}
                        </span>
                        {u.failedLoginCount >= 5 && (
                          <FaLock
                            style={{ color: "var(--danger)", marginLeft: 4 }}
                            title="Account locked"
                          />
                        )}
                      </td>
                      <td className="cell-mono" style={{ fontSize: 10 }}>
                        {u.createdAt}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="action-cell">
                          {!u.approved && (
                            <button
                              className="btn btn-teal btn-sm"
                              onClick={() => handleApprove(u.id)}
                              title="Approve"
                              aria-label="Approve"
                            >
                              <FaCheck />
                            </button>
                          )}
                          {u.status !== "Deactivated" ? (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeactivate(u.id)}
                              title="Deactivate (REQ-008)"
                              aria-label="Deactivate"
                            >
                              <FaBan />
                            </button>
                          ) : (
                            <button
                              className="btn btn-teal btn-sm"
                              onClick={() => handleReactivate(u.id)}
                              title="Reactivate"
                              aria-label="Reactivate"
                            >
                              <FaUndo />
                            </button>
                          )}
                          {(u.status === "Suspended" ||
                            u.failedLoginCount >= 5) && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleUnlock(u.id)}
                              title="Unlock (REQ-006)"
                              aria-label="Unlock account"
                            >
                              <FaUnlockAlt />
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(u)}
                            title="Edit"
                            aria-label="Edit user"
                          >
                            <FaEdit />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === u.id && (
                      <tr className="expanded-row">
                        <td colSpan="11">
                          <div className="expanded-detail">
                            <div className="detail-grid">
                              <div className="detail-item">
                                <span className="detail-label">
                                  <FaIdCard /> ID Number
                                </span>
                                <span className="detail-value cell-mono">
                                  {u.idNumber}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">
                                  <FaEnvelope /> Email
                                </span>
                                <span className="detail-value">{u.email}</span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">
                                  <FaPhone /> Phone
                                </span>
                                <span className="detail-value">{u.phone}</span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">
                                  <FaBirthdayCake /> Age
                                </span>
                                <span className="detail-value">{u.age}</span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">
                                  <FaBell /> Notification
                                </span>
                                <span className="detail-value">
                                  {u.preferredNotificationChannel}
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">
                                  <FaExclamationTriangle /> Failed Logins
                                </span>
                                <span className="detail-value">
                                  {u.failedLoginCount}
                                </span>
                              </div>
                            </div>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => openEdit(u)}
                            >
                              <FaEdit /> Edit User
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editUser && (
        <div className="modal" onClick={closeEdit}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <span>
                <FaEdit /> Edit User — {editUser.name} {editUser.surname}
              </span>
              <button className="modal-close-btn" onClick={closeEdit}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              {editError && <Alert msg={editError} type="error" />}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    className="form-input"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Surname</label>
                  <input
                    className="form-input"
                    name="surname"
                    value={editForm.surname}
                    onChange={handleEditChange}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input
                    className="form-input"
                    type="number"
                    name="age"
                    min="1"
                    max="150"
                    value={editForm.age}
                    onChange={handleEditChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    className="form-input"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    type="email"
                    name="email"
                    value={editForm.email}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">ID Number</label>
                  <input
                    className="form-input"
                    name="idNumber"
                    value={editForm.idNumber}
                    onChange={handleEditChange}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    name="role"
                    value={editForm.role}
                    onChange={handleEditChange}
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Notification Channel</label>
                  <select
                    className="form-select"
                    name="preferredNotificationChannel"
                    value={editForm.preferredNotificationChannel}
                    onChange={handleEditChange}
                  >
                    {CHANNEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-teal">
                  <FaCheck /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
