import React, { useState } from 'react';
import { FaQuestionCircle, FaBook, FaSearch, FaChevronDown, FaChevronRight, FaShieldAlt, FaUsers, FaCog, FaDatabase, FaChartBar } from 'react-icons/fa';

const SECTIONS = [
  {
    category: 'Getting Started', icon: FaBook,
    items: [
      { q: 'How do I access the admin panel?', a: 'Navigate to /admin after logging in with a System Admin account (admin@spmt.com / admin123). The sidebar lists all management modules.' },
      { q: 'What are the available roles?', a: 'The system supports 5 roles: Tenant, Property Manager, Service Provider, Technician, and System Admin. Each has distinct permissions enforced per-endpoint (NFR-SEC04).' },
      { q: 'How is data persisted?', a: 'All data is stored in localStorage for this demo. In production, AWS RDS SQL Server handles persistence with daily automated snapshots and 30-day retention (NFR-R04).' },
    ],
  },
  {
    category: 'Ticket Management', icon: FaCog,
    items: [
      { q: 'How does the AI classification work?', a: 'Tickets are classified by two AWS services: Comprehend (text analysis) and Rekognition (image analysis). Each returns a category and confidence score. If they agree, the result is accepted. If they disagree and either confidence is below 0.60, the ticket goes to Manual Review. If both are at or above 0.60 with disagreement, a Conflict flag is set.' },
      { q: 'What is the ticket lifecycle?', a: 'New → AI Classified → Assigned → Accepted → In Progress → Waiting for Parts/Completed → Tenant Confirmed → Closed. Reopened is available from Completed/Archived; Escalated from several states. Each transition is validated by the backend state machine.' },
      { q: 'How do I override an AI category?', a: 'Use the Tag button on any ticket row. The override is logged as CATEGORY_OVERRIDE (BR-006) in the audit trail showing the AI original category and the new value.' },
      { q: 'What is the reopen policy?', a: 'Only Closed or Completed tickets can be reopened, and a justification of at least 10 characters is required (REQ-041). The reason is recorded in the audit log.' },
    ],
  },
  {
    category: 'SLA & Notifications', icon: FaShieldAlt,
    items: [
      { q: 'How are SLA deadlines computed?', a: 'Each priority has a response and resolution target: URGENT 15m/2h, HIGH 1h/8h, MEDIUM 4h/48h, LOW 12h/168h. Deadlines are set at ticket creation and shown in the SLA column. Warning (amber) appears when <1h remains; BREACHED (red) when past deadline.' },
      { q: 'How are emergency notifications handled?', a: 'Emergency notifications have TTL=0 (no queuing) and trigger immediate SysAdmin alert if delivery fails. Non-emergency push is rate-limited to 10/hour/user.' },
      { q: 'Can I retry a failed notification?', a: 'Yes. In the Notifications page, Failed notifications have a Retry button that increments the retry counter and resets status to Pending. Dismiss marks it as Sent.' },
    ],
  },
  {
    category: 'AI Configuration', icon: FaCog,
    items: [
      { q: 'How do I adjust AI thresholds?', a: 'Go to Categories → AI Threshold Configuration. The text confidence threshold (0.60), emergency visual threshold (0.70), and text/image weights (0.40/0.60) are all inline-editable with Save buttons.' },
      { q: 'What is the Rekognition label map?', a: 'Each category has a RekognitionLabel field that maps the category name to a Rekognition-compatible label. Editable per category in the Edit modal.' },
      { q: 'How does BR-009 work?', a: 'If Rekognition classifies an image as "Emergency" with confidence ≥ 0.70, the ticket priority is force-overridden to URGENT before any other classification logic runs.' },
    ],
  },
  {
    category: 'Reports & Analytics', icon: FaChartBar,
    items: [
      { q: 'What reports are available?', a: 'Five report types: Ticket Volume, Resolution Time, SLA Compliance, Provider Performance, and AI Performance. Each is filterable by property, date, category, and provider.' },
      { q: 'How do I export a report?', a: 'Click Generate PDF on the Reports page. A real PDF is downloaded immediately with all data from the active tab, formatted as tables. The banner shows a live countdown simulating an S3 pre-signed URL expiry (REQ-056).' },
      { q: 'What is the difference between Reports and Analytics?', a: 'Reports are tabular/exportable (PDF). Analytics is live/visual with Recharts bar, line, and pie charts showing the same underlying data in real time.' },
    ],
  },
  {
    category: 'User Management', icon: FaUsers,
    items: [
      { q: 'How do I approve a new Property Manager?', a: 'In the Users page, find the user with status "Pending" and click the Approve button. Their status changes to Active and they can log in.' },
      { q: 'How do I change a user\'s role?', a: 'In the Roles page, select a user and assign a new role from the dropdown. The RBAC matrix shows exactly which endpoints each role can access.' },
      { q: 'What happens when a user fails login too many times?', a: 'After 5 failed attempts, the account is Suspended. An admin can unlock it from the Users page (Unlock button), which resets the counter and sets status to Active.' },
    ],
  },
  {
    category: 'Backup & Recovery', icon: FaDatabase,
    items: [
      { q: 'How often are snapshots taken?', a: 'Daily automated RDS snapshots with 30-day retention. You can also trigger a manual snapshot from the Backup page at any time.' },
      { q: 'What is the recovery point objective?', a: 'The RPO is 5 minutes via point-in-time recovery (PITR). You can restore to any point within the last 5 minutes using the PITR Restore button.' },
      { q: 'How do I restore from a snapshot?', a: 'Click Restore on any available snapshot row. A confirmation modal shows snapshot details and estimated downtime (15-30 min). PITR Restore is available from the card header.' },
    ],
  },
];

