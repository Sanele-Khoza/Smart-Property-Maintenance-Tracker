const getDefaultData = () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return {
    properties: [
      { propertyId: 'P-001', name: 'Sandton Heights', address: '123 Main Street, Sandton, Johannesburg', propertyType: 'RESIDENTIAL', status: 'ACTIVE', managerName: 'Sarah Manager', createdAt: new Date().toLocaleString() },
      { propertyId: 'P-002', name: 'Cape Point Villas', address: '45 Beach Road, Cape Town', propertyType: 'RESIDENTIAL', status: 'ACTIVE', managerName: 'Sarah Manager', createdAt: new Date().toLocaleString() },
      { propertyId: 'P-003', name: 'Rivonia Office Park', address: '100 Rivonia Road, Sandton, Johannesburg', propertyType: 'COMMERCIAL', status: 'ACTIVE', managerName: 'Sarah Manager', createdAt: new Date().toLocaleString() },
      { propertyId: 'P-004', name: 'The Galleria Mall', address: '15 Bree Street, Cape Town', propertyType: 'COMMERCIAL', status: 'ACTIVE', managerName: 'Sarah Manager', createdAt: new Date().toLocaleString() },
      { propertyId: 'P-005', name: 'Harvest Place', address: '88 Violet Lane, Durban', propertyType: 'MIXED', status: 'ACTIVE', managerName: 'Sarah Manager', createdAt: new Date().toLocaleString() },
    ],
    units: [
      { unitId: 'U-001', propertyId: 'P-001', unitNumber: '101', floor: 1, status: 'OCCUPIED', tenantName: 'John Tenant' },
      { unitId: 'U-002', propertyId: 'P-001', unitNumber: '102', floor: 1, status: 'VACANT', tenantName: null },
      { unitId: 'U-003', propertyId: 'P-001', unitNumber: '201', floor: 2, status: 'OCCUPIED', tenantName: 'John Tenant' },
      { unitId: 'U-004', propertyId: 'P-002', unitNumber: 'A1', floor: 1, status: 'VACANT', tenantName: null },
    ],
    tickets: [
      { ticketId: 'T-001', unitId: 'U-001', unitNumber: '101', propertyName: 'Sandton Heights', title: 'Leaking Faucet', description: 'The kitchen faucet is leaking water continuously. Need urgent repair.', status: 'Assigned', priority: 'HIGH', category: 'Plumbing', aiOriginalCategory: 'Plumbing', combinedConfidence: 0.87, conflictDetected: false, manualReviewRequired: false, assignedTo: 'Mike Provider', assignedToId: 'PROV-001', createdBy: 'John Tenant', createdById: 'USR-001', createdAt: new Date(now - 2 * day).toLocaleString(), updatedAt: new Date(now - 1 * day).toLocaleString(), images: [], slaResponseBefore: now - 2 * day + 60 * 60 * 1000, slaResolutionBefore: now - 2 * day + 480 * 60 * 1000 },
      { ticketId: 'T-002', unitId: 'U-003', unitNumber: '201', propertyName: 'Sandton Heights', title: 'Broken Air Conditioner', description: 'The AC is not cooling properly. Making strange noises.', status: 'Open', priority: 'MEDIUM', category: 'HVAC', aiOriginalCategory: 'HVAC', combinedConfidence: 0.93, conflictDetected: false, manualReviewRequired: false, assignedTo: null, assignedToId: null, createdBy: 'John Tenant', createdById: 'USR-001', createdAt: new Date(now - 5 * 3600 * 1000).toLocaleString(), updatedAt: new Date(now - 5 * 3600 * 1000).toLocaleString(), images: [], slaResponseBefore: now - 5 * 3600 * 1000 + 240 * 60 * 1000, slaResolutionBefore: now - 5 * 3600 * 1000 + 2880 * 60 * 1000 },
      { ticketId: 'T-003', unitId: 'U-001', unitNumber: '101', propertyName: 'Sandton Heights', title: 'Electrical Socket Not Working', description: 'The socket in the bedroom is not working. No power.', status: 'In Progress', priority: 'HIGH', category: 'Electrical', aiOriginalCategory: 'Electrical', combinedConfidence: 0.95, conflictDetected: false, manualReviewRequired: false, assignedTo: 'Mike Provider', assignedToId: 'PROV-001', createdBy: 'John Tenant', createdById: 'USR-001', createdAt: new Date(now - 3 * day).toLocaleString(), updatedAt: new Date(now - 2 * day).toLocaleString(), images: [], slaResponseBefore: now - 3 * day + 60 * 60 * 1000, slaResolutionBefore: now - 3 * day + 480 * 60 * 1000 },
      { ticketId: 'T-004', unitId: 'U-002', unitNumber: '102', propertyName: 'Sandton Heights', title: 'Broken Window', description: 'Living room window has a large crack and needs replacement.', status: 'Manual Review', priority: 'MEDIUM', category: 'General', aiOriginalCategory: 'Emergency', combinedConfidence: 0.42, conflictDetected: false, manualReviewRequired: true, assignedTo: null, assignedToId: null, createdBy: 'John Tenant', createdById: 'USR-001', createdAt: new Date(now - 1 * day).toLocaleString(), updatedAt: new Date(now - 12 * 3600 * 1000).toLocaleString(), images: [], slaResponseBefore: now - 1 * day + 240 * 60 * 1000, slaResolutionBefore: now - 1 * day + 2880 * 60 * 1000 },
      { ticketId: 'T-005', unitId: 'U-001', unitNumber: '101', propertyName: 'Sandton Heights', title: 'Gas Stove Issue', description: 'Gas stove burner not igniting. Smell of gas detected.', status: 'Waiting for Parts', priority: 'EMERGENCY', category: 'Plumbing', aiOriginalCategory: 'Plumbing', combinedConfidence: 0.88, conflictDetected: false, manualReviewRequired: false, assignedTo: 'Mike Provider', assignedToId: 'PROV-001', createdBy: 'John Tenant', createdById: 'USR-001', createdAt: new Date(now - 5 * day).toLocaleString(), updatedAt: new Date(now - 1 * day).toLocaleString(), images: [], slaResponseBefore: now - 5 * day + 15 * 60 * 1000, slaResolutionBefore: now - 5 * day + 120 * 60 * 1000 },
      { ticketId: 'T-006', unitId: 'U-001', unitNumber: '101', propertyName: 'Sandton Heights', title: 'Ceiling Leak After Rain', description: 'Water stains on bedroom ceiling after last night rainstorm.', status: 'Completed (Provider)', priority: 'HIGH', category: 'Plumbing', aiOriginalCategory: 'General', combinedConfidence: 0.69, conflictDetected: true, manualReviewRequired: false, assignedTo: 'Jane Smith', assignedToId: 'PROV-002', createdBy: 'John Tenant', createdById: 'USR-001', createdAt: new Date(now - 10 * day).toLocaleString(), updatedAt: new Date(now - 1 * day).toLocaleString(), images: [], slaResponseBefore: now - 10 * day + 60 * 60 * 1000, slaResolutionBefore: now - 10 * day + 480 * 60 * 1000 },
      { ticketId: 'T-007', unitId: 'U-003', unitNumber: '201', propertyName: 'Sandton Heights', title: 'Paint Peeling in Bathroom', description: 'Paint peeling off walls due to moisture. Needs scraping and repainting.', status: 'Open', priority: 'LOW', category: 'General', aiOriginalCategory: 'General', combinedConfidence: 0.91, conflictDetected: false, manualReviewRequired: false, assignedTo: null, assignedToId: null, createdBy: 'John Tenant', createdById: 'USR-001', createdAt: new Date(now - 3 * day).toLocaleString(), updatedAt: new Date(now - 3 * day).toLocaleString(), images: [], slaResponseBefore: now - 3 * day + 720 * 60 * 1000, slaResolutionBefore: now - 3 * day + 10080 * 60 * 1000 },
      { ticketId: 'T-008', unitId: 'U-004', unitNumber: 'A1', propertyName: 'Cape Point Villas', title: 'Pool Pump Malfunction', description: 'Pool pump making grinding noise and not circulating water.', status: 'Reopened', priority: 'HIGH', category: 'General', aiOriginalCategory: 'General', combinedConfidence: 0.85, conflictDetected: false, manualReviewRequired: false, assignedTo: 'Tom Wilson', assignedToId: 'PROV-003', createdBy: 'Jane Tenant', createdById: null, createdAt: new Date(now - 15 * day).toLocaleString(), updatedAt: new Date(now - 6 * 3600 * 1000).toLocaleString(), images: [], slaResponseBefore: now - 15 * day + 60 * 60 * 1000, slaResolutionBefore: now - 15 * day + 480 * 60 * 1000 },
      { ticketId: 'T-009', unitId: 'U-004', unitNumber: 'A1', propertyName: 'Cape Point Villas', title: 'Security Gate Malfunction', description: 'The automatic security gate is not closing properly, safety hazard.', status: 'Escalated', priority: 'EMERGENCY', category: 'Electrical', aiOriginalCategory: 'Electrical', combinedConfidence: 0.94, conflictDetected: false, manualReviewRequired: false, assignedTo: 'Jane Smith', assignedToId: 'PROV-002', createdBy: 'Jane Tenant', createdById: null, createdAt: new Date(now - 7 * day).toLocaleString(), updatedAt: new Date(now - 1 * day).toLocaleString(), images: [], slaResponseBefore: now - 7 * day + 15 * 60 * 1000, slaResolutionBefore: now - 7 * day + 120 * 60 * 1000 },
      { ticketId: 'T-010', unitId: 'U-002', unitNumber: '102', propertyName: 'Sandton Heights', title: 'Smoke Detector Beeping', description: 'Smoke detector battery low, constant beeping every 30 seconds.', status: 'Closed', priority: 'LOW', category: 'General', aiOriginalCategory: 'General', combinedConfidence: 0.97, conflictDetected: false, manualReviewRequired: false, assignedTo: 'Mike Provider', assignedToId: 'PROV-001', createdBy: 'John Tenant', createdById: 'USR-001', createdAt: new Date(now - 30 * day).toLocaleString(), updatedAt: new Date(now - 25 * day).toLocaleString(), images: [], slaResponseBefore: now - 30 * day + 720 * 60 * 1000, slaResolutionBefore: now - 30 * day + 10080 * 60 * 1000 },
    ],
    categories: [
      { id: 'CAT-001', name: 'Plumbing', description: 'Water, pipe, faucet, and drainage issues', defaultPriority: 'HIGH', aiKeywords: ['leak', 'pipe', 'faucet', 'drain', 'water'], rekognitionLabel: 'Plumbing' },
      { id: 'CAT-002', name: 'Electrical', description: 'Power, wiring, socket, and lighting issues', defaultPriority: 'HIGH', aiKeywords: ['socket', 'power', 'light', 'wire', 'electric'], rekognitionLabel: 'Electrical' },
      { id: 'CAT-003', name: 'HVAC', description: 'Heating, ventilation, and air conditioning', defaultPriority: 'MEDIUM', aiKeywords: ['ac', 'heating', 'ventilation', 'aircon', 'hvac'], rekognitionLabel: 'HVAC' },
      { id: 'CAT-004', name: 'Emergency', description: 'Immediate safety or structural threats', defaultPriority: 'EMERGENCY', aiKeywords: ['gas leak', 'flooding', 'structural collapse', 'sewage overflow', 'burst pipe'], rekognitionLabel: 'Emergency' },
      { id: 'CAT-005', name: 'General', description: 'General maintenance and repairs', defaultPriority: 'LOW', aiKeywords: ['paint', 'clean', 'fix', 'repair', 'replace'], rekognitionLabel: 'General' },
    ],
    technicians: [
      { id: 'TECH-001', name: 'Mike Provider', companyName: 'FixIt Pro Services', specialisations: ['Plumbing', 'Electrical', 'HVAC'], rating: 4.5, totalJobsCompleted: 127, currentWorkload: 3, availabilityStatus: 'AVAILABLE', gpsLatitude: -26.1076, gpsLongitude: 28.0567, lastLocationUpdate: new Date(now - 30 * 60 * 1000).toISOString(), email: 'mike@fixitpro.co.za', phone: '+27 82 123 4567' },
      { id: 'TECH-002', name: 'Jane Smith', companyName: 'Smith Electrical', specialisations: ['Electrical', 'General'], rating: 4.8, totalJobsCompleted: 89, currentWorkload: 1, availabilityStatus: 'ON_CALL', gpsLatitude: -26.2041, gpsLongitude: 28.0473, lastLocationUpdate: new Date(now - 2 * 3600 * 1000).toISOString(), email: 'jane@smithelec.co.za', phone: '+27 72 987 6543' },
      { id: 'TECH-003', name: 'Tom Wilson', companyName: 'Wilson HVAC & Plumbing', specialisations: ['Plumbing', 'HVAC'], rating: 4.2, totalJobsCompleted: 203, currentWorkload: 5, availabilityStatus: 'AVAILABLE', gpsLatitude: -26.1952, gpsLongitude: 28.0346, lastLocationUpdate: new Date(now - 15 * 60 * 1000).toISOString(), email: 'tom@wilsonhvac.co.za', phone: '+27 62 345 6789' },
      { id: 'TECH-004', name: 'Sarah Connor', companyName: 'Connor Maintenance', specialisations: ['General', 'Plumbing'], rating: 1.8, totalJobsCompleted: 15, currentWorkload: 0, availabilityStatus: 'SUSPENDED', gpsLatitude: -26.1102, gpsLongitude: 28.0621, lastLocationUpdate: new Date(now - 7 * day).toISOString(), email: 'sarah@connormaint.co.za', phone: '+27 82 555 1234' },
    ],
    systemSettings: [
      { key: 'AI_TEXT_CONFIDENCE_THRESHOLD', value: 0.60, type: 'float', category: 'ai', description: 'Minimum confidence for AI text classification' },
      { key: 'AI_IMAGE_CONFIDENCE_THRESHOLD', value: 0.70, type: 'float', category: 'ai', description: 'Minimum confidence for AI image classification' },
      { key: 'AI_EMERGENCY_VISUAL_THRESHOLD', value: 0.70, type: 'float', category: 'ai', description: 'Minimum confidence for emergency visual detection' },
      { key: 'AI_TEXT_WEIGHT', value: 0.40, type: 'float', category: 'ai', description: 'Weight of text analysis in combined confidence score' },
      { key: 'AI_IMAGE_WEIGHT', value: 0.60, type: 'float', category: 'ai', description: 'Weight of image analysis in combined confidence score' },
      { key: 'IMAGE_MAX_SIZE_MB', value: 10, type: 'int', category: 'general', description: 'Maximum image upload size in megabytes' },
      { key: 'IMAGE_MAX_COUNT_PER_TICKET', value: 5, type: 'int', category: 'general', description: 'Maximum images per ticket' },
      { key: 'JWT_ACCESS_TOKEN_TTL_HOURS', value: 1, type: 'int', category: 'auth', description: 'JWT access token expiration hours' },
      { key: 'JWT_REFRESH_TOKEN_TTL_DAYS', value: 7, type: 'int', category: 'auth', description: 'JWT refresh token expiration days' },
      { key: 'MAX_LOGIN_ATTEMPTS_BEFORE_LOCK', value: 5, type: 'int', category: 'auth', description: 'Failed login attempts before account lock' },
      { key: 'S3_PRESIGNED_URL_TTL_MINUTES', value: 1440, type: 'int', category: 'aws', description: 'S3 pre-signed URL expiration (24 hours)' },
      { key: 'SLA_POLL_INTERVAL_MINUTES', value: 5, type: 'int', category: 'sla', description: 'SLA compliance cron polling interval' },
      { key: 'EMERGENCY_AUTOASSIGN_MINUTES', value: 5, type: 'int', category: 'sla', description: 'Emergency auto-assignment timeout in minutes' },
      { key: 'PROVIDER_RATING_ALERT_THRESHOLD', value: 2.0, type: 'float', category: 'provider', description: 'Minimum rating before provider alert' },
      { key: 'DB_POOL_MIN_CONNECTIONS', value: 2, type: 'int', category: 'db', description: 'Minimum database pool connections' },
      { key: 'DB_POOL_MAX_CONNECTIONS', value: 10, type: 'int', category: 'db', description: 'Maximum database pool connections' },
      { key: 'AWS_RETRY_MAX_ATTEMPTS', value: 3, type: 'int', category: 'aws', description: 'Maximum AWS SDK retry attempts' },
      { key: 'TICKET_DESCRIPTION_MIN_CHARS', value: 20, type: 'int', category: 'general', description: 'Minimum ticket description length' },
    ],
    slaConfig: [
      { priority: 'EMERGENCY', responseMinutes: 30, resolutionMinutes: 240, warningPercent: 0.80 },
      { priority: 'HIGH', responseMinutes: 60, resolutionMinutes: 480, warningPercent: 80 },
      { priority: 'MEDIUM', responseMinutes: 240, resolutionMinutes: 2880, warningPercent: 85 },
      { priority: 'LOW', responseMinutes: 720, resolutionMinutes: 10080, warningPercent: 90 },
    ],
    auditLog: [
      { id: 'AUD-001', ticketId: 'T-001', actor: 'System (AI)', action: 'STATUS_CHANGE', previousStatus: 'Open', newStatus: 'Assigned', comment: 'Auto-assigned to Mike Provider', timestamp: new Date(now - 1.5 * day).toISOString() },
      { id: 'AUD-002', ticketId: 'T-004', actor: 'System (AI)', action: 'CONFLICT_DETECTED', previousStatus: 'Open', newStatus: 'Manual Review', comment: 'AI text/vision conflict: text=Emergency(0.82), vision=General(0.45)', timestamp: new Date(now - 12 * 3600 * 1000).toISOString() },
      { id: 'AUD-003', ticketId: 'T-006', actor: 'Sarah Manager', action: 'CATEGORY_OVERRIDE', previousStatus: 'In Progress', newStatus: 'In Progress', comment: 'PM override: ai_original_category=General → category=Plumbing (BR-006)', timestamp: new Date(now - 3 * day).toISOString() },
      { id: 'AUD-004', ticketId: 'T-008', actor: 'Tenant Portal', action: 'REOPENED', previousStatus: 'Closed', newStatus: 'Reopened', comment: 'Tenant reported issue persists. Justification: Pool pump still not working after repair.', timestamp: new Date(now - 6 * 3600 * 1000).toISOString() },
      { id: 'AUD-005', ticketId: 'T-009', actor: 'System (SLA)', action: 'ESCALATED', previousStatus: 'Assigned', newStatus: 'Escalated', comment: 'SLA breach: no status update within 60 minutes for HIGH priority', timestamp: new Date(now - 3 * day).toISOString() },
    ],
    securityAuditLog: [
      { id: 'SEC-001', userId: 'USR-001', username: 'admin', eventType: 'LOGIN_SUCCESS', ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0 (Windows NT 10.0)', timestamp: new Date(now - 3600 * 1000).toISOString() },
      { id: 'SEC-002', userId: 'USR-002', username: 'sarah.manager', eventType: 'LOGIN_SUCCESS', ipAddress: '192.168.1.101', userAgent: 'Mozilla/5.0 (Windows NT 10.0)', timestamp: new Date(now - 2 * 3600 * 1000).toISOString() },
      { id: 'SEC-003', userId: null, username: 'unknown', eventType: 'LOGIN_FAIL', ipAddress: '10.0.0.55', userAgent: 'python-requests/2.28', timestamp: new Date(now - 3600 * 1000).toISOString() },
      { id: 'SEC-004', userId: 'USR-002', username: 'sarah.manager', eventType: 'ACCOUNT_LOCKED', ipAddress: '192.168.1.101', userAgent: 'Mozilla/5.0 (Windows NT 10.0)', timestamp: new Date(now - 30 * 60 * 1000).toISOString() },
      { id: 'SEC-005', userId: 'USR-001', username: 'admin', eventType: 'PASSWORD_RESET', ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0 (Windows NT 10.0)', timestamp: new Date(now - 7 * day).toISOString() },
      { id: 'SEC-006', userId: 'USR-002', username: 'sarah.manager', eventType: 'ACCOUNT_UNLOCKED', ipAddress: '192.168.1.100', userAgent: 'Admin Console', timestamp: new Date(now - 15 * 60 * 1000).toISOString() },
      { id: 'SEC-007', userId: 'USR-001', username: 'admin', eventType: 'LOGOUT', ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0 (Windows NT 10.0)', timestamp: new Date(now - 5 * 60 * 1000).toISOString() },
      { id: 'SEC-008', userId: 'USR-003', username: 'john.tenant', eventType: 'LOGIN_SUCCESS', ipAddress: '192.168.1.200', userAgent: 'Mozilla/5.0 (Linux; Android 13)', timestamp: new Date(now - 10 * 60 * 1000).toISOString() },
    ],
    notifications: [
      { id: 'NOT-001', recipient: 'admin@spmt.com', type: 'email', message: 'SLA breach: T-009 (Security Gate) escalated - no response within 60 min', deliveryStatus: 'Sent', retryCount: 0, createdAt: new Date(now - 3 * day).toISOString(), isEmergency: true },
      { id: 'NOT-002', recipient: 'admin@spmt.com', type: 'push', message: 'Manual review required: T-004 (Broken Window) - AI conflict detected', deliveryStatus: 'Delivered', retryCount: 0, createdAt: new Date(now - 12 * 3600 * 1000).toISOString(), isEmergency: false },
      { id: 'NOT-003', recipient: 'sarah@spmt.com', type: 'email', message: 'New ticket T-007 assigned to your property', deliveryStatus: 'Sent', retryCount: 0, createdAt: new Date(now - 3 * day).toISOString(), isEmergency: false },
      { id: 'NOT-004', recipient: 'mike@spmt.com', type: 'push', message: 'New assignment: T-005 (Gas Stove) - EMERGENCY priority', deliveryStatus: 'Pending', retryCount: 2, createdAt: new Date(now - 1 * day).toISOString(), isEmergency: false },
      { id: 'NOT-005', recipient: 'admin@spmt.com', type: 'email', message: 'EMERGENCY: T-009 delivery failed - immediate attention required', deliveryStatus: 'Failed', retryCount: 3, createdAt: new Date(now - 6 * 3600 * 1000).toISOString(), isEmergency: true },
    ],
    aiInferenceLog: [
      { id: 'INF-001', ticketId: 'T-001', adapter: 'Comprehend', inputType: 'text', confidence: 0.87, result: 'Plumbing', latencyMs: 245, timestamp: new Date(now - 2 * day).toISOString(), conflictDetected: false },
      { id: 'INF-002', ticketId: 'T-004', adapter: 'Comprehend', inputType: 'text', confidence: 0.82, result: 'Emergency', latencyMs: 312, timestamp: new Date(now - 12.5 * 3600 * 1000).toISOString(), conflictDetected: true },
      { id: 'INF-003', ticketId: 'T-004', adapter: 'Rekognition', inputType: 'image', confidence: 0.45, result: 'General', latencyMs: 890, timestamp: new Date(now - 12.5 * 3600 * 1000).toISOString(), conflictDetected: true },
      { id: 'INF-004', ticketId: 'T-006', adapter: 'Comprehend', inputType: 'text', confidence: 0.65, result: 'General', latencyMs: 198, timestamp: new Date(now - 10 * day).toISOString(), conflictDetected: true },
      { id: 'INF-005', ticketId: 'T-006', adapter: 'Rekognition', inputType: 'image', confidence: 0.72, result: 'Plumbing', latencyMs: 756, timestamp: new Date(now - 10 * day).toISOString(), conflictDetected: true },
    ],
  };
};

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
    if (!parsed[field]) parsed[field] = defaults[field];
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
