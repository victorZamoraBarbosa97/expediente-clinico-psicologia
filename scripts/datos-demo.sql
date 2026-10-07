-- Datos 100% ficticios para capturas de pantalla y demos. Ninguna persona real.
--
-- Uso (con la app cerrada; abre la app una vez antes para que cree la base):
--
--   node scripts/cargar-demo.mjs
--
-- Aplica este archivo a la base de la app. Con sqlite3 a mano tambien sirve:
--   sqlite3 "%APPDATA%\com.consultorio.expediente\clinica.db" < scripts/datos-demo.sql

BEGIN;

INSERT INTO pacientes
  (folio, nombre, fecha_nacimiento, sexo, telefono, email, domicilio, ocupacion,
   estado_civil, escolaridad, tipo_paciente, emergencia_nombre, emergencia_telefono,
   emergencia_parentesco, motivo_consulta, antecedentes, salud, impresion_diagnostica,
   plan_tratamiento, fecha_ingreso)
VALUES
  ('EXP-2026-001', 'Lucía Hernández Ortega', '1991-04-12', 'Mujer', '555 010 0001',
   'lucia.demo@example.com', 'Calle Ejemplo 123, Col. Demo', 'Diseñadora', 'Soltera/o',
   'Licenciatura', 'Adulto', 'Marta Ortega', '555 010 0002', 'Madre',
   'Refiere ansiedad constante en el trabajo y dificultad para dormir desde hace tres meses.',
   'Sin terapias previas.', 'Sin enfermedades crónicas. Café en exceso.',
   'Trastorno de ansiedad generalizada (hipótesis).',
   'Terapia cognitivo-conductual, sesiones semanales. Higiene del sueño y respiración.',
   '2026-02-03'),
  ('EXP-2026-002', 'Mateo Ramírez Solís', '2013-09-30', 'Hombre', NULL, NULL,
   'Av. Muestra 45, Col. Demo', 'Estudiante', NULL, 'Primaria', 'Niño, niña o adolescente',
   'Elena Solís', '555 010 0004', 'Madre',
   'La madre refiere berrinches frecuentes y bajo rendimiento escolar.',
   NULL, 'Alergia estacional.', NULL, NULL, '2026-03-10'),
  ('EXP-2026-003', 'Carlos Mendoza Vega', '1978-11-02', 'Hombre', '555 010 0005',
   NULL, NULL, 'Contador', 'Casada/o', 'Licenciatura', 'Adulto', NULL, NULL, NULL,
   'Duelo por la pérdida de su padre hace seis meses.', NULL, NULL, NULL, NULL, '2026-04-21');

UPDATE pacientes SET madre_nombre = 'Elena Solís', madre_telefono = '555 010 0004',
  padre_nombre = 'Jorge Ramírez', padre_telefono = '555 010 0006'
  WHERE folio = 'EXP-2026-002';

-- Sesiones de Lucía (paciente 1)
INSERT INTO sesiones (paciente_id, numero, fecha, hora, duracion_min, modalidad, asistio,
                      notas_evolucion, intervenciones, tareas, proxima_cita)
SELECT id, 1, '2026-02-03', '17:00', 50, 'Presencial', 1,
       'Primera entrevista. Llega puntual, colaboradora. Describe presión laboral.',
       'Entrevista inicial, psicoeducación sobre ansiedad.', 'Registro de sueño.', '2026-02-10'
  FROM pacientes WHERE folio = 'EXP-2026-001';
INSERT INTO sesiones (paciente_id, numero, fecha, hora, duracion_min, modalidad, asistio,
                      notas_evolucion, intervenciones, tareas, proxima_cita)
SELECT id, 2, '2026-02-10', '17:00', 50, 'Presencial', 1,
       'Reporta dos noches de mejor sueño. Se trabajó identificación de pensamientos automáticos.',
       'Reestructuración cognitiva, respiración diafragmática.', 'Practicar respiración 2 veces al día.', '2026-02-17'
  FROM pacientes WHERE folio = 'EXP-2026-001';
INSERT INTO sesiones (paciente_id, numero, fecha, hora, duracion_min, modalidad, asistio)
SELECT id, 3, '2026-02-17', '17:00', 50, 'Videollamada', 0
  FROM pacientes WHERE folio = 'EXP-2026-001';

-- Sesión de Mateo (paciente 2)
INSERT INTO sesiones (paciente_id, numero, fecha, hora, duracion_min, modalidad, asistio,
                      notas_evolucion, tareas)
SELECT id, 1, '2026-03-10', '16:00', 45, 'Presencial', 1,
       'Sesión de juego libre. Se muestra reservado al inicio y luego participativo.',
       'Tabla de emociones con la madre.'
  FROM pacientes WHERE folio = 'EXP-2026-002';

-- La bitacora no se llena aqui: los triggers (migracion 007) anotan solos las altas.

COMMIT;
