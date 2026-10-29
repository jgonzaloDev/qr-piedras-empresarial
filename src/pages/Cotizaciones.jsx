import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabase";
import "./Cotizaciones.css";

// ==========================================
// DATOS DE LA EMPRESA
// ==========================================

const EMPRESA = {
  nombre: "QR PIEDRAS NATURALES",
  descripcion: "Piedras naturales y revestimientos",
  telefono: "968603237",

  bcpCuenta: "19492408266080",
  bcpCCI: "00219419240826608094",

  interbankCuenta: "898 3509007421",
  interbankCCI: "00389801350900742146",

  yape: "968603237",
  plin: "968603237",
};

// ==========================================
// FUNCIONES GENERALES
// ==========================================

const TEXTO = (valor) => String(valor ?? "");

const NUMERO = (numero) => {
  if (numero === null || numero === undefined || numero === "") {
    return "BORRADOR";
  }

  return `COT-${String(numero).padStart(6, "0")}`;
};

const HOY = () => {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const NUEVO_ITEM = () => ({
  descripcion: "",
  unidad: "m²",
  cantidad: 1,
  precio_unitario: 0,
});

const FORM_INICIAL = () => ({
  cliente_id: "",
  fecha: HOY(),
  validez_dias: 15,
  moneda: "PEN",
  incluye_igv: true,
  condiciones: "",
  observaciones: "",
  items: [NUEVO_ITEM()],
});

const REDONDEAR = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const DINERO = (valor, moneda = "PEN") =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "PEN",
  }).format(Number(valor) || 0);

const FECHA = (fecha) => {
  if (!fecha) return "—";

  const partes = String(fecha).slice(0, 10).split("-");

  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : String(fecha);
};

