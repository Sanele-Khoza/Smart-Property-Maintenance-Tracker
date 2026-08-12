import { jest } from '@jest/globals';

const mockFindById = jest.fn();
const mockFindAll = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockAddHistory = jest.fn();
const mockGetHistory = jest.fn();
const mockGetComments = jest.fn();
const mockAddComment = jest.fn();
const mockAddRating = jest.fn();
const mockGetOverdueTickets = jest.fn();
const mockGetAttachmentsForTickets = jest.fn();
const mockFindByIdIncludingDeleted = jest.fn();
const mockSoftDelete = jest.fn();
const mockRestore = jest.fn();
const mockFindTechnician = jest.fn();
const mockQuery = jest.fn();
const mockGetPresignedUrl = jest.fn();

jest.unstable_mockModule('../modules/tickets/tickets.repository.js', () => ({
  findById: mockFindById,
  findAll: mockFindAll,
  create: mockCreate,
  update: mockUpdate,
  addHistory: mockAddHistory,
  getHistory: mockGetHistory,
  getComments: mockGetComments,
  addComment: mockAddComment,
  addRating: mockAddRating,
  getOverdueTickets: mockGetOverdueTickets,
  getAttachmentsForTickets: mockGetAttachmentsForTickets,
  findByIdIncludingDeleted: mockFindByIdIncludingDeleted,
  softDelete: mockSoftDelete,
  restore: mockRestore,
}));

jest.unstable_mockModule('../modules/technicians/technicians.repository.js', () => ({
  findById: mockFindTechnician,
}));

jest.unstable_mockModule('../db/connection.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../shared/adapters/s3Adapter.js', () => ({
  getPresignedUrl: mockGetPresignedUrl,
}));

const {
  list, getById, create, assign, complete, reopen, rate,
  acceptTicket, startWork, markWaitingParts, markPartsReceived,
  tenantConfirm, closeTicket, softDelete, restore,
} = await import('../modules/tickets/tickets.service.js');

describe('Ticket Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
    mockGetAttachmentsForTickets.mockResolvedValue([]);
  });

  describe('list', () => {
    it('should return tickets', async () => {
      const tickets = { tickets: [{ id: 1, title: 'Test' }], total: 1 };
      mockFindAll.mockResolvedValue(tickets);

      const result = await list({});
      expect(result.pagination.total).toBe(1);
      expect(result.data.tickets[0].title).toBe('Test');
    });
  });

  describe('getById', () => {
    it('should return ticket with history and comments', async () => {
      mockFindById.mockResolvedValue({ id: 1, title: 'Test' });
      mockGetHistory.mockResolvedValue([{ id: 1, status: 'New' }]);
      mockGetComments.mockResolvedValue([]);

      const result = await getById(1);
      expect(result.data.ticket.title).toBe('Test');
      expect(result.data.history).toHaveLength(1);
    });

    it('should throw not found', async () => {
      mockFindById.mockResolvedValue(null);
      await expect(getById(999)).rejects.toThrow('Ticket not found');
    });
  });

  describe('create', () => {
    it('should create ticket with New status and add history', async () => {
      mockCreate.mockResolvedValue({ id: 1, status: 'New', title: 'New ticket' });

      const result = await create({ title: 'New ticket', description: 'Desc' }, 1);
      expect(result.data.ticket.title).toBe('New ticket');
      expect(result.data.ticket.status).toBe('New');
      expect(mockAddHistory).toHaveBeenCalled();
    });
  });

  describe('assign', () => {
    it('should assign ticket from AI Classified', async () => {
      mockFindById.mockResolvedValue({ id: 1, status: 'AI Classified' });
      mockFindTechnician.mockResolvedValue({ id: 1, name: 'Bob' });
      mockUpdate.mockResolvedValue({ id: 1, assigned_to_id: 1 });

      await assign(1, 1, 'Urgent', 1, 'Admin', 'PROPERTY_MANAGER');
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockAddHistory).toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('should complete in-progress ticket', async () => {
      mockFindById.mockResolvedValue({ id: 1, status: 'In Progress', tenant_id: 1 });
      mockUpdate.mockResolvedValue({ id: 1, status: 'Completed' });

      const result = await complete(1, 1);
      expect(result.data.ticket.status).toBe('Completed');
    });
  });

  describe('reopen', () => {
    it('should reopen completed ticket', async () => {
      mockFindById.mockResolvedValue({ id: 1, status: 'Completed' });
      mockUpdate.mockResolvedValue({ id: 1, status: 'Reopened' });

      const result = await reopen(1, 'Still broken', 1);
      expect(result.data.ticket.status).toBe('Reopened');
    });
  });

  describe('rate', () => {
    it('should allow tenant to rate their ticket', async () => {
      mockFindById.mockResolvedValue({ id: 1, status: 'Completed', tenant_id: 1 });

      await rate(1, 1, 5, 'Great');
      expect(mockAddRating).toHaveBeenCalled();
    });

    it('should block other users from rating', async () => {
      mockFindById.mockResolvedValue({ id: 1, status: 'Completed', tenant_id: 1 });

      await expect(rate(1, 2, 5, 'Nope')).rejects.toThrow('Only the ticket creator can rate');
    });
  });

  describe('softDelete / restore', () => {
    it('should move a ticket to trash', async () => {
      mockFindById.mockResolvedValue({ id: 1, status: 'In Progress', title: 'Leak' });
      mockSoftDelete.mockResolvedValue({ id: 1, deleted_at: new Date().toISOString() });

      const result = await softDelete(1, 2, 'Jane Doe');
      expect(mockSoftDelete).toHaveBeenCalledWith(1, 2);
      expect(result.message).toContain('trash');
      expect(mockAddHistory).toHaveBeenCalledWith(1, 'In Progress', 2, 'Jane Doe', 'Ticket moved to trash');
    });

    it('should throw not found when deleting a missing ticket', async () => {
      mockFindById.mockResolvedValue(null);
      await expect(softDelete(999, 2, 'Jane')).rejects.toThrow('Ticket not found');
    });

    it('should restore a trashed ticket', async () => {
      mockFindByIdIncludingDeleted.mockResolvedValue({ id: 1, status: 'In Progress', deleted_at: new Date().toISOString() });
      mockRestore.mockResolvedValue({ id: 1, status: 'In Progress', deleted_at: null });

      const result = await restore(1, 2, 'Jane Doe');
      expect(result.message).toContain('restored');
      expect(mockRestore).toHaveBeenCalledWith(1);
    });

    it('should reject restoring a ticket not in trash', async () => {
      mockFindByIdIncludingDeleted.mockResolvedValue({ id: 1, status: 'In Progress', deleted_at: null });
      await expect(restore(1, 2, 'Jane')).rejects.toThrow('Ticket is not in trash');
    });
  });
});

