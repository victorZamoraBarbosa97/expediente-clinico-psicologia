import { useCallback, useEffect, useState } from "react";
import { open as elegirArchivos } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  Upload,
  FolderOpen,
  Trash2,
  Image as IconImagen,
  FileText,
  FileSpreadsheet,
  FileArchive,
  File as IconArchivo,
} from "lucide-react";
import {
  abrirCarpetaDocumentos,
  abrirDocumento,
  copiarDocumento,
  crearDocumento,
  eliminarDocumento,
  listarDocumentos,
  papeleraDocumentos,
  restaurarDocumento,
  revelarDocumento,
} from "../db";
import type { Documento } from "../tipos";
import { intentar, mensajeDe } from "../utilidades/intentar";
import type { Avisar } from "../utilidades/intentar";
import { Confirmar } from "./ui";
import Miniatura from "./Miniatura";
import ModalPapelera from "./ModalPapelera";

const EXT_IMAGEN = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
const EXT_HOJA = ["xls", "xlsx", "csv"];
const EXT_COMPRIMIDO = ["zip", "rar", "7z"];

function icono(tipo: string | null) {
  const t = (tipo ?? "").toLowerCase();
  if (EXT_IMAGEN.includes(t)) return <IconImagen size={32} aria-hidden="true" />;
  if (EXT_HOJA.includes(t)) return <FileSpreadsheet size={32} aria-hidden="true" />;
  if (EXT_COMPRIMIDO.includes(t)) return <FileArchive size={32} aria-hidden="true" />;
  if (t === "pdf" || t === "doc" || t === "docx" || t === "txt")
    return <FileText size={32} aria-hidden="true" />;
  return <IconArchivo size={32} aria-hidden="true" />;
}

