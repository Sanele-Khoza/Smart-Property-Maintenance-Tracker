const getDefaultData = () => ({
  properties: [],
  units: [],
  tickets: [],
  trash: [],
  categories: [
    { id: 'CAT-001', name: 'Plumbing', description: 'Water, pipe, faucet, and drainage issues', defaultPriority: 'HIGH', aiKeywords: ['leak', 'pipe', 'faucet', 'drain', 'water'], rekognitionLabel: 'Plumbing' },
    { id: 'CAT-002', name: 'Electrical', description: 'Power, wiring, socket, and lighting issues', defaultPriority: 'HIGH', aiKeywords: ['socket', 'power', 'light', 'wire', 'electric'], rekognitionLabel: 'Electrical' },
    { id: 'CAT-003', name: 'HVAC', description: 'Heating, ventilation, and air conditioning', defaultPriority: 'MEDIUM', aiKeywords: ['ac', 'heating', 'ventilation', 'aircon', 'hvac'], rekognitionLabel: 'HVAC' },
    { id: 'CAT-004', name: 'Emergency', description: 'Immediate safety or structural threats', defaultPriority: 'EMERGENCY', aiKeywords: ['gas leak', 'flooding', 'structural collapse', 'sewage overflow', 'burst pipe'], rekognitionLabel: 'Emergency' },
    { id: 'CAT-005', name: 'General', description: 'General maintenance and repairs', defaultPriority: 'LOW', aiKeywords: ['paint', 'clean', 'fix', 'repair', 'replace'], rekognitionLabel: 'General' },
  ],
  technicians: [],
  systemSettings: [
    {
      key: 'AUTO_ASSIGN_ENABLED',
      value: 'true',
      type: 'boolean',
      category: 'sla',
      description: 'Enable automatic provider assignment for all priorities (Prompt 22 v2 §8)',
    },
    { key: 'AI_TEXT_CONFIDENCE_THRESHOLD', value: '0.60', type: 'decimal', category: 'ai', description: 'Minimum confidence for Comprehend text classification' },
    { key: 'AI_EMERGENCY_VISUAL_THRESHOLD', value: '0.70', type: 'decimal', category: 'ai', description: 'Minimum confidence for Rekognition emergency detection' },
    { key: 'AI_TEXT_WEIGHT', value: '0.40', type: 'decimal', category: 'ai', description: 'Weight of text analysis (Comprehend) in combined score' },
    { key: 'AI_VISUAL_WEIGHT', value: '0.60', type: 'decimal', category: 'ai', description: 'Weight of image analysis (Rekognition) in combined score' },
  ],
  slaConfig: [
    { priority: 'EMERGENCY', responseMinutes: 30, resolutionMinutes: 240, warningPercent: 75, autoAssignMinutes: 30 },
    { priority: 'URGENT', responseMinutes: 30, resolutionMinutes: 240, warningPercent: 75, autoAssignMinutes: 30 },
    { priority: 'HIGH', responseMinutes: 120, resolutionMinutes: 480, warningPercent: 75, autoAssignMinutes: 120 },
    { priority: 'MEDIUM', responseMinutes: 480, resolutionMinutes: 2880, warningPercent: 75, autoAssignMinutes: 480 },
    { priority: 'LOW', responseMinutes: 1440, resolutionMinutes: 10080, warningPercent: 75, autoAssignMinutes: 1440 },
  ],
  auditLog: [],
  securityAuditLog: [],
  notifications: [],
  aiInferenceLog: [],
});

const FIELDS_WITH_DEFAULTS = ['categories', 'technicians', 'systemSettings', 'slaConfig', 'auditLog', 'securityAuditLog', 'notifications', 'aiInferenceLog'];

let store = null;

const stripImagePreviews = () => {
  for (const ticket of store.tickets) {
    if (ticket.images && ticket.images.length > 0) {
      ticket.images = ticket.images.map(img => {
        if (typeof img === 'object' && img.data) {
          const { data, ...rest } = img;
          return rest;
        }
        return { stripped: true };
      });
    }
  }
};

const saveToLocalStorage = () => {
  try {
    localStorage.setItem('spmt_app_data', JSON.stringify(store));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || (typeof e.code === 'number' && e.code === 22)) {
      stripImagePreviews();
      try {
        localStorage.setItem('spmt_app_data', JSON.stringify(store));
      } catch (e2) {
        console.error('Save failed even after stripping image data:', e2);
      }
    } else {
      console.error('Failed to save to localStorage:', e);
    }
  }
};

const migrateSavedData = (parsed) => {
  const defaults = getDefaultData();
  FIELDS_WITH_DEFAULTS.forEach(field => {
    if (!parsed[field] || (Array.isArray(parsed[field]) && parsed[field].length === 0)) {
      parsed[field] = defaults[field];
    }
  });
  parsed.tickets = (parsed.tickets || []).map(t => {
    const match = defaults.tickets.find(dt => dt.ticketId === t.ticketId);
    return match ? { ...match, ...t } : t;
  });
  if (parsed.systemSettings && defaults.systemSettings) {
    const existingKeys = new Set(parsed.systemSettings.map(s => s.key));
    defaults.systemSettings.forEach(ds => {
      if (!existingKeys.has(ds.key)) {
        parsed.systemSettings.push(ds);
      }
    });
  }
  if (parsed.categories && defaults.categories) {
    parsed.categories = parsed.categories.map(c => {
      const d = defaults.categories.find(dc => dc.id === c.id);
      return d ? { ...d, ...c } : c;
    });
  }
  return parsed;
};

const getInitialData = () => {
  const saved = localStorage.getItem('spmt_app_data');
  if (saved) {
    const parsed = migrateSavedData(JSON.parse(saved));
    store = parsed;
    saveToLocalStorage();
    return store;
  }
  return getDefaultData();
};

store = getInitialData();

const isAllowedText = (value) => {
  return /^[A-Za-z0-9 _-]+$/.test(value.trim());
};

export const getStore = () => store;

export { saveToLocalStorage, isAllowedText };

export const resetData = () => {
  store = getInitialData();
  saveToLocalStorage();
  return { success: true };
};

export const getAllData = () => {
  return {
    properties: store.properties,
    units: store.units.map(u => ({ ...u, propertyName: store.properties.find(p => p.propertyId === u.propertyId)?.name })),
    tickets: store.tickets,
    categories: store.categories,
    technicians: store.technicians,
    systemSettings: store.systemSettings,
    slaConfig: store.slaConfig,
    auditLog: store.auditLog,
    securityAuditLog: store.securityAuditLog,
    notifications: store.notifications,
    aiInferenceLog: store.aiInferenceLog,
  };
};
