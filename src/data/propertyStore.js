import { getStore, saveToLocalStorage, isAllowedText } from './storeCore';

let propertyCounter = getStore().properties.length + 1;
let unitCounter = getStore().units.length + 1;

export const addProperty = (name, address, propertyType, managerName) => {
  const store = getStore();
  if (!name?.trim() || !address?.trim()) return { success: false, error: 'Property name and address are required.' };
  if (!isAllowedText(name) || !isAllowedText(address) || (managerName && !isAllowedText(managerName))) return { success: false, error: 'Only letters, numbers, spaces, hyphens, and underscores are allowed.' };
  if (store.properties.some(p => p.name.toLowerCase() === name.trim().toLowerCase())) return { success: false, error: `Property "${name}" already exists.` };
  const newProperty = { propertyId: `P-${String(propertyCounter++).padStart(3, '0')}`, name: name.trim(), address: address.trim(), propertyType: propertyType || 'RESIDENTIAL', status: 'ACTIVE', managerName: managerName || 'Property Manager', createdAt: new Date().toLocaleString() };
  store.properties.push(newProperty);
  saveToLocalStorage();
  return { success: true, data: newProperty };
};

export const getProperties = () => [...getStore().properties];

export const updateProperty = (propertyId, updates) => {
  const store = getStore();
  const property = store.properties.find(p => p.propertyId === propertyId);
  if (!property) return { success: false, error: 'Property not found.' };
  if (updates.name) {
    if (!isAllowedText(updates.name)) return { success: false, error: 'Only letters, numbers, spaces, hyphens, and underscores are allowed.' };
    if (store.properties.some(p => p.name.toLowerCase() === updates.name.trim().toLowerCase() && p.propertyId !== propertyId)) return { success: false, error: `Property "${updates.name}" already exists.` };
    property.name = updates.name.trim();
  }
  if (updates.address) property.address = updates.address.trim();
  if (updates.propertyType) property.propertyType = updates.propertyType;
  if (updates.status) property.status = updates.status;
  if (updates.managerName) property.managerName = updates.managerName;
  saveToLocalStorage();
  return { success: true, data: { ...property } };
};

export const updatePropertyStatus = (propertyId, newStatus) => {
  const store = getStore();
  const property = store.properties.find(p => p.propertyId === propertyId);
  if (!property) return { success: false, error: 'Property not found.' };
  if (newStatus === 'INACTIVE') {
    const activeUnits = store.units.filter(u => u.propertyId === propertyId && u.status === 'OCCUPIED');
    if (activeUnits.length > 0) return { success: false, error: `Cannot deactivate property: ${activeUnits.length} unit(s) are currently occupied. Vacate units first.`, activeUnitCount: activeUnits.length };
  }
  property.status = newStatus;
  saveToLocalStorage();
  return { success: true, data: { ...property } };
};

export const deleteProperty = (propertyId) => {
  const store = getStore();
  if (store.units.some(u => u.propertyId === propertyId)) return { success: false, error: 'Cannot delete property with existing units. Remove units first.' };
  store.properties = store.properties.filter(p => p.propertyId !== propertyId);
  saveToLocalStorage();
  return { success: true };
};

export const addUnit = (propertyId, unitNumber, floor) => {
  const store = getStore();
  const property = store.properties.find(p => p.propertyId === propertyId);
  if (!property) return { success: false, error: 'Property does not exist.' };
  if (store.units.some(u => u.propertyId === propertyId && u.unitNumber === unitNumber.trim())) return { success: false, error: `Unit ${unitNumber} already exists in this property.` };
  const newUnit = { unitId: `U-${String(unitCounter++).padStart(3, '0')}`, propertyId, unitNumber: unitNumber.trim(), floor: floor || null, status: 'VACANT', tenantName: null };
  store.units.push(newUnit);
  saveToLocalStorage();
  return { success: true, data: newUnit };
};

export const getUnits = () => {
  const store = getStore();
  return store.units.map(unit => ({ ...unit, propertyName: store.properties.find(p => p.propertyId === unit.propertyId)?.name }));
};

export const getUnitById = (unitId) => {
  const store = getStore();
  const unit = store.units.find(u => u.unitId === unitId);
  if (!unit) return null;
  return { ...unit, propertyName: store.properties.find(p => p.propertyId === unit.propertyId)?.name };
};

export const assignTenantToUnit = (unitId, tenantName) => {
  const store = getStore();
  const unit = store.units.find(u => u.unitId === unitId);
  if (!unit) return { success: false, error: 'Unit not found.' };
  if (unit.status === 'OCCUPIED' && unit.tenantName) return { success: false, statusCode: 409, error: `BR-001 violation: Unit ${unit.unitNumber} is already occupied by ${unit.tenantName}. One tenant per unit.` };
  if (store.units.some(u => u.tenantName === tenantName && u.unitId !== unitId && u.status === 'OCCUPIED')) return { success: false, statusCode: 409, error: `BR-001 violation: ${tenantName} is already assigned to another unit. A tenant may only occupy one unit.` };
  unit.tenantName = tenantName;
  unit.status = 'OCCUPIED';
  saveToLocalStorage();
  return { success: true, data: { ...unit } };
};

export const vacateUnit = (unitId) => {
  const store = getStore();
  const unit = store.units.find(u => u.unitId === unitId);
  if (!unit) return { success: false, error: 'Unit not found.' };
  if (unit.status === 'VACANT') return { success: false, error: 'Unit is already vacant.' };
  unit.tenantName = null;
  unit.status = 'VACANT';
  saveToLocalStorage();
  return { success: true, data: { ...unit } };
};

export const updateUnit = (unitId, updates) => {
  const store = getStore();
  const unit = store.units.find(u => u.unitId === unitId);
  if (!unit) return { success: false, error: 'Unit not found.' };
  if (updates.unitNumber !== undefined) {
    if (store.units.some(u => u.propertyId === unit.propertyId && u.unitNumber === updates.unitNumber.trim() && u.unitId !== unitId)) return { success: false, error: `Unit ${updates.unitNumber} already exists in this property.` };
    unit.unitNumber = updates.unitNumber.trim();
  }
  if (updates.floor !== undefined) unit.floor = updates.floor;
  saveToLocalStorage();
  return { success: true, data: { ...unit } };
};

export const deleteUnit = (unitId) => {
  const store = getStore();
  const unit = store.units.find(u => u.unitId === unitId);
  if (!unit) return { success: false, error: 'Unit not found.' };
  if (unit.status === 'OCCUPIED') return { success: false, error: `Cannot delete unit ${unit.unitNumber}: unit is occupied by ${unit.tenantName}. Vacate the unit first.` };
  const unitTickets = store.tickets.filter(t => t.unitId === unitId);
  if (unitTickets.length > 0) return { success: false, error: `Cannot delete unit ${unit.unitNumber}: ${unitTickets.length} ticket(s) reference this unit. Remove tickets first.` };
  store.units = store.units.filter(u => u.unitId !== unitId);
  saveToLocalStorage();
  return { success: true };
};
