require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieSession({
  name: 'uft',
  keys: [process.env.SESSION_SECRET],
  maxAge: 8 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: 'lax',
  secure: !!process.env.VERCEL
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/estudiantes', require('./routes/estudiantes'));
app.use('/admin', require('./routes/admin'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ estatus: 'error', mensaje: 'Error interno' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 UFT Pass en http://localhost:${PORT}`));
}

module.exports = app;
