# Consultorio — expediente clínico local para psicología

Aplicación de escritorio para un consultorio de psicología individual. Sin servidor, sin
cuentas y sin internet: se abre el programa, aparece la lista de pacientes y se escribe.
Todo vive en un archivo SQLite en la computadora de quien la usa.

**Tauri 2 · React 18 · TypeScript · SQLite · Rust**

El logo y los datos de este repositorio son de ejemplo.

> ## ⚠️ Software pensado SOLO para trabajar en local
>
> Esta aplicación **no usa internet, no tiene servidor, no tiene nube y no tiene cuentas de
> usuario**. Los datos de los pacientes viven únicamente en el disco de la computadora donde se
> instala, y **ese disco debe estar cifrado (BitLocker)**. Es un requisito de uso, no una
> sugerencia: el cifrado del disco es el control de seguridad real del sistema.
>
> **Por qué se diseñó así.** Las notas de psicoterapia son datos personales sensibles. Si la
> información viajara por internet o se guardara en un servicio en la nube, habría que garantizar
> y poder demostrar —por ejemplo ante una auditoría— el cifrado en tránsito, la seguridad del
> almacenamiento en la nube y la gestión de credenciales, roles y permisos. Al mantener todo en
> el disco local cifrado de la profesional, nada de eso aplica porque la información nunca sale
> del equipo. El código no contiene ninguna llamada de red, y la política de seguridad de la
> ventana (CSP) bloquea cualquier conexión externa.
>
> **Para quién.** Para una profesional de edad mayor, sin conocimientos técnicos, que trabaja sola
> y necesita llevar un registro digital de sus pacientes porque el lugar donde ejerce se lo
> exige. De ahí el diseño: dos pantallas, sin menús anidados ni cuentas, tipografía base de 18 px,
> botones de 52 px y foco de teclado visible.
>
> **Por eso no hay demo en línea.** Una versión web sería otro sistema, con otro modelo de
> seguridad, y contradiría la razón de ser del proyecto. Para verlo funcionar hay capturas y
> video con datos ficticios, o puedes compilarlo siguiendo las instrucciones de abajo.
>
> Más detalles en [SECURITY.md](SECURITY.md). Esto no es asesoría legal.

## Qué hace

- Lista de pacientes con búsqueda (sin distinguir acentos ni mayúsculas) y expedientes cerrados.
- Expediente por paciente: datos de identificación y contacto, datos de madre y padre cuando es
  menor, motivo de consulta, antecedentes, impresión diagnóstica y plan de tratamiento.
- Línea de tiempo de sesiones: fecha, modalidad, duración, asistencia, notas, técnicas, tareas
  y próxima cita.
- Archivos adjuntos por paciente (botón o arrastrar y soltar), con su propia papelera.
- **Autoguardado** de todo lo que se escribe, con "Guardando…" / "✓ Guardado" a la vista.
- **Nada se borra de verdad:** expedientes, sesiones y archivos van a una papelera y se restauran.
- **Bitácora** de altas, bajas, restauraciones y ediciones (Ctrl+Shift+B), pensada para la
  NOM-004-SSA3-2012 y protegida a nivel de base de datos contra edición y borrado.
- **Respaldos** automáticos al cerrar y bajo demanda, con los archivos adjuntos incluidos.
- Exportar a PDF desde el diálogo de impresión del sistema.

## Capturas y video



> 🎬 *Video de recorrido: pendiente.*
<img width="1920" height="1032" alt="consultorio_mwW38UD9EZ" src="https://github.com/user-attachments/assets/18e4e944-0aae-448f-8263-dfef004374fc" />
<img width="1920" height="1032" alt="consultorio_yYN6gpVhfX" src="https://github.com/user-attachments/assets/516b33c4-6c82-4be2-8174-bcb7fa00207c" />
<img width="1920" height="1032" alt="consultorio_gkwLUR3FY6" src="https://github.com/user-attachments/assets/6f4eda72-1493-4442-be81-567b510f3fa5" />


