import { Roles, RoleLabels } from '../../shared/constants/roles.js';

const ROLE_DEFINITIONS = [
  {
    id: Roles.SYSTEM_ADMIN,
    name: RoleLabels[Roles.SYSTEM_ADMIN],
    description: 'Full system access — manage users, properties, units, tickets, settings, backups, audits, and AI configuration. Can change user roles, approve registrations, and export reports.',
    permissions: 'All system permissions granted',
  },
  {
    id: Roles.PROPERTY_MANAGER,
    name: RoleLabels[Roles.PROPERTY_MANAGER],
    description: 'Manage properties, units, tickets, and technicians. Assign and escalate tickets, approve or reject completed work, view reports and analytics, export data.',
    permissions: 'Tickets, Properties, Units, Reports, Analytics, Activity, Audit',
  },
  {
    id: Roles.TENANT,
    name: RoleLabels[Roles.TENANT],
    description: 'Create maintenance tickets for your unit, view own ticket status and history, rate completed work, update your profile.',
    permissions: 'Create tickets, view own tickets, rate work',
  },
  {
    id: Roles.SERVICE_PROVIDER,
    name: RoleLabels[Roles.SERVICE_PROVIDER],
    description: 'View assigned tickets, update job status (accept, complete), manage availability schedule, add job notes.',
    permissions: 'View assigned tickets, update status, manage availability',
  },
];

const getRoles = async (req, res, next) => {
  try {
    res.json({ success: true, data: { roles: ROLE_DEFINITIONS } });
  } catch (err) { next(err); }
};

export { getRoles };
