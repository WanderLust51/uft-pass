require('dotenv').config();
const base = require('./lib/airtable');
const { hash } = require('./lib/clave');

const [tipo, id, clave, flag] = process.argv.slice(2);

(async () => {
  if (!tipo || !id || !clave) {
    return console.log('Uso:\n  node set-clave.js estudiante <cedula> <clave>\n  node set-clave.js personal <id> <clave> [--admin]');
  }
  const esEst = tipo === 'estudiante';
  const tabla = esEst ? 'estudiantes' : 'personal';
  const r = await base(tabla).select({
    filterByFormula: `{${esEst ? 'cedula' : 'id'}} = ${Number(id)}`, maxRecords: 1
  }).firstPage();
  if (!r.length) return console.log('No existe ese registro');

  const fields = { password: hash(clave) };
  if (!esEst && flag === '--admin') fields.admin = true;
  await base(tabla).update([{ id: r[0].id, fields }]);
  console.log('Clave guardada');
})().catch(e => console.error('Error:', e.message));
