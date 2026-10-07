const crypto = require('crypto');

function hash(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}

function verificar(pw, guardado) {
  if (!guardado || !guardado.includes(':')) return false;
  const [salt, h] = guardado.split(':');
  const orig = Buffer.from(h, 'hex');
  const calc = crypto.scryptSync(pw, salt, 64);
  return orig.length === calc.length && crypto.timingSafeEqual(calc, orig);
}

module.exports = { hash, verificar };