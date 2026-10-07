require('dotenv').config();
const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN })
  .base(process.env.AIRTABLE_BASE_ID);

(async () => {
  for (const t of ['estudiantes', 'personal', 'pagos', 'cuotas']) {
    try {
      const r = await base(t).select({ maxRecords: 20 }).all();
      const campos = {};
      r.forEach(reg => Object.entries(reg.fields).forEach(([k, v]) => {
        campos[k] = Array.isArray(v) ? 'lista/enlace' : typeof v;
      }));
      console.log(`\n## ${t} (${r.length} registros de muestra)`);
      console.log(Object.entries(campos).map(([k, v]) => `  ${k} (${v})`).join('\n') || '  (sin registros)');
    } catch (e) {
      console.log(`\n## ${t}: ERROR ${e.message}`);
    }
  }
})();