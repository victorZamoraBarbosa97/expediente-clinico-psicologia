# Seguridad y alcance

## Este software es solo para uso local

Consultorio **no se comunica con internet de ninguna manera**: no hay servidor, nube, cuentas
de usuario, inicio de sesión, credenciales ni permisos por rol. Los datos de los pacientes
viven en un archivo SQLite en la computadora donde se instala y no salen de ella.

La política de seguridad de la ventana (`csp` en `src-tauri/tauri.conf.json`) solo permite
conexiones internas de la aplicación, y el código fuente no contiene llamadas de red.

## Requisito de uso: disco cifrado

El control de seguridad real es **el cifrado del disco completo (BitLocker en Windows)**. Sin él,
la base de datos es un archivo que cualquiera con acceso al equipo puede copiar y abrir. Por eso
la aplicación no incluye un PIN propio: sin cifrado de disco sería solo apariencia.

Además:

- Contraseña de Windows robusta y bloqueo de pantalla.
- **Los respaldos también deben quedar en un disco cifrado.** Se guardan en
  `Documentos\Consultorio\Respaldos`. Si esa carpeta está sincronizada con OneDrive, Google
  Drive u otro servicio, **las copias saldrían del equipo**. Para conservar el modelo "los datos
  no salen de la computadora", excluye la carpeta `Consultorio` de la sincronización.
- Aviso de privacidad firmado por los pacientes, según la normativa aplicable
  (LFPDPPP, NOM-004-SSA3-2012). Esto no es asesoría legal.

## Qué protege y qué no

| Protege | No protege |
| --- | --- |
| Que los datos viajen por la red o se guarden en la nube (no hay red). | Alguien con acceso a la sesión de Windows abierta. |
| Inyección de SQL en los nombres de columna (lista blanca de campos). | Un equipo sin cifrado de disco. |
| Recorrido de rutas en los archivos adjuntos (se validan los nombres). | Pérdida del equipo sin respaldo en otro lugar seguro. |
| Cambios silenciosos al historial: la bitácora no se puede editar ni borrar. | Un malware con permisos de la usuaria. |

## Reportar un problema

Si encuentras una vulnerabilidad, abre un
[aviso de seguridad privado](../../security/advisories/new) en GitHub o un issue sin datos
sensibles. **Nunca incluyas datos reales de pacientes** en un reporte.
