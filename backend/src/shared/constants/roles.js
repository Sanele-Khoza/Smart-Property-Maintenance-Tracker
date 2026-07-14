const Roles = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  ADMIN: 'ADMIN',
  PROPERTY_MANAGER: 'PROPERTY_MANAGER',
  TENANT: 'TENANT',
  SERVICE_PROVIDER: 'SERVICE_PROVIDER',
  GUEST: 'GUEST',
};

const RoleHierarchy = {
  [Roles.SYSTEM_ADMIN]: 0,
  [Roles.ADMIN]: 1,
  [Roles.PROPERTY_MANAGER]: 2,
  [Roles.SERVICE_PROVIDER]: 3,
  [Roles.TENANT]: 4,
  [Roles.GUEST]: 5,
};

const RoleLabels = {
  [Roles.SYSTEM_ADMIN]: 'System Admin',
  [Roles.ADMIN]: 'Admin',
  [Roles.PROPERTY_MANAGER]: 'Property Manager',
  [Roles.TENANT]: 'Tenant',
  [Roles.SERVICE_PROVIDER]: 'Service Provider',
  [Roles.GUEST]: 'Guest',
};

export { Roles, RoleHierarchy, RoleLabels };
