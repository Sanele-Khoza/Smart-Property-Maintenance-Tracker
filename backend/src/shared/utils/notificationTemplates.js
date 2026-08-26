import config from '../../config/index.js';

const BASE_URL = config.frontendUrl || 'http://localhost:3000';

const STATUS_COLORS = {
  'New': '#3b82f6',
  'Assigned': '#6366f1',
  'Accepted': '#8b5cf6',
  'In Progress': '#f59e0b',
  'Waiting for Parts': '#f97316',
  'Completed': '#10b981',
  'Tenant Confirmed': '#059669',
  'Closed': '#6b7280',
  'Reopened': '#ef4444',
  'Cancelled': '#6b7280',
  'ESCALATED': '#dc2626',
  'Manual Review': '#a855f7',
  'AI Classified': '#6366f1',
  'Declined': '#ef4444',
};

function buildShell(title, headerColor, bodyHtml) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${headerColor};padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">SPMT</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Service Provider Management Tool</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">This is an automated notification from SPMT. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailRow(label, value) {
  return `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:120px;vertical-align:top;">${label}</td><td style="padding:6px 0;color:#1f2937;font-size:13px;">${value || '—'}</td></tr>`;
}

function ctaButton(text, url, color) {
  return `
<div style="margin:24px 0 8px;">
  <a href="${url}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">${text}</a>
</div>`;
}

function ticketCreatedForManager({ managerName, ticket, propertyUrl }) {
  const headerColor = '#3b82f6';
  const btnUrl = propertyUrl || BASE_URL;
  const body = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:18px;">New Ticket Submitted</h2>
    <p style="margin:0 0 20px;color:#4b5563;font-size:14px;">Hi ${managerName},</p>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">A new maintenance ticket has been submitted for your property and requires your attention.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${detailRow('Title', ticket.title)}
      ${detailRow('Description', ticket.description ? (ticket.description.length > 120 ? ticket.description.substring(0, 120) + '...' : ticket.description) : null)}
      ${detailRow('Category', ticket.category)}
      ${detailRow('Priority', `<span style="color:${ticket.priority === 'EMERGENCY' ? '#dc2626' : '#d97706'};font-weight:600;">${ticket.priority || 'MEDIUM'}</span>`)}
      ${detailRow('Property', ticket.property_name)}
      ${detailRow('Unit', ticket.unit_number)}
      ${detailRow('Ticket ID', `<span style="font-family:monospace;font-size:12px;">${ticket.id}</span>`)}
    </table>
    <p style="margin:0 0 8px;color:#4b5563;font-size:14px;">Log in to review and assign a service provider.</p>
    ${ctaButton('View Ticket', btnUrl, headerColor)}
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">Or copy this link: <a href="${btnUrl}" style="color:#3b82f6;">${btnUrl}</a></p>`;
  return {
    subject: `[SPMT] New Ticket: ${ticket.title}`,
    html: buildShell('New Ticket Submitted', headerColor, body),
  };
}

function ticketAssignedToProvider({ providerName, ticket, providerUrl }) {
  const headerColor = '#6366f1';
  const btnUrl = providerUrl || BASE_URL;
  const body = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:18px;">You Have a New Assignment</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">Hello ${providerName},</p>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">You have been assigned a new maintenance ticket. Please review the details below and accept or decline the assignment.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${detailRow('Title', ticket.title)}
      ${detailRow('Description', ticket.description ? (ticket.description.length > 120 ? ticket.description.substring(0, 120) + '...' : ticket.description) : null)}
      ${detailRow('Category', ticket.category)}
      ${detailRow('Priority', `<span style="color:${ticket.priority === 'EMERGENCY' ? '#dc2626' : '#d97706'};font-weight:600;">${ticket.priority || 'MEDIUM'}</span>`)}
      ${detailRow('Property', ticket.property_name)}
      ${detailRow('Unit', ticket.unit_number)}
      ${detailRow('Ticket ID', `<span style="font-family:monospace;font-size:12px;">${ticket.id}</span>`)}
    </table>
    <p style="margin:0 0 8px;color:#4b5563;font-size:14px;">Please accept this assignment at your earliest convenience.</p>
    ${ctaButton('View Assignment', btnUrl, headerColor)}
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">Or copy this link: <a href="${btnUrl}" style="color:#6366f1;">${btnUrl}</a></p>`;
  return {
    subject: `[SPMT] Ticket Assigned: ${ticket.title}`,
    html: buildShell('New Ticket Assignment', headerColor, body),
  };
}