const SUMAR_DIAS = (fecha, dias) => {
  const d = new Date(`${fecha}T12:00:00`);

  d.setDate(d.getDate() + Number(dias || 0));

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const CALCULAR = (items, incluyeIgv) => {
  const subtotal = REDONDEAR(
    items.reduce(
      (suma, item) =>
        suma + Number(item.cantidad || 0) * Number(item.precio_unitario || 0),
      0,
    ),
  );

  const igv = incluyeIgv ? REDONDEAR(subtotal * 0.18) : 0;

  return {
    subtotal,
    igv,
    total: REDONDEAR(subtotal + igv),
  };
};

// ==========================================
// GENERAR PDF PROFESIONAL
// ==========================================

function crearPDF(cotizacion, cliente, items) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const ORO = [183, 143, 75];
  const NEGRO = [23, 25, 29];
  const GRIS = [85, 89, 96];

  const MARGEN = 12;
  const ALTO_BANCOS = 49;
  const Y_BANCOS = H - 21 - ALTO_BANCOS;
  const LIMITE_CONTENIDO = Y_BANCOS - 5;

  const moneda = cotizacion.moneda || "PEN";
  const numero = NUMERO(cotizacion.numero);

  const incluyeIgv = cotizacion.incluye_igv ?? cotizacion.aplicar_igv ?? true;

  const totales = CALCULAR(items, incluyeIgv);

  // Evita enviar valores numéricos como texto a jsPDF.
  const escribir = (valor, x, y, opciones = {}) => {
    doc.text(TEXTO(valor), Number(x), Number(y), opciones);
  };

  // ========================================
  // ENCABEZADO
  // ========================================

  const dibujarEncabezado = () => {
    doc.setFillColor(...NEGRO);
    doc.rect(0, 0, W, 33, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(225, 185, 113);

    escribir(EMPRESA.nombre, 12, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(240, 240, 240);

    escribir(EMPRESA.descripcion, 12, 22);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    escribir("COTIZACIÓN", W - 12, 14, {
      align: "right",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    escribir(numero, W - 12, 21, {
      align: "right",
    });
  };

  dibujarEncabezado();

  // ========================================
  // DATOS DE COTIZACIÓN Y CLIENTE
  // ========================================

  let y = 41;

  doc.setTextColor(...NEGRO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);

  escribir("DATOS DE LA COTIZACIÓN", 12, y);
  escribir("DATOS DEL CLIENTE", 108, y);

  y += 4;

  doc.setDrawColor(...ORO);
  doc.line(12, y, W - 12, y);

  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  escribir(`Fecha: ${FECHA(cotizacion.fecha)}`, 12, y);

  escribir(`Validez: ${cotizacion.validez_dias || 15} días`, 12, y + 5);

  escribir(`Moneda: ${moneda === "USD" ? "Dólares" : "Soles"}`, 12, y + 10);

  const datosCliente = [
    TEXTO(cliente?.nombre_razon_social || "Cliente"),

    cliente?.numero_documento
      ? `${TEXTO(
          cliente.tipo_documento || "Documento",
        )}: ${TEXTO(cliente.numero_documento)}`
      : "",

    TEXTO(cliente?.direccion),

    cliente?.telefono ? `Tel: ${TEXTO(cliente.telefono)}` : "",

    TEXTO(cliente?.correo),
  ].filter(Boolean);

  let yCliente = y;

  doc.setFontSize(7.8);

  datosCliente.forEach((dato) => {
    const lineas = doc.splitTextToSize(TEXTO(dato), 88);

    doc.text(lineas.map(TEXTO), 108, yCliente);

    yCliente += lineas.length * 3.8 + 1;
  });

  y = Math.max(y + 18, yCliente + 4);

  // ========================================
  // TABLA DE MATERIALES
  // ========================================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NEGRO);

  escribir("DETALLE DE MATERIALES Y SERVICIOS", 12, y);

  y += 4;

  const filas = items.map((item, indice) => [
    TEXTO(indice + 1),
    TEXTO(item.descripcion),
    TEXTO(item.unidad || "m²"),
    TEXTO(
      Number(item.cantidad || 0).toLocaleString("es-PE", {
        maximumFractionDigits: 2,
      }),
    ),
    TEXTO(DINERO(item.precio_unitario, moneda)),
    TEXTO(
      DINERO(
        Number(item.cantidad || 0) * Number(item.precio_unitario || 0),
        moneda,
      ),
    ),
  ]);

  const cantidad = items.length;

  const tamTabla = cantidad <= 8 ? 7.3 : cantidad <= 15 ? 6.8 : 6.4;

  autoTable(doc, {
    startY: y,

    margin: {
      left: 12,
      right: 12,
      bottom: 19,
    },

    head: [["N.º", "Descripción", "Unidad", "Cant.", "P. unitario", "Importe"]],

    body: filas,
    theme: "grid",

    styles: {
      font: "helvetica",
      fontSize: tamTabla,
      cellPadding: cantidad <= 10 ? 2 : 1.5,
      textColor: NEGRO,
      lineColor: [225, 225, 225],
      lineWidth: 0.12,
      overflow: "linebreak",
      valign: "middle",
    },

    headStyles: {
      fillColor: NEGRO,
      textColor: [225, 185, 113],
      fontStyle: "bold",
    },

    alternateRowStyles: {
      fillColor: [249, 249, 249],
    },

    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 70 },
      2: { cellWidth: 17, halign: "center" },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 31, halign: "right" },
      5: { cellWidth: 40, halign: "right" },
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 7;

  // Continuar en la última página generada por la tabla.
  doc.setPage(doc.internal.getNumberOfPages());

  // ========================================
  // CONTROL DE ESPACIO
  // ========================================

  const asegurarEspacio = (espacio) => {
    if (y + espacio > LIMITE_CONTENIDO) {
      doc.addPage();
      y = 20;
    }
  };

  const tituloSeccion = (titulo) => {
    asegurarEspacio(12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.7);
    doc.setTextColor(...NEGRO);

    escribir(titulo, 12, y);

    y += 3;

    doc.setDrawColor(...ORO);
    doc.line(12, y, W - 12, y);

    y += 6;
  };

  // ========================================
  // TOTALES
  // ========================================

  asegurarEspacio(28);

  const lineaTotal = (titulo, valor, resaltado = false) => {
    doc.setFont("helvetica", resaltado ? "bold" : "normal");

    doc.setFontSize(resaltado ? 10 : 8);
    doc.setTextColor(...NEGRO);

    escribir(titulo, 124, y);

    escribir(DINERO(valor, moneda), W - 12, y, { align: "right" });

    y += resaltado ? 8 : 6;
  };

  lineaTotal("Subtotal", totales.subtotal);
  lineaTotal("IGV (18%)", totales.igv);

  doc.setDrawColor(...ORO);
  doc.line(124, y - 2, W - 12, y - 2);

  y += 3;

  lineaTotal("TOTAL", totales.total, true);

  y += 3;

  // ========================================
  // CONDICIONES COMERCIALES
  // ========================================

  tituloSeccion("CONDICIONES COMERCIALES");

  const condiciones = [
    `La presente cotización tiene una validez de ${
      cotizacion.validez_dias || 15
    } días.`,

    incluyeIgv
      ? "Los precios incluyen IGV (18%)."
      : "Los precios no incluyen IGV.",

    "Forma de pago: A convenir.",

    "Tiempo estimado de ejecución: Según programación acordada.",
  ];

  const condicionesAdicionales = TEXTO(cotizacion.condiciones).trim();

  if (condicionesAdicionales) {
    condiciones.push(condicionesAdicionales);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...GRIS);

  condiciones.forEach((condicion) => {
    const lineas = doc.splitTextToSize(TEXTO(condicion), 177);

    asegurarEspacio(lineas.length * 4 + 2);

    escribir("-", 14, y);

    doc.text(lineas.map(TEXTO), 19, y);

    y += lineas.length * 4 + 1.5;
  });

  y += 3;

  // ========================================
  // OBSERVACIONES
  // ========================================

  const observaciones = TEXTO(cotizacion.observaciones).trim();

  if (observaciones) {
    tituloSeccion("OBSERVACIONES");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(...GRIS);

    const lineas = doc.splitTextToSize(observaciones, 184);

    for (const linea of lineas) {
      asegurarEspacio(5);

      escribir(linea, 12, y);
      y += 4;
    }

    y += 4;
  }

  // ========================================
  // DATOS BANCARIOS AL FINAL DEL PDF
  // ========================================

  const ALTO_RECUADRO_BANCOS = 56;
  const POSICION_BANCOS = H - 21 - ALTO_RECUADRO_BANCOS;

  // Evitar que los datos bancarios se superpongan
  // con el contenido de la cotización.
  if (y > POSICION_BANCOS - 4) {
    doc.addPage();
    y = 20;
  }

  const yBancos = POSICION_BANCOS;

  // Fondo del recuadro
  doc.setFillColor(247, 246, 243);
  doc.roundedRect(12, yBancos, W - 24, ALTO_RECUADRO_BANCOS, 2, 2, "F");

  // Encabezado negro
  doc.setFillColor(...NEGRO);
  doc.roundedRect(12, yBancos, W - 24, 10, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(225, 185, 113);

  escribir("DATOS BANCARIOS Y MEDIOS DE PAGO", W / 2, yBancos + 6.5, {
    align: "center",
  });

  // Nombre completo del titular
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...NEGRO);

  escribir("TITULAR: JUNIOR GONZALO QUIÑONES RAMIREZ", W / 2, yBancos + 16, {
    align: "center",
  });

  doc.setDrawColor(...ORO);
  doc.line(17, yBancos + 19, W - 17, yBancos + 19);

  // ========================================
  // BCP - COLUMNA IZQUIERDA
  // ========================================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NEGRO);

  escribir("BCP - CUENTA EN SOLES", 17, yBancos + 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  escribir("Cuenta: 19492408266080", 17, yBancos + 31);

  escribir("CCI: 00219419240826608094", 17, yBancos + 37);

  // ========================================
  // INTERBANK - COLUMNA DERECHA
  // ========================================

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);

  escribir("INTERBANK - CUENTA SIMPLE SOLES", 108, yBancos + 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  escribir("Cuenta: 898 3509007421", 108, yBancos + 31);

  escribir("CCI: 00389801350900742146", 108, yBancos + 37);

  // ========================================
  // YAPE Y PLIN
  // ========================================

  doc.setDrawColor(220, 215, 205);
  doc.line(17, yBancos + 42, W - 17, yBancos + 42);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ORO);

  escribir("YAPE: 968603237     |     PLIN: 968603237", W / 2, yBancos + 50, {
    align: "center",
  });

  // ========================================
  // PIE DE PÁGINA
  // ========================================

  const totalPaginas = doc.internal.getNumberOfPages();

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);

    doc.setDrawColor(...ORO);

    doc.line(12, H - 14, W - 12, H - 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRIS);

    escribir(
      `${EMPRESA.nombre} | WhatsApp: +51 ${EMPRESA.telefono}`,
      12,
      H - 9,
    );

    escribir(`Página ${pagina} de ${totalPaginas}`, W - 12, H - 9, {
      align: "right",
    });
  }

  // ========================================
  // DESCARGAR ARCHIVO
  // ========================================

  const nombreArchivo = numero.replace(/[^a-zA-Z0-9-]/g, "-");

  doc.save(`QR-PIEDRAS-Cotizacion-${nombreArchivo}.pdf`);
}

// ==========================================
// COMPONENTE COTIZACIONES
// ==========================================

export default function Cotizaciones({ onVolver, onBack }) {
  const [clientes, setClientes] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);

  const [form, setForm] = useState(FORM_INICIAL);

  const [editandoId, setEditandoId] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const avisar = (texto, tipo = "ok") => {
    setMensaje({ texto, tipo });
  };

  // ========================================
  // CARGAR DATOS DE SUPABASE
  // ========================================

  const cargarDatos = useCallback(async () => {
    setCargando(true);

    try {
      const [respuestaClientes, respuestaCotizaciones] = await Promise.all([
        supabase.from("clientes").select("*").order("nombre_razon_social"),

        supabase.from("cotizaciones").select("*").order("creado_en", {
          ascending: false,
        }),
      ]);

      if (respuestaClientes.error) {
        throw respuestaClientes.error;
      }

      if (respuestaCotizaciones.error) {
        throw respuestaCotizaciones.error;
      }

      setClientes(respuestaClientes.data || []);

      setCotizaciones(respuestaCotizaciones.data || []);
    } catch (error) {
      avisar(error.message || "Error al cargar los datos.", "error");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ========================================
  // FORMULARIO
  // ========================================

  const actualizar = (campo, valor) => {
    setForm((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  };

  const actualizarItem = (indice, campo, valor) => {
    setForm((anterior) => ({
      ...anterior,

      items: anterior.items.map((item, posicion) =>
        posicion === indice
          ? {
              ...item,
              [campo]: valor,
            }
          : item,
      ),
    }));
  };

  const agregarItem = () => {
    setForm((anterior) => ({
      ...anterior,
      items: [...anterior.items, NUEVO_ITEM()],
    }));
  };

  const quitarItem = (indice) => {
    setForm((anterior) => ({
      ...anterior,

      items:
        anterior.items.length === 1
          ? [NUEVO_ITEM()]
          : anterior.items.filter((_, posicion) => posicion !== indice),
    }));
  };

  const totales = useMemo(
    () => CALCULAR(form.items, form.incluye_igv),
    [form.items, form.incluye_igv],
  );

  const limpiar = () => {
    setForm(FORM_INICIAL());
    setEditandoId(null);
    setMensaje(null);
  };

  // ========================================
  // GUARDAR COTIZACIÓN
  // ========================================

  const guardar = async (evento) => {
    evento.preventDefault();
    setMensaje(null);

    if (!form.cliente_id) {
      avisar("Selecciona un cliente.", "error");
      return;
    }

    if (
      !form.items.length ||
      form.items.some(
        (item) =>
          !TEXTO(item.descripcion).trim() ||
          !Number.isFinite(Number(item.cantidad)) ||
          Number(item.cantidad) <= 0 ||
          !Number.isFinite(Number(item.precio_unitario)) ||
          Number(item.precio_unitario) < 0,
      )
    ) {
      avisar("Revisa las cantidades, precios y descripciones.", "error");
      return;
    }

    const validez = Number(form.validez_dias);

    if (!Number.isInteger(validez) || validez < 1 || validez > 365) {
      avisar("La validez debe estar entre 1 y 365 días.", "error");
      return;
    }

    setGuardando(true);

    try {
      const parametros = {
        p_cliente_id: form.cliente_id,

        p_fecha: form.fecha,

        p_validez_dias: validez,

        p_moneda: form.moneda,

        p_incluye_igv: form.incluye_igv,

        p_observaciones: form.observaciones,

        p_condiciones: form.condiciones,

        p_items: form.items.map((item) => ({
          descripcion: TEXTO(item.descripcion).trim(),

          unidad: item.unidad,

          cantidad: Number(item.cantidad),

          precio_unitario: Number(item.precio_unitario),
        })),

        p_id: editandoId,
      };

      const cliente = clientes.find(
        (registro) => registro.id === form.cliente_id,
      );

      const { data: idGuardado, error } = await supabase.rpc(
        "guardar_cotizacion",
        parametros,
      );

      if (error) {
        throw error;
      }

      // Guardado confirmado.
      limpiar();

      avisar("Cotización guardada. Preparando PDF...");

      try {
        const { data: guardada, error: errorConsulta } = await supabase
          .from("cotizaciones")
          .select("*")
          .eq("id", idGuardado)
          .single();

        if (errorConsulta) {
          throw errorConsulta;
        }

        crearPDF(guardada, cliente, parametros.p_items);

        avisar(
          `${NUMERO(guardada.numero)} guardada y PDF generado correctamente.`,
        );
      } catch (errorPDF) {
        console.error("ERROR PDF:", errorPDF, errorPDF.stack);

        avisar(
          "La cotización se guardó, pero falló el PDF: " + errorPDF.message,
          "error",
        );
      }

      await cargarDatos();
    } catch (error) {
      console.error("ERROR AL GUARDAR:", error);

      avisar(error.message || "No se pudo guardar.", "error");
    } finally {
      setGuardando(false);
    }
  };

  // ========================================
  // OBTENER ÍTEMS
  // ========================================

  const obtenerItems = async (id) => {
    const { data, error } = await supabase
      .from("cotizacion_items")
      .select("*")
      .eq("cotizacion_id", id)
      .order("orden");

    if (error) {
      throw error;
    }

    return data || [];
  };

  // ========================================
  // DESCARGAR PDF
  // ========================================

  const descargarPDF = async (cotizacion) => {
    try {
      const items = await obtenerItems(cotizacion.id);

      const cliente = clientes.find(
        (registro) => registro.id === cotizacion.cliente_id,
      );

      crearPDF(cotizacion, cliente, items);

      avisar("PDF generado correctamente.");
    } catch (error) {
      console.error("ERROR PDF:", error, error.stack);

      avisar(`No se pudo generar el PDF: ${error.message}`, "error");
    }
  };

  // ========================================
  // EDITAR COTIZACIÓN
  // ========================================

  const editar = async (cotizacion) => {
    if (cotizacion.estado !== "borrador") {
      avisar("Solo puedes editar cotizaciones en borrador.", "error");
      return;
    }

    try {
      const items = await obtenerItems(cotizacion.id);

      setForm({
        cliente_id: cotizacion.cliente_id,

        fecha: cotizacion.fecha,

        validez_dias: cotizacion.validez_dias || 15,

        moneda: cotizacion.moneda || "PEN",

        incluye_igv: cotizacion.incluye_igv ?? cotizacion.aplicar_igv ?? true,

        condiciones: cotizacion.condiciones || "",

        observaciones: cotizacion.observaciones || "",

        items: items.length
          ? items.map((item) => ({
              descripcion: item.descripcion,

              unidad: item.unidad,

              cantidad: item.cantidad,

              precio_unitario: item.precio_unitario,
            }))
          : [NUEVO_ITEM()],
      });

      setEditandoId(cotizacion.id);

      setMensaje(null);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      avisar(error.message, "error");
    }
  };

  // ========================================
  // BUSCADOR
  // ========================================

  const filtradas = cotizaciones.filter((cotizacion) => {
    const cliente = clientes.find(
      (registro) => registro.id === cotizacion.cliente_id,
    );

    return [
      NUMERO(cotizacion.numero),
      cotizacion.numero,
      cotizacion.estado,
      cliente?.nombre_razon_social,
      cliente?.numero_documento,
    ]
      .map(TEXTO)
      .join(" ")
      .toLowerCase()
      .includes(busqueda.toLowerCase());
  });

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <main className="qr-cot">
      <header className="qr-cot-header">
        <div>
          <div className="qr-cot-brand">QR PIEDRAS NATURALES</div>

          <h1>Cotizaciones comerciales</h1>

          <p>Propuestas profesionales para proyectos de revestimiento</p>
        </div>

        <button
          type="button"
          className="qr-cot-gold"
          onClick={() => {
            const volver = onVolver || onBack;

            if (typeof volver === "function") {
              volver();
            }
          }}
        >
          ← Volver al Dashboard
        </button>
      </header>

      {mensaje && (
        <div className={`qr-cot-alert ${mensaje.tipo}`}>{mensaje.texto}</div>
      )}

      <section className="qr-cot-panel">
        <div className="qr-cot-panel-head">
          <h2>{editandoId ? "Editar cotización" : "Nueva cotización"}</h2>

          <span>PDF A4 profesional</span>
        </div>

        <form onSubmit={guardar}>
          <div className="qr-cot-grid">
            <label className="span2">
              Cliente
              <select
                required
                value={form.cliente_id}
                onChange={(e) => actualizar("cliente_id", e.target.value)}
              >
                <option value="">Seleccionar cliente</option>

                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre_razon_social}
                    {cliente.numero_documento
                      ? ` — ${cliente.numero_documento}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Fecha
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => actualizar("fecha", e.target.value)}
              />
            </label>

            <label>
              Validez (días)
              <input
                type="number"
                min="1"
                max="365"
                required
                value={form.validez_dias}
                onChange={(e) => actualizar("validez_dias", e.target.value)}
              />
            </label>

            <label>
              Moneda
              <select
                value={form.moneda}
                onChange={(e) => actualizar("moneda", e.target.value)}
              >
                <option value="PEN">Soles (PEN)</option>

                <option value="USD">Dólares (USD)</option>
              </select>
            </label>

            <label className="qr-cot-check">
              <input
                type="checkbox"
                checked={form.incluye_igv}
                onChange={(e) => actualizar("incluye_igv", e.target.checked)}
              />
              Agregar IGV (18 %)
            </label>
          </div>

          <div className="qr-cot-subhead">
            <h3>Detalle de materiales y servicios</h3>

            <button type="button" onClick={agregarItem}>
              + Agregar concepto
            </button>
          </div>

          <div className="qr-cot-scroll">
            <table className="qr-cot-table qr-cot-items">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Unidad</th>
                  <th>Cantidad</th>
                  <th>Precio unitario</th>
                  <th>Importe</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {form.items.map((item, indice) => (
                  <tr key={indice}>
                    <td>
                      <input
                        required
                        placeholder="Ej. Laja ayacuchana 10x10"
                        value={item.descripcion}
                        onChange={(e) =>
                          actualizarItem(indice, "descripcion", e.target.value)
                        }
                      />
                    </td>

                    <td>
                      <select
                        value={item.unidad}
                        onChange={(e) =>
                          actualizarItem(indice, "unidad", e.target.value)
                        }
                      >
                        <option value="m²">m²</option>

                        <option value="ml">ml</option>

                        <option value="und">und</option>

                        <option value="m³">m³</option>

                        <option value="servicio">Servicio</option>
                      </select>
                    </td>

                    <td>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={item.cantidad}
                        onChange={(e) =>
                          actualizarItem(indice, "cantidad", e.target.value)
                        }
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={item.precio_unitario}
                        onChange={(e) =>
                          actualizarItem(
                            indice,
                            "precio_unitario",
                            e.target.value,
                          )
                        }
                      />
                    </td>

                    <td className="qr-cot-amount">
                      {DINERO(
                        Number(item.cantidad) * Number(item.precio_unitario),
                        form.moneda,
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="qr-cot-danger"
                        onClick={() => quitarItem(indice)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="qr-cot-total">
            <div>
              <span>Subtotal</span>

              <strong>{DINERO(totales.subtotal, form.moneda)}</strong>
            </div>

            <div>
              <span>IGV (18 %)</span>

              <strong>{DINERO(totales.igv, form.moneda)}</strong>
            </div>

            <div className="qr-cot-grand">
              <span>TOTAL</span>

              <strong>{DINERO(totales.total, form.moneda)}</strong>
            </div>
          </div>

          <div className="qr-cot-grid">
            <label className="span3">
              Condiciones adicionales
              <textarea
                rows="3"
                placeholder="Condiciones particulares para esta cotización"
                value={form.condiciones}
                onChange={(e) => actualizar("condiciones", e.target.value)}
              />
            </label>

            <label className="span3">
              Observaciones
              <textarea
                rows="3"
                placeholder="Observaciones para el cliente"
                value={form.observaciones}
                onChange={(e) => actualizar("observaciones", e.target.value)}
              />
            </label>
          </div>

          <div className="qr-cot-actions">
            <button className="qr-cot-gold" type="submit" disabled={guardando}>
              {guardando
                ? "Guardando..."
                : editandoId
                  ? "Actualizar y generar PDF"
                  : "Guardar y generar PDF"}
            </button>

            <button type="button" onClick={limpiar}>
              Limpiar formulario
            </button>
          </div>
        </form>
      </section>

      <section className="qr-cot-panel">
        <div className="qr-cot-panel-head">
          <div>
            <h2>Cotizaciones registradas ({cotizaciones.length})</h2>

            <p>Consulta y administra tus propuestas comerciales.</p>
          </div>

          <button type="button" onClick={cargarDatos}>
            ↻ Actualizar
          </button>
        </div>

        <input
          className="qr-cot-search"
          placeholder="Buscar por número, cliente o estado..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="qr-cot-scroll">
          <table className="qr-cot-table">
            <thead>
              <tr>
                <th>Número</th>

                <th>Cliente</th>

                <th>Fecha</th>

                <th>Estado</th>

                <th>Total</th>

                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtradas.map((cotizacion) => {
                const cliente = clientes.find(
                  (registro) => registro.id === cotizacion.cliente_id,
                );

                return (
                  <tr key={cotizacion.id}>
                    <td>{NUMERO(cotizacion.numero)}</td>

                    <td>{cliente?.nombre_razon_social || "—"}</td>

                    <td>{FECHA(cotizacion.fecha)}</td>

                    <td>
                      <span className="qr-cot-status">{cotizacion.estado}</span>
                    </td>

                    <td className="qr-cot-amount">
                      {DINERO(cotizacion.total, cotizacion.moneda)}
                    </td>

                    <td>
                      <div className="qr-cot-rowactions">
                        <button
                          type="button"
                          onClick={() => descargarPDF(cotizacion)}
                        >
                          PDF
                        </button>

                        {cotizacion.estado === "borrador" && (
                          <button
                            type="button"
                            onClick={() => editar(cotizacion)}
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filtradas.length && (
                <tr>
                  <td colSpan="6" className="qr-cot-empty">
                    {cargando
                      ? "Cargando cotizaciones..."
                      : "No se encontraron cotizaciones."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="qr-cot-footer">
        QR PIEDRAS NATURALES · Sistema de Gestión Empresarial
      </footer>
    </main>
  );
}