describe('Ticket Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it('acceptTicket transitions from Assigned to Accepted', async () => {
    mockFindById.mockResolvedValue({ id: 1, status: 'Assigned', tenant_id: 1 });
    mockUpdate.mockResolvedValue({ id: 1, status: 'Accepted' });

    const result = await acceptTicket(1, 1, 'Bob', 'On it');
    expect(result.data.ticket.status).toBe('Accepted');
    expect(mockAddHistory).toHaveBeenCalledWith(1, 'Accepted', 1, 'Bob', 'On it');
  });

  it('acceptTicket rejects invalid transition', async () => {
    mockFindById.mockResolvedValue({ id: 1, status: 'New', tenant_id: 1 });
    await expect(acceptTicket(1, 1, 'Bob')).rejects.toThrow('Cannot transition');
  });

  it('startWork transitions from Accepted to In Progress', async () => {
    mockFindById.mockResolvedValue({ id: 1, status: 'Accepted', tenant_id: 1 });
    mockUpdate.mockResolvedValue({ id: 1, status: 'In Progress' });

    const result = await startWork(1, 1, 'Bob', 'Starting now');
    expect(result.data.ticket.status).toBe('In Progress');
  });

  it('markWaitingParts transitions from In Progress to Waiting for Parts', async () => {
    mockFindById.mockResolvedValue({ id: 1, status: 'In Progress', tenant_id: 1 });
    mockUpdate.mockResolvedValue({ id: 1, status: 'Waiting for Parts' });

    const result = await markWaitingParts(1, 1, 'Bob', 'Need a part');
    expect(result.data.ticket.status).toBe('Waiting for Parts');
  });

  it('markPartsReceived transitions back to In Progress', async () => {
    mockFindById.mockResolvedValue({ id: 1, status: 'Waiting for Parts', tenant_id: 1 });
    mockUpdate.mockResolvedValue({ id: 1, status: 'In Progress' });

    const result = await markPartsReceived(1, 1, 'Bob', 'Part arrived');
    expect(result.data.ticket.status).toBe('In Progress');
  });

  it('tenantConfirm transitions from Completed to Tenant Confirmed', async () => {
    mockFindById.mockResolvedValue({ id: 1, status: 'Completed', tenant_id: 1 });
    mockUpdate.mockResolvedValue({ id: 1, status: 'Tenant Confirmed' });

    const result = await tenantConfirm(1, 1, 'Tenant', true, 'Looks good');
    expect(result.data.ticket.status).toBe('Tenant Confirmed');
  });

  it('tenantConfirm with satisfied=false reopens the ticket', async () => {
    mockFindById.mockResolvedValue({ id: 1, status: 'Completed', tenant_id: 1 });
    mockUpdate.mockResolvedValue({ id: 1, status: 'Reopened' });

    const result = await tenantConfirm(1, 1, 'Tenant', false, 'Still broken');
    expect(result.message).toContain('reopened');
  });

  it('closeTicket transitions from Tenant Confirmed to Closed', async () => {
    mockFindById.mockResolvedValue({ id: 1, status: 'Tenant Confirmed', tenant_id: 1 });
    mockUpdate.mockResolvedValue({ id: 1, status: 'Closed' });

    const result = await closeTicket(1, 1, 'Admin', 'Done');
    expect(result.data.ticket.status).toBe('Closed');
  });

  it('blocks transitions on terminal tickets', async () => {
    mockFindById.mockResolvedValue({ id: 1, status: 'Closed', tenant_id: 1 });
    await expect(closeTicket(1, 1, 'Admin')).rejects.toThrow('cannot be modified');
  });

  it('blocks transitions on cancelled tickets', async () => {
    mockFindById.mockResolvedValue({ id: 1, status: 'Cancelled', tenant_id: 1 });
    await expect(complete(1, 1)).rejects.toThrow('cannot be modified');
  });
});
