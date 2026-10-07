// Carga los pacientes ficticios de scripts/datos-demo.sql en la base de la app.
//
//   node scripts/cargar-demo.mjs --nueva      <- lo más sencillo
//   node scripts/cargar-demo.mjs              <- solo si la base actual está vacía
//   node scripts/cargar-demo.mjs --nueva ruta/a/otra.db
//
// Con la app CERRADA. Sin ruta usa la base de Windows:
//   %APPDATA%\com.consultorio.expediente\clinica.db
//
// --nueva: aparta la base actual (la renombra a clinica.db.antes-<fecha>, no la borra) y
//          crea una base completa y nueva con los datos de demostración.
// Para volver a tu base anterior: cierra la app, borra o renombra clinica.db y quita el
// sufijo ".antes-<fecha>" del archivo apartado.

import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { apartarBase, cargarDemo, crearBase, rutaPorDefecto } from "./lib/base.mjs";

const args = process.argv.slice(2);
const nueva = args.includes("--nueva");
const ruta = args.find((a) => !a.startsWith("--")) ?? rutaPorDefecto();

if (nueva) {
  const apartada = apartarBase(ruta);
  if (apartada) console.log(`Tu base anterior quedó guardada como ${apartada}`);
  const db = crearBase(ruta, 99); // todas las migraciones
  try {
    cargarDemo(db);
  } finally {
    db.close();
  }
  console.log(`Listo: base nueva con pacientes ficticios en ${ruta}`);
  console.log("Ahora abre la app (npm run tauri dev).");
  process.exit(0);
}

if (!existsSync(ruta)) {
  console.error(`No existe la base de datos: ${ruta}`);
  console.error("Usa --nueva para crearla, o abre la app una vez para que la cree.");
  process.exit(1);
}

const db = new DatabaseSync(ruta);
try {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM pacientes").get();
  if (n > 0) {
    console.error(`La base ya tiene ${n} paciente(s), así que no se cargó nada.`);
    console.error("Corre el mismo comando con --nueva: aparta esa base y crea una con la demo.");
    process.exit(1);
  }
  cargarDemo(db);
  console.log(`Listo: pacientes ficticios cargados en ${ruta}`);
} finally {
  db.close();
}
