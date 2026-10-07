const base = require('./airtable');

const hoyISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

function calcular(cuotasRecs, clavesPagadas) {
  const hoy = hoyISO();
  const cuotas = cuotasRecs
    .filter(c => c.fields.clave != null)
    .map(c => {
      const { clave, fecha = null, monto = 0 } = c.fields;
      const pagada = clavesPagadas.has(clave);
      return { clave, fecha, monto, pagada, vencida: !pagada && !!fecha && fecha < hoy };
    })
    .sort((a, b) => a.clave - b.clave);

  const vencidas = cuotas.filter(c => c.vencida);

  // Cuota actual: la última cuya fecha ya llegó; si ninguna, la próxima
  const conFecha = cuotas.filter(c => c.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const llegadas = conFecha.filter(c => c.fecha <= hoy);
  const actual = llegadas.length ? llegadas[llegadas.length - 1] : (conFecha[0] || null);

  return {
    solvente: vencidas.length === 0,
    deuda: vencidas.reduce((s, c) => s + c.monto, 0),
    vencidas: vencidas.length,
    actual,
    cuotas
  };
}

async function buscarEstudiante(cedula) {
  const r = await base('estudiantes').select({
    filterByFormula: `{cedula} = ${cedula}`, maxRecords: 1
  }).firstPage();
  return r[0] || null;
}

async function estadoCuenta(cedula) {
  const [cuotas, pagadas] = await Promise.all([
    base('cuotas').select().all(),
    base('cuotas-pagadas').select({ filterByFormula: `{cedula} = ${cedula}` }).all()
  ]);
  return calcular(cuotas, new Set(pagadas.map(p => p.fields.clave)));
}

module.exports = { calcular, buscarEstudiante, estadoCuenta };