function formatoTamano(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Documentos({
  pacienteId,
  pacienteNombre,
  avisar,
}: {
  pacienteId: number;
  pacienteNombre: string;
  avisar: Avisar;
}) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [eliminados, setEliminados] = useState<Documento[] | null>(null);
  const [porBorrar, setPorBorrar] = useState<Documento | null>(null);

  const cargar = useCallback(async () => {
    setDocumentos(await listarDocumentos(pacienteId));
  }, [pacienteId]);

  useEffect(() => {
    cargar().catch((e) => avisar("No se pudieron leer los archivos adjuntos. " + mensajeDe(e), true));
  }, [cargar, avisar]);

  const subirDesdeRutas = useCallback(
    async (rutas: string[]) => {
      let subidos = 0;
      for (const ruta of rutas) {
        try {
          const copia = await copiarDocumento(pacienteId, ruta);
          await crearDocumento(
            pacienteId,
            copia.nombreOriginal,
            copia.extension,
            copia.nombre,
            copia.tamano
          );
          subidos++;
        } catch (e) {
          avisar(mensajeDe(e), true);
        }
      }
      if (subidos > 0) {
        await intentar(avisar, "No se pudo actualizar la lista de archivos.", cargar);
        avisar(subidos === 1 ? "Archivo adjuntado" : `${subidos} archivos adjuntados`);
      }
    },
    [pacienteId, cargar, avisar]
  );

  // Tauri no da un "target" por elemento: el evento es del webview completo. Como
  // este componente solo esta montado mientras hay un expediente abierto, soltar
  // un archivo en cualquier parte de la ventana en ese momento lo adjunta aqui.
  useEffect(() => {
    let cancelado = false;
    let quitar: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent((e) => {
        if (e.payload.type === "enter" || e.payload.type === "over") {
          setArrastrando(true);
        } else if (e.payload.type === "drop") {
          setArrastrando(false);
          void subirDesdeRutas(e.payload.paths);
        } else {
          setArrastrando(false);
        }
      })
      .then((fn) => {
        if (cancelado) fn();
        else quitar = fn;
      });
    return () => {
      cancelado = true;
      quitar?.();
    };
  }, [subirDesdeRutas]);

  const elegirYSubir = async () => {
    const rutas = await intentar(avisar, "No se pudo abrir el selector de archivos.", () =>
      elegirArchivos({ multiple: true })
    );
    if (!rutas) return;
    await subirDesdeRutas(Array.isArray(rutas) ? rutas : [rutas]);
  };

  const abrirPapelera = async () => {
    const lista = await intentar(avisar, "No se pudo abrir la papelera de archivos.", () =>
      papeleraDocumentos(pacienteId)
    );
    if (lista) setEliminados(lista);
  };

  const borrar = async (doc: Documento) => {
    setPorBorrar(null);
    const ok = await intentar(avisar, "No se pudo eliminar el archivo.", async () => {
      await eliminarDocumento(doc.id);
      await cargar();
    });
    if (ok !== undefined) avisar("Archivo movido a la Papelera");
  };

  const restaurar = async (id: number) => {
    await restaurarDocumento(id);
    setEliminados(await papeleraDocumentos(pacienteId));
    await cargar();
    avisar("Archivo restaurado");
  };

  return (
    <section className="documentos">
      <div className="documentos-cabecera">
        <h3 className="titulo-seccion sin-margen">
          Archivos adjuntos <span className="contador">({documentos.length})</span>
        </h3>
        <div className="documentos-botones no-imprimir">
          <button className="btn secundario mini" onClick={() => void elegirYSubir()}>
            <Upload size={16} aria-hidden="true" />
            Adjuntar archivo
          </button>
          <button className="btn secundario mini" onClick={() => void abrirPapelera()}>
            <Trash2 size={16} aria-hidden="true" />
            Papelera de archivos
          </button>
        </div>
      </div>

      {documentos.length === 0 ? (
        <p className="texto-suave">
          Todavía no hay archivos adjuntos. Usa “Adjuntar archivo” o arrastra uno sobre esta
          ventana para agregarlo.
        </p>
      ) : (
        <div className="documentos-explorador">
          {documentos.map((doc) => (
            <div className="documento-tarjeta" key={doc.id}>
              <button
                type="button"
                className="documento-abrir"
                title={`Abrir ${doc.titulo}`}
                onClick={() =>
                  void intentar(avisar, "No se pudo abrir el archivo.", () =>
                    abrirDocumento(pacienteId, doc.ruta)
                  )
                }
              >
                <Miniatura
                  pacienteId={pacienteId}
                  ruta={doc.ruta}
                  tipo={doc.tipo}
                  alternativa={icono(doc.tipo)}
                />
                <span className="documento-nombre">{doc.titulo}</span>
                {doc.tamano_bytes ? (
                  <span className="documento-tamano">{formatoTamano(doc.tamano_bytes)}</span>
                ) : null}
              </button>
              <div className="documento-acciones no-imprimir">
                <button
                  type="button"
                  className="documento-mini"
                  title="Mostrar en su carpeta"
                  aria-label={`Mostrar ${doc.titulo} en su carpeta`}
                  onClick={() =>
                    void intentar(avisar, "No se pudo mostrar el archivo.", () =>
                      revelarDocumento(pacienteId, doc.ruta)
                    )
                  }
                >
                  <FolderOpen size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="documento-mini peligro"
                  title="Eliminar archivo"
                  aria-label={`Eliminar ${doc.titulo}`}
                  onClick={() => setPorBorrar(doc)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {arrastrando && (
        <div className="zona-arrastre">
          <div className="zona-arrastre-caja">
            <Upload size={40} aria-hidden="true" />
            <p>Suelta el archivo para adjuntarlo al expediente de {pacienteNombre}</p>
          </div>
        </div>
      )}

      {porBorrar && (
        <Confirmar
          titulo="¿Eliminar este archivo?"
          detalle={`"${porBorrar.titulo}" pasa a la Papelera de archivos y se puede restaurar cuando haga falta.`}
          textoBoton="Sí, eliminar"
          onSi={() => void borrar(porBorrar)}
          onNo={() => setPorBorrar(null)}
        />
      )}

      {eliminados && (
        <ModalPapelera
          titulo="Papelera de archivos"
          descripcion="Los archivos eliminados de este expediente se guardan aquí. Nada se borra de verdad del disco."
          items={eliminados.map((doc) => ({
            id: doc.id,
            titulo: doc.titulo,
            icono: icono(doc.tipo),
          }))}
          onRestaurar={restaurar}
          onCerrar={() => setEliminados(null)}
          pieExtra={
            <button
              className="btn secundario"
              onClick={() =>
                void intentar(avisar, "No se pudo abrir la carpeta.", () =>
                  abrirCarpetaDocumentos(pacienteId)
                )
              }
            >
              <FolderOpen size={20} aria-hidden="true" />
              Abrir carpeta de archivos
            </button>
          }
        />
      )}
    </section>
  );
}