**Lista de pacientes y búsqueda**
<img width="1920" height="1009" alt="consultorio_OqD4aQjkYi" src="https://github.com/user-attachments/assets/40e90f46-903a-46bb-b48b-3afb875217d7" />


**Expediente y notas clínicas**
<img width="1920" height="1009" alt="consultorio_qym2cKsqhr" src="https://github.com/user-attachments/assets/ed8fc8a0-c5ed-4bce-96bf-814b639cdd92" />


**Línea de tiempo de sesiones**
<img width="1920" height="1009" alt="consultorio_Hsie30a0AY" src="https://github.com/user-attachments/assets/6394b348-4afb-46c4-a26f-de9a362d88cc" />


**Archivos adjuntos**
<img width="1920" height="1009" alt="consultorio_yBSXXMHlPt" src="https://github.com/user-attachments/assets/79c57ab5-a775-4cae-b4c8-c9eec957e679" />

**Papelera y bitácora**
<img width="1920" height="1009" alt="consultorio_5jmaJIp6SK" src="https://github.com/user-attachments/assets/60bf7b13-3e92-4670-8ca4-f521d53f5f60" />
<img width="1920" height="1009" alt="consultorio_rfMrp7O16R" src="https://github.com/user-attachments/assets/81222c0b-febe-4a37-92bb-1b33390ee048" />

## Decisiones técnicas que vale la pena revisar

**Autoguardado que no pierde texto.** `CampoAuto` guarda 800 ms después de dejar de escribir y
al salir del campo. Mientras haya texto sin guardar, lo que llegue "de afuera" no lo pisa, y los
guardados de un mismo campo van en cola para que uno lento no termine después de uno más nuevo.
Hay una prueba que reproduce el caso (escribir con un guardado en vuelo) y falla con la versión
anterior: [`CampoAuto.test.tsx`](src/componentes/CampoAuto.test.tsx).

**Integridad en la base de datos, no en la interfaz.** El plugin SQL de Tauri usa un pool de
conexiones, así que no se puede abrir una transacción desde el frontend. Por eso las acciones de
varios pasos son *una sola sentencia* y el resto lo hacen triggers
([`007_bitacora_automatica.sql`](src-tauri/migrations/007_bitacora_automatica.sql)): eliminar un
paciente se lleva con el mismo sello de tiempo a sus sesiones y archivos activos, restaurarlo
recupera solo lo que se eliminó junto con él, y la bitácora se escribe sola y no admite
`UPDATE` ni `DELETE`.

**Migraciones que no se pueden romper.** El migrador de `sqlx` guarda el checksum de cada
migración publicada; editar una deja sin abrir las bases ya instaladas. Las migraciones son
archivos `.sql` y [`migraciones.test.ts`](src/migraciones.test.ts) fija sus checksums: si alguien
toca una, el test falla. Para cambiar el esquema se agrega la siguiente versión.

**Respaldo consistente.** La copia de la base la hace SQLite con `VACUUM INTO` (un solo archivo,
consistente, sin depender de los `-wal`/`-shm`). Al cerrar la ventana, Rust no cierra de inmediato:
espera a que el frontend guarde lo pendiente y respalde, y si algo falla no cierra sola, pregunta.
Los adjuntos solo se agregan (la papelera es lógica), así que cada respaldo copia únicamente los
que faltan. Se conservan los últimos 40.

**Una sola definición de campos.** [`src/campos.ts`](src/campos.ts) describe cada campo del
paciente una vez; de ahí salen la lista blanca de columnas guardables, el tipo `Paciente`, el
`INSERT`, el formulario de alta y la edición y lectura de la ficha. Agregar un campo es una
migración y una línea.

**Pruebas contra SQLite real.** Los tests de `db.ts` y de los triggers aplican las migraciones
reales sobre una base en memoria, no sobre mocks de consultas.

**Seguridad.** CSP estricto, validación de nombres de archivo contra recorrido de rutas, y lista
blanca de columnas para el único SQL con nombres interpolados. No hay PIN en la app a propósito:
sin cifrado de disco completo sería solo teatro; el control real es BitLocker (ver abajo).

## Arrancar el proyecto

