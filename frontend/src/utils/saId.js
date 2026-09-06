const ID_LENGTH = 13;

function isValidLuhn(id) {
  if (!/^\d{13}$/.test(id)) return false;
  const digits = String(id).split('').reverse().map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let value = digits[i];
    if (i % 2 === 1) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
  }
  return sum % 10 === 0;
}

function parseSaId(id) {
  if (!/^\d{13}$/.test(id)) return { valid: false, reason: 'ID number must be exactly 13 digits' };
  if (!isValidLuhn(id)) return { valid: false, reason: 'ID number is not valid (checksum failed)' };

  const yy = parseInt(id.slice(0, 2), 10);
  const mm = parseInt(id.slice(2, 4), 10);
  const dd = parseInt(id.slice(4, 6), 10);
  const sequence = parseInt(id.slice(6, 10), 10);

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return { valid: false, reason: 'ID number contains an invalid birth date' };
  }

  const currentYY = new Date().getFullYear() % 100;
  const century = yy <= currentYY ? 2000 : 1900;
  const year = century + yy;
  const birthDate = new Date(year, mm - 1, dd);

  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== mm - 1 ||
    birthDate.getDate() !== dd
  ) {
    return { valid: false, reason: 'ID number contains an invalid birth date' };
  }

  return {
    valid: true,
    birthDate,
    gender: sequence >= 5000 ? 'MALE' : 'FEMALE',
    citizen: parseInt(id.charAt(10), 10) === 0,
  };
}

function ageFromId(id) {
  const info = parseSaId(id);
  if (!info.valid) return null;
  const today = new Date();
  let age = today.getFullYear() - info.birthDate.getFullYear();
  const monthDiff = today.getMonth() - info.birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < info.birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

export { ID_LENGTH, isValidLuhn, parseSaId, ageFromId };