const Help = () => {
  const [search, setSearch] = useState('');
  const [openMap, setOpenMap] = useState({});
  const [activeCategory, setActiveCategory] = useState(null);

  const toggleOpen = (catIdx, itemIdx) => {
    const key = `${catIdx}-${itemIdx}`;
    setOpenMap(p => ({ ...p, [key]: !p[key] }));
  };

  const filtered = SECTIONS.map((section, ci) => ({
    ...section,
    items: section.items.filter(item =>
      !search || item.q.toLowerCase().includes(search.toLowerCase()) || item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(s => s.items.length > 0);

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaQuestionCircle /> Admin Help & FAQ <span className="req-ref">SRS §2.6 — System Administrator Operations Manual</span></span>
        </div>
        <div style={{ padding: '0 0 12px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FaSearch style={{ color: 'var(--text-dim)', fontSize: 12 }} />
            <input className="form-input" style={{ flex: 1, fontSize: 12, padding: '6px 10px' }} placeholder="Search help topics..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {SECTIONS.map((s, i) => {
              const Icon = s.icon;
              return (
                <button key={i} onClick={() => setActiveCategory(activeCategory === s.category ? null : s.category)}
                  style={{
                    padding: '4px 10px', fontSize: 10, borderRadius: 4,
                    backgroundColor: activeCategory === s.category ? 'rgba(45,183,145,0.1)' : 'transparent',
                    color: activeCategory === s.category ? 'var(--teal)' : 'var(--text-dim)',
                    border: activeCategory === s.category ? '1px solid rgba(45,183,145,0.3)' : '1px solid var(--border)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                ><Icon /> {s.category}</button>
              );
            })}
          </div>
        </div>
      </div>

      {filtered.map((section, ci) => {
        if (activeCategory && section.category !== activeCategory) return null;
        const SectionIcon = section.icon;
        return (
          <div className="card" key={ci}>
            <div className="card-title" style={{ fontSize: 13 }}>
              <SectionIcon /> {section.category}
            </div>
            {section.items.map((item, ii) => {
              const key = `${ci}-${ii}`;
              const isOpen = openMap[key];
              return (
                <div key={ii} style={{
                  borderBottom: '1px solid var(--border)', padding: '10px 0', cursor: 'pointer',
                }} onClick={() => toggleOpen(ci, ii)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    {isOpen ? <FaChevronDown style={{ fontSize: 9, color: 'var(--text-dim)' }} /> : <FaChevronRight style={{ fontSize: 9, color: 'var(--text-dim)' }} />}
                    <strong>{item.q}</strong>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 8, paddingLeft: 17, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default Help;
