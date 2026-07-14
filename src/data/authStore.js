import { sha256 } from 'js-sha256';

const AUTH_KEY = "spmt_auth_data";
const SESSION_KEY = "spmt_session";

let authData = loadAuthData();

function loadAuthData() {
  const saved = localStorage.getItem(AUTH_KEY);
  if (saved) return JSON.parse(saved);
  return { users: getSeedUsers() };
}

function saveAuthData() {
  localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
}

function getSeedUsers() {
  return [
    {
      id: "USR-001",
      name: "John",
      surname: "Tenant",
      age: 32,
      email: "john@spmt.com",
      phone: "0712345678",
      idNumber: "9001011234567",
      password_hash: sha256("password123"),
      role: "TENANT",
      status: "Active",
      emailVerified: true,
      preferredNotificationChannel: "EMAIL",
      failedLoginCount: 0,
      createdAt: new Date().toLocaleString(),
    },
    {
      id: "USR-002",
      name: "Sarah",
      surname: "Manager",
      age: 38,
      email: "sarah@spmt.com",
      phone: "0723456789",
      idNumber: "8505159876543",
      password_hash: sha256("password123"),
      role: "PROPERTY_MANAGER",
      status: "Active",
      emailVerified: true,
      preferredNotificationChannel: "EMAIL",
      failedLoginCount: 0,
      createdAt: new Date().toLocaleString(),
    },
    {
      id: "USR-003",
      name: "Mike",
      surname: "Provider",
      age: 41,
      email: "mike@spmt.com",
      phone: "0734567890",
      idNumber: "8210104567890",
      password_hash: sha256("password123"),
      role: "SERVICE_PROVIDER",
      status: "Active",
      emailVerified: true,
      preferredNotificationChannel: "SMS",
      failedLoginCount: 0,
      createdAt: new Date().toLocaleString(),
    },
    {
      id: "USR-004",
      name: "Admin",
      surname: "User",
      age: 45,
      email: "admin@spmt.com",
      phone: "0745678901",
      idNumber: "7801011111111",
      password_hash: sha256("admin123"),
      role: "SYSTEM_ADMIN",
      status: "Active",
      emailVerified: true,
      preferredNotificationChannel: "EMAIL",
      failedLoginCount: 0,
      createdAt: new Date().toLocaleString(),
    },
    {
      id: "USR-005",
      name: "Peter",
      surname: "Pending",
      age: 35,
      email: "peter@spmt.com",
      phone: "0756789012",
      idNumber: "8808088888888",
      password_hash: sha256("password123"),
      role: "PROPERTY_MANAGER",
      status: "Pending",
      emailVerified: true,
      preferredNotificationChannel: "EMAIL",
      failedLoginCount: 0,
      createdAt: new Date().toLocaleString(),
    },
  ];
}

/** Production: server-side sanitisation and parameterised queries are the
 *  primary XSS/injection defence. This is a belt-and-suspenders demo measure. */
function sanitise(str) {
  if (typeof str !== 'string') return '';
  return str.trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function generateToken() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

let userCounter = authData.users.length + 1;

/** Production: replace sha256 with server-side bcrypt (work factor >=12)
 *  per SDD NFR-SEC01. This sha256 simulation is for demo purposes only. */
export const registerUser = (userData) => {
  const { name, surname, age, email, phone, idNumber, password, role } =
    userData;

  if (role === 'SYSTEM_ADMIN') {
    return { success: false, error: 'Administrator accounts cannot be self-registered. Contact your system administrator.' };
  }

  if (
    !name ||
    !surname ||
    !age ||
    !email ||
    !phone ||
    !idNumber ||
    !password ||
    !role
  ) {
    return { success: false, error: "All fields are required." };
  }

  const emailExists = authData.users.some(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );
  if (emailExists) {
    return { success: false, error: "Email already registered." };
  }

  const idExists = authData.users.some((u) => u.idNumber === idNumber);
  if (idExists) {
    return { success: false, error: "ID number already registered." };
  }

  const newUser = {
    id: `USR-${String(userCounter++).padStart(3, "0")}`,
    name: sanitise(name),
    surname: sanitise(surname),
    age: Number(age),
    email: sanitise(email).toLowerCase(),
    phone: sanitise(phone),
    idNumber: idNumber.trim(),
    password_hash: sha256(password),
    role,
    status: "Unverified",
    emailVerificationToken: generateToken(),
    emailVerified: false,
    preferredNotificationChannel: "EMAIL",
    failedLoginCount: 0,
    createdAt: new Date().toLocaleString(),
  };

  authData.users.push(newUser);
  saveAuthData();
  return { success: true, verificationToken: newUser.emailVerificationToken, data: newUser };
};

export const loginUser = (email, password) => {
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  const user = authData.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );

  if (!user) {
    return { success: false, error: "Invalid email or password." };
  }

  if (user.emailVerified === false) {
    return { success: false, error: 'Please verify your email address before logging in.' };
  }

  if (user.status === "Deactivated") {
    return { success: false, error: "Account deactivated. Contact system administrator." };
  }

  if (user.status === "Suspended") {
    return { success: false, error: "Account suspended. Contact system administrator." };
  }

  if (user.failedLoginCount >= 5) {
    user.status = "Suspended";
    saveAuthData();
    return { success: false, error: "Account locked due to too many failed attempts. Contact system administrator." };
  }

  if (user.password_hash !== sha256(password)) {
    user.failedLoginCount = (user.failedLoginCount || 0) + 1;
    saveAuthData();
    const attemptsLeft = 5 - user.failedLoginCount;
    if (attemptsLeft <= 0) {
      user.status = "Suspended";
      saveAuthData();
      return { success: false, error: "Account locked due to too many failed attempts. Contact system administrator." };
    }
    return { success: false, error: `Invalid email or password. ${attemptsLeft} attempt(s) remaining.` };
  }

  user.failedLoginCount = 0;
  saveAuthData();

  const { password_hash: _, ...safeUser } = user;
  const session = { ...safeUser, loginTime: Date.now(), submittedByUserId: user.id };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { success: true, data: safeUser };
};