function ticketStatusChangedForTenant({ tenantName, ticket, newStatus, previousStatus, reason }) {
  const statusColor = STATUS_COLORS[newStatus] || '#6b7280';
  const btnUrl = BASE_URL;
  const body = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:18px;">Ticket Status Updated</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">Hi ${tenantName},</p>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">The status of your maintenance ticket has been updated.</p>
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${detailRow('Title', ticket.title)}
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;width:120px;vertical-align:top;">Status</td>
          <td style="padding:6px 0;font-size:13px;">
            <span style="background:${statusColor};color:#ffffff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">${newStatus}</span>
            ${previousStatus ? `<span style="color:#9ca3af;font-size:12px;margin-left:8px;">was: ${previousStatus}</span>` : ''}
          </td>
        </tr>
        ${reason ? detailRow('Reason', reason) : ''}
        ${detailRow('Property', ticket.property_name)}
        ${detailRow('Unit', ticket.unit_number)}
        ${detailRow('Ticket ID', `<span style="font-family:monospace;font-size:12px;">${ticket.id}</span>`)}
      </table>
    </div>
    ${ctaButton('View Ticket', btnUrl, statusColor)}
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">Or copy this link: <a href="${btnUrl}" style="color:${statusColor};">${btnUrl}</a></p>`;
  return {
    subject: `[SPMT] Ticket ${newStatus}: ${ticket.title}`,
    html: buildShell('Ticket Status Updated', statusColor, body),
  };
}

function unitAssignedToTenant({ tenantName, unit, property }) {
  const headerColor = '#059669';
  const btnUrl = BASE_URL;
  const body = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:18px;">Property Unit Assigned</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">Hi ${tenantName},</p>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">You have been assigned a unit at the following property. Welcome!</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${detailRow('Property', property.name)}
      ${detailRow('Address', property.address)}
      ${detailRow('Unit', unit.unit_number)}
      ${detailRow('Type', unit.type)}
      ${detailRow('Bedrooms', unit.bedrooms)}
      ${detailRow('Bathrooms', unit.bathrooms)}
      ${detailRow('Size', unit.size_sqm ? unit.size_sqm + ' m²' : null)}
    </table>
    <p style="margin:0 0 8px;color:#4b5563;font-size:14px;">Log in to view your property details and submit maintenance requests.</p>
    ${ctaButton('View My Property', btnUrl, headerColor)}
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">Or copy this link: <a href="${btnUrl}" style="color:#059669;">${btnUrl}</a></p>`;
  return {
    subject: `[SPMT] Unit Assigned: ${property.name} - ${unit.unit_number}`,
    html: buildShell('Property Unit Assigned', headerColor, body),
  };
}

function unitAssignedToManager({ managerName, unit, property, tenantName }) {
  const headerColor = '#3b82f6';
  const btnUrl = BASE_URL;
  const body = `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:18px;">New Tenant Assigned</h2>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">Hi ${managerName},</p>
    <p style="margin:0 0 16px;color:#4b5563;font-size:14px;">A new tenant has been assigned to a unit at your property.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:20px;">
      ${detailRow('Property', property.name)}
      ${detailRow('Unit', unit.unit_number)}
      ${detailRow('Tenant', tenantName)}
    </table>
    ${ctaButton('View Property', btnUrl, headerColor)}
    <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">Or copy this link: <a href="${btnUrl}" style="color:#3b82f6;">${btnUrl}</a></p>`;
  return {
    subject: `[SPMT] New Tenant at ${property.name} - ${unit.unit_number}`,
    html: buildShell('New Tenant Assigned', headerColor, body),
  };
}

export {
  ticketCreatedForManager,
  ticketAssignedToProvider,
  ticketStatusChangedForTenant,
  unitAssignedToTenant,
  unitAssignedToManager,
};