Requisitos: [Rust](https://rustup.rs), **Node 22.5 o superior** (los tests usan `node:sqlite`) y,
en Windows, *Visual Studio Build Tools* con "Desarrollo para el escritorio con C++".

```bash
npm install
npm run tauri dev      # desarrollo con recarga en caliente
npm run tauri build    # genera el instalador (msi y nsis)
```

```bash
npm test               # Vitest: fechas, folio, búsqueda, base de datos, triggers, CampoAuto
npm run lint           # ESLint
npx tsc                # tipos
cd src-tauri && cargo clippy --all-targets && cargo test
```

La integración continua ([`ci.yml`](.github/workflows/ci.yml)) corre todo lo anterior.

### Datos de demostración

Para probar la app con pacientes ficticios, o para tomar capturas, con la app cerrada:

```bash
node scripts/cargar-demo.mjs --nueva
```

Aparta la base actual (la renombra, no la borra) y crea una nueva con los pacientes de
[`scripts/datos-demo.sql`](scripts/datos-demo.sql). `scripts/crear-base-previa.mjs` fabrica una
base con el esquema de la versión anterior, para probar la actualización.

### Iconos

Pon un PNG de 1024×1024 en `src-tauri/icons/fuente.png` y corre
`npm run tauri icon src-tauri/icons/fuente.png`.

## Dónde vive la información

```
%APPDATA%\com.consultorio.expediente\clinica.db            base de trabajo
%APPDATA%\com.consultorio.expediente\documentos\<id>\      archivos adjuntos
Documentos\Consultorio\Respaldos\clinica_AAAA-MM-DD_HHMMSS.db   respaldos
Documentos\Consultorio\Respaldos\documentos\               respaldo de adjuntos
```

> Los respaldos también deben quedar en un disco cifrado. Si `Documentos` está sincronizado con
> OneDrive u otro servicio en la nube, excluye la carpeta `Consultorio`: de lo contrario las
> copias saldrían del equipo. Ver [SECURITY.md](SECURITY.md).

## Estructura

```
src/
  campos.ts                 definición única de los campos (de aquí sale casi todo)
  db.ts                     todas las consultas, un solo lugar
  tipos.ts                  tipos de las filas
  App.tsx                   estado de nivel superior
  pantallas/                PanelLateral, ListaPacientes, FichaPaciente, FormPaciente
  componentes/              Modal, ModalPapelera, Documentos, Bitacora, ui (Campo, CampoAuto…)
  componentes/ficha/        DatosPaciente, NotasClinicas, FilaSesion, Desplegable
  hooks/                    useCierreSeguro, useAtajo
  utilidades/               fechas, folio, búsqueda, autoguardado, intentar
  pruebas/                  base SQLite en memoria para los tests
src-tauri/
  migrations/               esquema, un .sql por versión (no editar las publicadas)
  src/                      migraciones, respaldos, documentos, acceso_por_voz
scripts/datos-demo.sql      pacientes ficticios
```

## Distribución en Windows

- **SmartScreen:** un instalador sin firma digital muestra "Windows protegió tu PC". Para uso
  público haría falta un certificado de firma de código.
- **WebView2:** el instalador usa el modo `offlineInstaller` (pesa unos 130 MB, pero se instala
  sin internet).

## Privacidad y marco legal (México)

Las notas de psicoterapia son datos personales **sensibles** (LFPDPPP) y el expediente clínico
está regulado por la **NOM-004-SSA3-2012**. El esquema incluye los campos de identificación,
motivo de consulta, antecedentes, impresión diagnóstica, plan de tratamiento y notas de
evolución, más la bitácora. Lo mínimo práctico del lado de quien la usa: **BitLocker** activado
(sin eso, el `.db` es un archivo que cualquiera puede copiar y abrir), aviso de privacidad
firmado por los pacientes y una contraseña de Windows decente. Esto no es asesoría legal.

## Licencia

[MIT](LICENSE) © Víctor Zamora. Los datos de [`scripts/datos-demo.sql`](scripts/datos-demo.sql) son
ficticios.
