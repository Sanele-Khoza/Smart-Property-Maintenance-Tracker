import { jest } from '@jest/globals';

const mockFindByEmail = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdateLoginAttempts = jest.fn();
const mockLockUser = jest.fn();
const mockUpdateLastLogin = jest.fn();
const mockSaveRefreshToken = jest.fn();
const mockUpdateUser = jest.fn();

jest.unstable_mockModule('../modules/auth/auth.repository.js', () => ({
  findByEmail: mockFindByEmail,
  findById: mockFindById,
  create: mockCreate,
  updateLoginAttempts: mockUpdateLoginAttempts,
  lockUser: mockLockUser,
  updateLastLogin: mockUpdateLastLogin,
  saveRefreshToken: mockSaveRefreshToken,
  updateUser: mockUpdateUser,
}));

const { register, login, getMe } = await import('../modules/auth/auth.service.js');

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      mockFindByEmail.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: 1, name: 'Test', surname: 'User', email: 'test@test.com', role: 'TENANT' });

      const result = await register({ name: 'Test', surname: 'User', email: 'test@test.com', password: 'StrongP@ss1', role: 'TENANT' });
      expect(result.data.accessToken).toBeDefined();
      expect(result.data.user.email).toBe('test@test.com');
      expect(mockFindByEmail).toHaveBeenCalledWith('test@test.com');
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should throw conflict on duplicate email', async () => {
      mockFindByEmail.mockResolvedValue({ id: 1, email: 'test@test.com' });

      await expect(register({ name: 'Test', surname: 'User', email: 'test@test.com', password: 'password123', role: 'TENANT' }))
        .rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should throw unauthorized for invalid email', async () => {
      mockFindByEmail.mockResolvedValue(null);

      await expect(login('wrong@email.com', 'password123'))
        .rejects.toThrow('Invalid email or password');
    });
  });

  describe('getMe', () => {
    it('should return user when found', async () => {
      mockFindById.mockResolvedValue({ id: 1, name: 'Test', email: 'test@test.com' });

      const user = await getMe(1);
      expect(user.data.user).toHaveProperty('name', 'Test');
    });

    it('should throw not found when user missing', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(getMe(999)).rejects.toThrow('User not found');
    });
  });
});
