const HELP_TOPICS = {
  'getting-started': { title: 'Getting Started', content: 'Login with your credentials. Tenants can create tickets for maintenance issues. Property Managers can assign tickets to technicians.' },
  'tickets': { title: 'Tickets', content: 'Create a ticket by selecting your unit, entering a title and description. Tickets flow through: Open → Assigned → In Progress → Completed → Closed.' },
  'roles': { title: 'Roles & Permissions', content: 'SYSTEM_ADMIN: full access. PROPERTY_MANAGER: manage properties, units, tickets. TENANT: create tickets, rate completed work. SERVICE_PROVIDER: accept and complete assigned tickets.' },
  'sla': { title: 'SLA Policy', content: 'EMERGENCY: 5min response, 60min resolution. HIGH: 15min response, 240min resolution. MEDIUM: 60min response, 1440min resolution. LOW: 1440min response, 4320min resolution.' },
};

const getHelp = async (req, res, next) => {
  try {
    const topics = Object.entries(HELP_TOPICS).map(([key, val]) => ({ key, title: val.title }));
    res.json({ success: true, data: { topics } });
  } catch (err) { next(err); }
};

const getTopic = async (req, res, next) => {
  try {
    const topic = HELP_TOPICS[req.params.topic];
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });
    res.json({ success: true, data: topic });
  } catch (err) { next(err); }
};

export { getHelp, getTopic };
