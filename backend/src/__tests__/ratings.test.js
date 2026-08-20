import { jest } from '@jest/globals';

const mockFindTicket = jest.fn();
const mockFindExistingRating = jest.fn();
const mockCreateRatingWithSync = jest.fn();
const mockListRatings = jest.fn();

jest.unstable_mockModule('../modules/ratings/ratings.repository.js', () => ({
  findTicket: mockFindTicket,
  findExistingRating: mockFindExistingRating,
  createRatingWithSync: mockCreateRatingWithSync,
  listRatings: mockListRatings,
}));

const { createRating, listRatings, computeFinalRating } = await import('../modules/ratings/ratings.service.js');

describe('computeFinalRating formula', () => {
  test('combines the old rating (weighted by count) with the new score', () => {
    expect(computeFinalRating(4.5, 1, 5)).toEqual({ rating: 4.75, ratingCount: 2 });
  });

  test('one prior rating: (old + new) / 2', () => {
    expect(computeFinalRating(4.0, 1, 5)).toEqual({ rating: 4.5, ratingCount: 2 });
  });

  test('old rating dominates as the count grows', () => {
    expect(computeFinalRating(4.0, 9, 5)).toEqual({ rating: 4.1, ratingCount: 10 });
  });

  test('rounds the final rating to two decimal places', () => {
    expect(computeFinalRating(3.5, 2, 4)).toEqual({ rating: 3.67, ratingCount: 3 });
  });

  test('no prior rating: the new score becomes the rating', () => {
    expect(computeFinalRating(0, 0, 3)).toEqual({ rating: 3, ratingCount: 1 });
  });
});

describe('createRating service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('syncs the provider rating and returns the final rating', async () => {
    mockFindTicket.mockResolvedValue({ id: 't1', tenant_id: 'u1', status: 'Tenant Confirmed', assigned_to: 'sp1' });
    mockFindExistingRating.mockResolvedValue(null);
    mockCreateRatingWithSync.mockResolvedValue({
      created: { rating: 5, comment: 'Great work' },
      provider: { rating: 4.75, rating_count: 2 },
    });

    const result = await createRating('u1', { ticketId: 't1', rating: 5, comment: 'Great work' });

    expect(mockCreateRatingWithSync).toHaveBeenCalledWith({
      ticketId: 't1',
      userId: 'u1',
      rating: 5,
      comment: 'Great work',
      providerId: 'sp1',
    });
    expect(result).toMatchObject({ rating: 5, finalRating: 4.75, ratingCount: 2 });
  });

  test('returns the plain rating when the ticket has no provider', async () => {
    mockFindTicket.mockResolvedValue({ id: 't1', tenant_id: 'u1', status: 'Tenant Confirmed', assigned_to: null });
    mockFindExistingRating.mockResolvedValue(null);
    mockCreateRatingWithSync.mockResolvedValue({
      created: { rating: 4, comment: null },
      provider: null,
    });

    const result = await createRating('u1', { ticketId: 't1', rating: 4 });

    expect(result).toMatchObject({ rating: 4, finalRating: 4, ratingCount: 1 });
  });

  test('rejects a ticket that does not exist', async () => {
    mockFindTicket.mockResolvedValue(null);

    await expect(createRating('u1', { ticketId: 'missing', rating: 5 })).rejects.toThrow('Ticket not found');
  });

  test('rejects rating another tenant\'s ticket', async () => {
    mockFindTicket.mockResolvedValue({ id: 't1', tenant_id: 'other', status: 'Tenant Confirmed' });

    await expect(createRating('u1', { ticketId: 't1', rating: 5 })).rejects.toThrow('only rate your own');
  });

  test('rejects rating a ticket that is not Tenant Confirmed', async () => {
    mockFindTicket.mockResolvedValue({ id: 't1', tenant_id: 'u1', status: 'Completed' });

    await expect(createRating('u1', { ticketId: 't1', rating: 5 })).rejects.toThrow('confirm the work');
  });

  test('rejects duplicate ratings', async () => {
    mockFindTicket.mockResolvedValue({ id: 't1', tenant_id: 'u1', status: 'Tenant Confirmed' });
    mockFindExistingRating.mockResolvedValue({ id: 9 });

    await expect(createRating('u1', { ticketId: 't1', rating: 5 })).rejects.toThrow('already been rated');
  });

  test('rejects a rating outside 1-5', async () => {
    await expect(createRating('u1', { ticketId: 't1', rating: 7 })).rejects.toThrow('between 1 and 5');
    await expect(createRating('u1', { ticketId: 't1', rating: 0 })).rejects.toThrow('between 1 and 5');
  });
});

describe('listRatings service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('delegates to the repository with the caller role and id', async () => {
    mockListRatings.mockResolvedValue([
      { id: 1, rating: 5, comment: 'Great work', tenant_name: 'John Tenant' },
    ]);

    const result = await listRatings('u1', 'PROPERTY_MANAGER');

    expect(mockListRatings).toHaveBeenCalledWith({ userId: 'u1', role: 'PROPERTY_MANAGER' });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rating: 5, comment: 'Great work' });
  });

  test('returns an empty array when there are no ratings', async () => {
    mockListRatings.mockResolvedValue([]);

    const result = await listRatings('u1', 'TENANT');

    expect(mockListRatings).toHaveBeenCalledWith({ userId: 'u1', role: 'TENANT' });
    expect(result).toEqual([]);
  });
});

