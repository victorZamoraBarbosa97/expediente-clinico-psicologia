// Crea una base de datos tal como la dejaría la versión ANTERIOR de la app
// (migraciones 1 a 6, sin triggers) con datos ficticios, para probar que la versión
// actual la actualiza sin perder nada.
//
//   node scripts/crear-base-previa.mjs [ruta/a/clinica.db]
//
// Con la app CERRADA. Sin argumento usa %APPDATA%\com.consultorio.expediente\clinica.db.
// Si ya existe una base, se renombra (clinica.db.antes-<fecha>), no se borra.

import { apartarBase, crearBase, rutaPorDefecto } from "./lib/base.mjs";

const ruta = process.argv[2] ?? rutaPorDefecto();

const apartada = apartarBase(ruta);
if (apartada) console.log(`La base que había se guardó como ${apartada}`);

const db = crearBase(ruta, 6);
try {
  // Datos como los habría escrito la versión anterior (sin triggers: la app de entonces
  // anotaba la bitácora a mano).
  db.exec(`
    INSERT INTO pacientes (folio, nombre, fecha_nacimiento, telefono, fecha_ingreso, motivo_consulta)
    VALUES ('EXP-2026-001', 'Lucía Hernández Ortega', '1991-04-12', '555 010 0001', '2026-02-03', 'Ansiedad en el trabajo.'),
           ('EXP-2026-002', 'Carlos Mendoza Vega', '1978-11-02', '555 010 0005', '2026-04-21', 'Duelo.');
    INSERT INTO sesiones (paciente_id, numero, fecha, hora, notas_evolucion)
    VALUES (1, 1, '2026-02-03', '17:00', 'Primera entrevista.'),
           (1, 2, '2026-02-10', '17:00', 'Reestructuración cognitiva.'),
           (2, 1, '2026-04-21', '16:00', 'Sesión inicial.');
    INSERT INTO bitacora (tabla, registro_id, accion, detalle)
    VALUES ('pacientes', 1, 'alta', 'EXP-2026-001 — Lucía Hernández Ortega'),
           ('pacientes', 2, 'alta', 'EXP-2026-002 — Carlos Mendoza Vega');
  `);
  console.log(`Base "versión anterior" creada en ${ruta} (migraciones 1 a 6).`);
  console.log("Ahora abre la app (npm run tauri dev): debe aplicar la migración 7 y conservar los datos.");
} finally {
  db.close();
}