export const logoutUser = () => {
  localStorage.removeItem(SESSION_KEY);
};

/* Production: replace with real JWT verification on every API call. */
export const getSession = () => {
  const saved = localStorage.getItem(SESSION_KEY);
  if (!saved) return null;
  try {
    const session = JSON.parse(saved);
    if (session.loginTime && Date.now() - session.loginTime > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

const normalizeUser = (u) => ({
  ...u,
  status: u.status || "Pending",
  preferredNotificationChannel: u.preferredNotificationChannel || "EMAIL",
  failedLoginCount: u.failedLoginCount ?? 0,
});

export const getUsers = () => authData.users.map(normalizeUser);

export const getUsersByRole = (role) =>
  authData.users.filter((u) => u.role === role).map(normalizeUser);

export const approveManager = (userId) => {
  const user = authData.users.find((u) => u.id === userId);
  if (!user) return { success: false, error: "User not found." };
  if (user.role !== "PROPERTY_MANAGER")
    return { success: false, error: "User is not a Property Manager." };
  if (user.status !== "Pending")
    return { success: false, error: "Account is not in pending status." };

  user.status = "Active";
  saveAuthData();
  return { success: true, data: normalizeUser(user) };
};

export const deactivateUser = (userId) => {
  const user = authData.users.find((u) => u.id === userId);
  if (!user) return { success: false, error: "User not found." };
  if (user.status === "Deactivated")
    return { success: false, error: "Account is already deactivated." };

  user.status = "Deactivated";
  saveAuthData();
  return { success: true, data: normalizeUser(user) };
};

export const reactivateUser = (userId) => {
  const user = authData.users.find((u) => u.id === userId);
  if (!user) return { success: false, error: "User not found." };
  if (user.status !== "Deactivated")
    return { success: false, error: "Account is not deactivated." };

  user.status = "Active";
  saveAuthData();
  return { success: true, data: normalizeUser(user) };
};

export const updateUser = (userId, updates) => {
  const user = authData.users.find((u) => u.id === userId);
  if (!user) return { success: false, error: "User not found." };

  if (updates.email) {
    const emailConflict = authData.users.some(
      (u) => u.id !== userId && u.email.toLowerCase() === updates.email.toLowerCase(),
    );
    if (emailConflict) return { success: false, error: "Email already in use." };
  }

  Object.assign(user, updates);
  saveAuthData();
  return { success: true, data: normalizeUser(user) };
};

export const unlockUserAccount = (userId) => {
  const user = authData.users.find((u) => u.id === userId);
  if (!user) return { success: false, error: "User not found." };
  if (user.status !== "Suspended" && user.failedLoginCount < 5)
    return { success: false, error: "Account is not locked." };

  user.status = "Active";
  user.failedLoginCount = 0;
  saveAuthData();
  return { success: true, data: normalizeUser(user) };
};

export const verifyEmail = (token) => {
  const user = authData.users.find((u) => u.emailVerificationToken === token);
  if (!user) return { success: false, error: 'Invalid or expired verification token.' };
  user.emailVerified = true;
  user.status = 'Pending';
  user.emailVerificationToken = null;
  saveAuthData();
  return { success: true, data: normalizeUser(user) };
};

export const requestPasswordReset = (email) => {
  const user = authData.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return { success: true, message: 'If that email exists, a reset link was sent.' };
  const token = generateToken();
  user.passwordResetToken = token;
  user.passwordResetExpiry = Date.now() + 60 * 60 * 1000;
  saveAuthData();
  return { success: true, resetToken: token, message: 'If that email exists, a reset link was sent.' };
};

export const resetPassword = (token, newPassword) => {
  const user = authData.users.find((u) => u.passwordResetToken === token && u.passwordResetExpiry > Date.now());
  if (!user) return { success: false, error: 'Token is invalid or has expired.' };
  user.password_hash = sha256(newPassword);
  user.passwordResetToken = null;
  user.passwordResetExpiry = null;
  saveAuthData();
  return { success: true };
};
