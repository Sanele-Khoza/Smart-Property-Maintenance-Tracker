import readline from 'readline';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pkg from 'pg';

const { Pool } = pkg;
dotenv.config();

const BCRYPT_ROUNDS = 12;
const ALLOWED_CODES = [0, 1];
const PASSWORD_MIN = 8;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'spmt',
  user: process.env.DB_USER || 'spmt_user',
  password: process.env.DB_PASSWORD || 'spmt_pass',
});

function prompt(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, answer => { rl.close(); resolve(answer.trim()); }));
}

function validatePassword(pw) {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one special character';
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 && i + 1 < args.length ? args[i + 1] : null; };

  let name = getArg('--name') || getArg('-n');
  let surname = getArg('--surname') || getArg('-s');
  let email = getArg('--email') || getArg('-e');
  let password = getArg('--password') || getArg('-p');
  let phone = getArg('--phone') || getArg('-t');

  if (!name) name = await prompt('Name: ');
  if (!surname) surname = await prompt('Surname: ');
  if (!email) email = await prompt('Email: ');
  if (!password) password = await prompt('Password: ');

  if (!name || !surname || !email || !password) {
    console.error('Error: name, surname, email, and password are required.');
    console.error('Usage: node scripts/createAdmin.js --name <name> --surname <surname> --email <email> --password <password> [--phone <phone>]');
    await pool.end();
    process.exit(1);
  }

  email = email.toLowerCase().trim();

  const pwErr = validatePassword(password);
  if (pwErr) {
    console.error(`Error: ${pwErr}`);
    await pool.end();
    process.exit(1);
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    if (existing.rows.length > 0) {
      console.error(`Error: A user with email "${email}" already exists.`);
      await pool.end();
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const queryParams = [name, surname, email, passwordHash];
    let phonePlaceholder = '';
    if (phone) {
      queryParams.push(phone);
      phonePlaceholder = ', $5';
    }

    const result = await pool.query(
      `INSERT INTO users (name, surname, email, password_hash, role, status, approved, email_verification_token, password_changed_at${phone ? ', phone' : ''})
       VALUES ($1, $2, $3, $4, 'SYSTEM_ADMIN', 'ACTIVE', TRUE, NULL, NOW()${phonePlaceholder})
       RETURNING id, name, surname, email, role, status, approved, phone, created_at`,
      queryParams
    );

    const user = result.rows[0];
    console.log(`\n✓ Admin user created successfully:`);
    console.log(`  ID:      ${user.id}`);
    console.log(`  Name:    ${user.name} ${user.surname}`);
    console.log(`  Email:   ${user.email}`);
    console.log(`  Role:    ${user.role}`);
    console.log(`  Status:  ${user.status}`);
    console.log(`  Phone:   ${user.phone || '(none)'}`);
    console.log(`  Approved: ${user.approved}`);
    console.log(`\nYou can now log in with this email and password.`);
  } catch (err) {
    console.error('Error creating admin user:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
