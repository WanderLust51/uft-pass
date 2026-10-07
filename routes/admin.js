const express = require('express');
const base = require('../lib/airtable');
const { verificar } = require('../lib/clave');
const { calcular, buscarEstudiante, estadoCuenta } = require('../lib/solvencia');
const router = express.Router();

const soloPersonal = (req, res, next) =>
  req.session.personal
    ? next()
    : res.status(401).json({ estatus: 'error', mensaje: 'No autorizado' });

const soloAdmin = (req, res, next) =>
  req.session.personal?.admin
    ? next()
    : res.status(403).json({ estatus: 'error', mensaje: 'Requiere permisos de administrador' });

const nombreDe = (e) => `${e.fields.nombre || ''} ${e.fields.apellido || ''}`.trim();
const aCedula = (v) => Number(String(v || '').replace(/\D/g, ''));
const hoyISO = () => new Date().toLocaleDateString('en-CA');
const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f);
const esRecId = (id) => /^rec[A-Za-z0-9]{14}$/.test(id);

// ---------- Sesión ----------
router.post('/login', async (req, res) => {
  const id = aCedula(req.body.id);
  const password = String(req.body.password || '');
  if (!id || !password)
    return res.status(400).json({ estatus: 'error', mensaje: 'Ingresa ID y contraseña' });
  try {
    const r = await base('personal').select({
      filterByFormula: `{id} = ${id}`, maxRecords: 1
    }).firstPage();
    const p = r[0];
    if (!p || !verificar(password, p.fields.password))
      return res.status(401).json({ estatus: 'error', mensaje: 'ID o contraseña incorrecta' });
    req.session.personal = {
      id,
      nombre: p.fields.nombre || `PER-${String(id).padStart(3, '0')}`,
      admin: !!p.fields.admin
    };
    res.json({ estatus: 'ok', admin: !!p.fields.admin });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ estatus: 'error', mensaje: 'Error de base de datos' });
  }
});

router.get('/sesion', soloPersonal, (req, res) =>
  res.json({ estatus: 'ok', ...req.session.personal }));

router.post('/logout', (req, res) => req.session.destroy(() => res.json({ estatus: 'ok' })));

// ---------- Consulta (todo el personal) ----------
router.get('/verificar/:cedula', soloPersonal, async (req, res) => {
  const cedula = aCedula(req.params.cedula);
  if (!cedula) return res.status(400).json({ estatus: 'error', mensaje: 'Cédula inválida' });
  try {
    const est = await buscarEstudiante(cedula);
    if (!est) return res.status(404).json({ estatus: 'error', mensaje: 'Cédula no registrada' });
    const { solvente, deuda, vencidas, actual, cuotas } = await estadoCuenta(cedula);
    const debe = cuotas.filter(c => c.vencida).map(c => ({ clave: c.clave, fecha: c.fecha }));
    res.json({ estatus: 'ok', cedula, nombre: nombreDe(est), solvente, deuda, vencidas, actual, debe });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ estatus: 'error', mensaje: 'Error de base de datos' });
  }
});

router.get('/morosos', soloPersonal, async (req, res) => {
  try {
    const [est, cuotas, pagadas] = await Promise.all([
      base('estudiantes').select().all(),
      base('cuotas').select().all(),
      base('cuotas-pagadas').select().all()
    ]);
    const porCedula = new Map();
    pagadas.forEach(p => {
      const k = p.fields.cedula;
      if (!porCedula.has(k)) porCedula.set(k, new Set());
      porCedula.get(k).add(p.fields.clave);
    });
    const lista = est.map(e => {
      const c = calcular(cuotas, porCedula.get(e.fields.cedula) || new Set());
      return { cedula: e.fields.cedula, nombre: nombreDe(e),
               solvente: c.solvente, deuda: c.deuda, vencidas: c.vencidas };
    });
    const morosos = lista.filter(x => !x.solvente);
    res.json({ total: lista.length, solventes: lista.length - morosos.length, morosos });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ estatus: 'error' });
  }
});

// ---------- Pagos (solo admin) ----------
router.get('/pagos/:cedula', soloPersonal, soloAdmin, async (req, res) => {
  const cedula = aCedula(req.params.cedula);
  if (!cedula) return res.status(400).json({ estatus: 'error', mensaje: 'Cédula inválida' });
  try {
    const est = await buscarEstudiante(cedula);
    if (!est) return res.status(404).json({ estatus: 'error', mensaje: 'Cédula no registrada' });
    const [cuotas, pagos] = await Promise.all([
      base('cuotas').select().all(),
      base('cuotas-pagadas').select({ filterByFormula: `{cedula} = ${cedula}` }).all()
    ]);
    const porClave = new Map(pagos.map(p => [p.fields.clave, p]));
    const { cuotas: lista } = calcular(cuotas, new Set(porClave.keys()));
    res.json({
      cedula, nombre: nombreDe(est),
      cuotas: lista.map(c => ({
        ...c,
        pagoId: porClave.get(c.clave)?.id || null,
        fechaPago: porClave.get(c.clave)?.fields.fecha || null
      }))
    });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ estatus: 'error', mensaje: 'Error de base de datos' });
  }
});

// Crear pago
router.post('/pagos', soloPersonal, soloAdmin, async (req, res) => {
  const cedula = aCedula(req.body.cedula);
  const clave = Number(req.body.clave);
  const fecha = req.body.fecha || hoyISO();
  if (!cedula || !Number.isFinite(clave) || !esFecha(fecha))
    return res.status(400).json({ estatus: 'error', mensaje: 'Datos inválidos' });
  try {
    if (!(await buscarEstudiante(cedula)))
      return res.status(404).json({ estatus: 'error', mensaje: 'Estudiante no registrado' });

    const cuota = await base('cuotas').select({ filterByFormula: `{clave} = ${clave}`, maxRecords: 1 }).firstPage();
    if (!cuota.length)
      return res.status(404).json({ estatus: 'error', mensaje: 'La cuota no existe' });

    const dup = await base('cuotas-pagadas').select({
      filterByFormula: `AND({cedula} = ${cedula}, {clave} = ${clave})`, maxRecords: 1
    }).firstPage();
    if (dup.length)
      return res.status(409).json({ estatus: 'error', mensaje: 'Esa cuota ya está pagada' });

    const [nuevo] = await base('cuotas-pagadas').create([{ fields: { cedula, clave, fecha } }]);
    res.json({ estatus: 'ok', id: nuevo.id });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ estatus: 'error', mensaje: 'No se pudo registrar el pago' });
  }
});

// Cambiar fecha de un pago
router.patch('/pagos/:id', soloPersonal, soloAdmin, async (req, res) => {
  const { fecha } = req.body;
  if (!esRecId(req.params.id) || !esFecha(fecha))
    return res.status(400).json({ estatus: 'error', mensaje: 'Datos inválidos' });
  try {
    await base('cuotas-pagadas').update([{ id: req.params.id, fields: { fecha } }]);
    res.json({ estatus: 'ok' });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ estatus: 'error', mensaje: 'No se pudo modificar' });
  }
});

// Anular un pago
router.delete('/pagos/:id', soloPersonal, soloAdmin, async (req, res) => {
  if (!esRecId(req.params.id))
    return res.status(400).json({ estatus: 'error', mensaje: 'Id inválido' });
  try {
    await base('cuotas-pagadas').destroy([req.params.id]);
    res.json({ estatus: 'ok' });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ estatus: 'error', mensaje: 'No se pudo anular' });
  }
});

module.exports = router;