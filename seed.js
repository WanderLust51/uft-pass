require('dotenv').config();
const base = require('./lib/airtable');
const { hash } = require('./lib/clave');

const iso = (d) => d.toLocaleDateString('en-CA');
const mes = (n) => {
  const h = new Date();
  return iso(new Date(h.getFullYear(), h.getMonth() + n, 5));
};

async function lotes(tabla, regs, op = 'create') {
  const salida = [];
  for (let i = 0; i < regs.length; i += 10)
    salida.push(...await base(tabla)[op](regs.slice(i, i + 10)));
  return salida;
}

(async () => {
  const hoy = iso(new Date());

  const ya = await base('estudiantes').select({
    filterByFormula: 'OR({cedula} = 1000001, {cedula} = 1000002, {cedula} = 1000003)',
    maxRecords: 1
  }).firstPage();
  if (ya.length) return console.log('Los datos de prueba ya existen. No se hizo nada.');

  // 1. Fechas y montos de las cuotas (solo donde estén vacíos)
  const cuotas = (await base('cuotas').select().all())
    .filter(c => c.fields.clave != null)
    .sort((a, b) => a.fields.clave - b.fields.clave);

  const upd = [];
  const pasadas = [];
  cuotas.forEach((c, i) => {
    const fecha = c.fields.fecha || mes(i - 4);
    const monto = c.fields.monto ?? 25;
    if (!c.fields.fecha || c.fields.monto == null) upd.push({ id: c.id, fields: { fecha, monto } });
    if (fecha < hoy) pasadas.push(c.fields.clave);
  });
  if (upd.length) await lotes('cuotas', upd, 'update');
  console.log(`Cuotas: ${cuotas.length} (${upd.length} completadas, ${pasadas.length} ya vencidas)`);

  // 2. Estudiantes de prueba
  await lotes('estudiantes', [
    { fields: { cedula: 1000001, nombre: 'Ana', apellido: 'Solvente', password: hash('1234') } },
    { fields: { cedula: 1000002, nombre: 'Luis', apellido: 'Moroso', password: hash('1234') } },
    { fields: { cedula: 1000003, nombre: 'Eva', apellido: 'Casi', password: hash('1234') } }
  ]);
  console.log('Estudiantes creados: 1000001, 1000002, 1000003');

  // 3. Pagos: Ana paga todo lo vencido, Eva todo menos la última
  const pagos = [
    ...pasadas.map(k => ({ fields: { cedula: 1000001, clave: k, fecha: hoy } })),
    ...pasadas.slice(0, -1).map(k => ({ fields: { cedula: 1000003, clave: k, fecha: hoy } }))
  ];
  if (pagos.length) await lotes('cuotas-pagadas', pagos);
  console.log(`Pagos creados: ${pagos.length}`);

  // 4. Personal
  const hayPersonal = (await base('personal').select({ maxRecords: 1 }).firstPage()).length;
  if (!hayPersonal) {
    const p = await lotes('personal', [
      { fields: { nombre: 'Admin Prueba', password: hash('admin123'), admin: true } },
      { fields: { nombre: 'Vigilante Prueba', password: hash('1234') } }
    ]);
    p.forEach(x => console.log(`Personal creado: ID ${x.fields.id} (${x.fields.nombre})`));
  } else {
    console.log('personal ya tenía registros: no creé ninguno (usa set-clave.js para ponerles clave)');
  }

  console.log('Listo.');
})().catch(e => console.error('Error:', e.message));
