const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const base = require('../lib/airtable');
const { buscarEstudiante, estadoCuenta } = require('../lib/solvencia');
const router = express.Router();
const { verificar } = require('../lib/clave');

const soloAlumno = (req, res, next) =>
  req.session.estudiante
    ? next()
    : res.status(401).json({ estatus: 'error', mensaje: 'Sesión no válida' });

router.get('/status-db', async (req, res) => {
  try {
    await base('estudiantes').select({ maxRecords: 1 }).firstPage();
    res.json({ conectado: true });
  } catch (e) {
    console.error('Error de salud con Airtable:', e.message);
    res.json({ conectado: false });
  }
});

router.post('/login', async (req, res) => {
  const cedula = Number(String(req.body.cedula || '').replace(/\D/g, ''));
  const password = String(req.body.password || '');
  if (!cedula || !password)
    return res.status(400).json({ estatus: 'error', mensaje: 'Ingresa cédula y contraseña' });
  try {
    const est = await buscarEstudiante(cedula);
    if (!est || !verificar(password, est.fields.password))
      return res.status(401).json({ estatus: 'error', mensaje: 'Cédula o contraseña incorrecta' });
    req.session.estudiante = {
      cedula,
      nombre: `${est.fields.nombre || ''} ${est.fields.apellido || ''}`.trim()
    };
    res.json({ estatus: 'ok', redireccionarA: '/estudiantes/inicio' });
  } catch (e) {
    console.error('Error en login:', e.message);
    res.status(500).json({ estatus: 'error', mensaje: 'Error al verificar la base de datos' });
  }
});

router.get('/inicio', (req, res) => {
  if (!req.session.estudiante) return res.redirect('/');
  res.sendFile(path.join(__dirname, '../public/home.html'));
});

router.get('/me', soloAlumno, async (req, res) => {
  try {
    const { cedula, nombre } = req.session.estudiante;
    const [est, cuenta] = await Promise.all([buscarEstudiante(cedula), estadoCuenta(cedula)]);
    const qr = await QRCode.toDataURL(String(cedula), { margin: 1, width: 240 });
    res.json({ cedula, nombre, ...cuenta, qr });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ estatus: 'error' });
  }
});

router.post('/logout', (req, res) => req.session.destroy(() => res.json({ estatus: 'ok' })));

module.exports = router;