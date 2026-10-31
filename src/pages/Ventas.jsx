
import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabase";
import "./Ventas.css";

const EMPRESA = {
  nombre: "QR PIEDRAS NATURALES",
  titular: "JUNIOR GONZALO QUIÑONES RAMIREZ",
  telefono: "968603237",
  bcp: "19492408266080",
  bcpCCI: "00219419240826608094",
  interbank: "898 3509007421",
  interbankCCI: "00389801350900742146",
  yape: "968603237",
  plin: "968603237",
};

const texto = (v) => String(v ?? "");
const numeroVenta = (n) =>
  n == null ? "BORRADOR" : `VEN-${String(n).padStart(6, "0")}`;
const numeroCotizacion = (n) =>
  n == null ? "COT" : `COT-${String(n).padStart(6, "0")}`;

const hoy = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const fechaPE = (v) => {
  if (!v) return "—";
  const p = texto(v).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : texto(v);
};

const dinero = (n, moneda = "PEN") =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "PEN",
  }).format(Number(n) || 0);

const itemNuevo = () => ({
  descripcion: "",
  unidad: "m²",
  cantidad: 1,
  precio_unitario: 0,
});

const formularioNuevo = () => ({
  origen: "directa",
  cliente_id: "",
  cotizacion_id: "",
  fecha: hoy(),
  moneda: "PEN",
  incluye_igv: true,
  descuento: 0,
  observaciones: "",
  items: [itemNuevo()],
});

const calcular = (items, descuento, incluyeIgv) => {
  const subtotal = Math.round(
    items.reduce(
      (s, i) =>
        s +
        Number(i.cantidad || 0) *
          Number(i.precio_unitario || 0),
      0
    ) * 100
  ) / 100;

  const desc = Number(descuento || 0);
  const base = Math.max(0, subtotal - desc);
  const igv = incluyeIgv
    ? Math.round(base * 0.18 * 100) / 100
    : 0;

  return {
    subtotal,
    descuento: desc,
    igv,
    total: Math.round((base + igv) * 100) / 100,
  };
};

// ==========================================
// PDF DE NOTA DE VENTA
// ==========================================

function generarPDF(venta, cliente, items, pagos) {
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
  });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const NEGRO = [22, 23, 26];
  const ORO = [183, 143, 75];
  const GRIS = [90, 93, 98];

  const escribir = (v, x, y, opciones = {}) => {
    doc.text(texto(v), x, y, opciones);
  };

  doc.setFillColor(...NEGRO);
  doc.rect(0, 0, W, 34, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...ORO);
  escribir(EMPRESA.nombre, 12, 14);

  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  escribir("NOTA DE VENTA", 12, 23);

  doc.setFontSize(10);
  escribir(numeroVenta(venta.numero), W - 12, 16, {
    align: "right",
  });

  let y = 43;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NEGRO);
  escribir("DATOS DE LA VENTA", 12, y);
  escribir("CLIENTE", 108, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  escribir(`Fecha: ${fechaPE(venta.fecha)}`, 12, y);
  escribir(`Estado: ${texto(venta.estado).toUpperCase()}`, 12, y + 5);
  escribir(
    `Origen: ${venta.origen === "cotizacion" ? "Cotización" : "Directa"}`,
    12,
    y + 10
  );

  const datosCliente = [
    cliente?.nombre_razon_social || "Cliente",
    cliente?.numero_documento
      ? `${cliente.tipo_documento || "Documento"}: ${cliente.numero_documento}`
      : "",
    cliente?.direccion || "",
    cliente?.telefono ? `Tel: ${cliente.telefono}` : "",
  ].filter(Boolean);

  let yc = y;
  for (const dato of datosCliente) {
    const lineas = doc.splitTextToSize(texto(dato), 88);
    doc.text(lineas.map(texto), 108, yc);
    yc += lineas.length * 4 + 1;
  }

  y = Math.max(y + 19, yc + 4);

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12, bottom: 18 },
    head: [[
      "N.º",
      "Descripción",
      "Unidad",
      "Cantidad",
      "P. unitario",
      "Importe",
    ]],
    body: items.map((i, index) => [
      texto(index + 1),
      texto(i.descripcion),
      texto(i.unidad),
      texto(i.cantidad),
      dinero(i.precio_unitario, venta.moneda),
      dinero(i.importe ?? (
        Number(i.cantidad) * Number(i.precio_unitario)
      ), venta.moneda),
    ]),
    theme: "grid",
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
      lineColor: [225, 225, 225],
      textColor: NEGRO,
    },
    headStyles: {
      fillColor: NEGRO,
      textColor: ORO,
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 66 },
      2: { cellWidth: 18 },
      3: { cellWidth: 20, halign: "right" },
      4: { cellWidth: 34, halign: "right" },
      5: { cellWidth: 38, halign: "right" },
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 8;
  doc.setPage(doc.internal.getNumberOfPages());

  const asegurar = (alto) => {
    if (y + alto > H - 18) {
      doc.addPage();
      y = 20;
    }
  };

  const titulo = (v) => {
    asegurar(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NEGRO);
    escribir(v, 12, y);
    y += 4;
    doc.setDrawColor(...ORO);
    doc.line(12, y, W - 12, y);
    y += 6;
  };

  asegurar(38);

  const lineaTotal = (nombre, valor, negrita = false) => {
    doc.setFont("helvetica", negrita ? "bold" : "normal");
    doc.setFontSize(negrita ? 10 : 8);
    doc.setTextColor(...NEGRO);
    escribir(nombre, 122, y);
    escribir(dinero(valor, venta.moneda), W - 12, y, {
      align: "right",
    });
    y += negrita ? 8 : 6;
  };

  lineaTotal("Subtotal", venta.subtotal);
  lineaTotal("Descuento", venta.descuento);
  lineaTotal("IGV", venta.igv);
  lineaTotal("TOTAL", venta.total, true);

  y += 3;
  titulo("ESTADO DE COBRO");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  escribir(
    `Monto pagado: ${dinero(venta.monto_pagado, venta.moneda)}`,
    12,
    y
  );
  escribir(
    `Saldo pendiente: ${dinero(venta.saldo, venta.moneda)}`,
    105,
    y
  );
  y += 7;

  if (pagos.length) {
    asegurar(10);
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    for (const pago of pagos) {
      asegurar(5);
      escribir(
        `${fechaPE(pago.fecha)} | ${pago.metodo} | ${dinero(pago.monto, venta.moneda)}`,
        12,
        y
      );
      y += 5;
    }
  }

  if (venta.observaciones) {
    y += 4;
    titulo("OBSERVACIONES");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lineas = doc.splitTextToSize(
      texto(venta.observaciones),
      W - 24
    );
    for (const linea of lineas) {
      asegurar(5);
      escribir(linea, 12, y);
      y += 4.5;
    }
  }

  // Recuadro bancario al final de la última hoja.
  const ALTO_BANCOS = 55;
  const Y_BANCOS = H - 20 - ALTO_BANCOS;

  if (y > Y_BANCOS - 4) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(247, 246, 243);
  doc.roundedRect(12, Y_BANCOS, W - 24, ALTO_BANCOS, 2, 2, "F");

  doc.setFillColor(...NEGRO);
  doc.rect(12, Y_BANCOS, W - 24, 10, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ORO);
  escribir(
    "DATOS BANCARIOS Y MEDIOS DE PAGO",
    W / 2,
    Y_BANCOS + 6.5,
    { align: "center" }
  );

  doc.setFontSize(8);
  doc.setTextColor(...NEGRO);
  escribir(
    `TITULAR: ${EMPRESA.titular}`,
    W / 2,
    Y_BANCOS + 16,
    { align: "center" }
  );

  doc.setDrawColor(...ORO);
  doc.line(17, Y_BANCOS + 19, W - 17, Y_BANCOS + 19);

  doc.setFontSize(8);
  escribir("BCP - SOLES", 17, Y_BANCOS + 25);
  escribir("INTERBANK - SOLES", 108, Y_BANCOS + 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.3);

  escribir(`Cuenta: ${EMPRESA.bcp}`, 17, Y_BANCOS + 31);
  escribir(`CCI: ${EMPRESA.bcpCCI}`, 17, Y_BANCOS + 37);

  escribir(
    `Cuenta: ${EMPRESA.interbank}`,
    108,
    Y_BANCOS + 31
  );
  escribir(
    `CCI: ${EMPRESA.interbankCCI}`,
    108,
    Y_BANCOS + 37
  );

  doc.setDrawColor(220, 215, 205);
  doc.line(17, Y_BANCOS + 42, W - 17, Y_BANCOS + 42);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...ORO);
  escribir(
    `YAPE: ${EMPRESA.yape}    |    PLIN: ${EMPRESA.plin}`,
    W / 2,
    Y_BANCOS + 49,
    { align: "center" }
  );

  const paginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(...ORO);
    doc.line(12, H - 14, W - 12, H - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRIS);
    escribir(
      `${EMPRESA.nombre} | WhatsApp: ${EMPRESA.telefono}`,
      12,
      H - 9
    );
    escribir(`Página ${p} de ${paginas}`, W - 12, H - 9, {
      align: "right",
    });
  }

  doc.save(`QR-PIEDRAS-${numeroVenta(venta.numero)}.pdf`);
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function Ventas({ onVolver, onBack }) {
  const [clientes, setClientes] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [form, setForm] = useState(formularioNuevo);
  const [busqueda, setBusqueda] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [pagoVenta, setPagoVenta] = useState(null);
  const [pagoForm, setPagoForm] = useState({
    monto: "",
    metodo: "transferencia",
    referencia: "",
  });
  const [procesandoPago, setProcesandoPago] = useState(false);

  const avisar = (contenido, tipo = "ok") =>
    setMensaje({ contenido, tipo });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [rc, rq, rv] = await Promise.all([
        supabase.from("clientes").select("*")
          .order("nombre_razon_social"),
        supabase.from("cotizaciones").select("*")
          .order("creado_en", { ascending: false }),
        supabase.from("ventas").select("*")
          .order("creado_en", { ascending: false }),
      ]);

      if (rc.error) throw rc.error;
      if (rq.error) throw rq.error;
      if (rv.error) throw rv.error;

      setClientes(rc.data || []);
      setCotizaciones(rq.data || []);
      setVentas(rv.data || []);
    } catch (error) {
      avisar(error.message, "error");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const cambiar = (campo, valor) =>
    setForm((anterior) => ({ ...anterior, [campo]: valor }));

  const cambiarOrigen = (origen) => {
    setForm({
      ...formularioNuevo(),
      origen,
    });
    setMensaje(null);
  };

  const cambiarItem = (indice, campo, valor) => {
    setForm((anterior) => ({
      ...anterior,
      items: anterior.items.map((item, i) =>
        i === indice ? { ...item, [campo]: valor } : item
      ),
    }));
  };

  const agregarItem = () => {
    setForm((anterior) => ({
      ...anterior,
      items: [...anterior.items, itemNuevo()],
    }));
  };

  const quitarItem = (indice) => {
    setForm((anterior) => ({
      ...anterior,
      items: anterior.items.length > 1
        ? anterior.items.filter((_, i) => i !== indice)
        : [itemNuevo()],
    }));
  };

  const cotizacionesDisponibles = useMemo(() => {
    const usadas = new Set(
      ventas.filter((v) => v.cotizacion_id)
        .map((v) => v.cotizacion_id)
    );
    return cotizaciones.filter(
      (c) => c.estado !== "anulada" && !usadas.has(c.id)
    );
  }, [cotizaciones, ventas]);

  const seleccionarCotizacion = async (id) => {
    if (!id) {
      setForm({
        ...formularioNuevo(),
        origen: "cotizacion",
      });
      return;
    }

    try {
      const cot = cotizaciones.find((c) => c.id === id);
      if (!cot) throw new Error("Cotización no encontrada");

      const { data, error } = await supabase
        .from("cotizacion_items")
        .select("*")
        .eq("cotizacion_id", id)
        .order("orden");

      if (error) throw error;

      setForm((anterior) => ({
        ...anterior,
        origen: "cotizacion",
        cotizacion_id: id,
        cliente_id: cot.cliente_id,
        moneda: cot.moneda || "PEN",
        incluye_igv:
          cot.incluye_igv ?? cot.aplicar_igv ?? true,
        descuento: Number(cot.descuento || 0),
        observaciones: cot.observaciones || "",
        items: (data || []).map((i) => ({
          descripcion: i.descripcion,
          unidad: i.unidad,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
        })),
      }));
    } catch (error) {
      avisar(error.message, "error");
    }
  };

  const totales = useMemo(
    () => calcular(
      form.items,
      form.descuento,
      form.incluye_igv
    ),
    [form.items, form.descuento, form.incluye_igv]
  );

  const guardar = async (e) => {
    e.preventDefault();
    setMensaje(null);

    if (!form.cliente_id) {
      avisar("Selecciona un cliente.", "error");
      return;
    }

    if (form.origen === "cotizacion" && !form.cotizacion_id) {
      avisar("Selecciona una cotización.", "error");
      return;
    }

    if (
      !form.items.length ||
      form.items.some(
        (i) =>
          !texto(i.descripcion).trim() ||
          !Number.isFinite(Number(i.cantidad)) ||
          Number(i.cantidad) <= 0 ||
          !Number.isFinite(Number(i.precio_unitario)) ||
          Number(i.precio_unitario) < 0
      )
    ) {
      avisar("Revisa los materiales y sus precios.", "error");
      return;
    }

    if (
      !Number.isFinite(Number(form.descuento)) ||
      Number(form.descuento) < 0 ||
      Number(form.descuento) > totales.subtotal
    ) {
      avisar("El descuento no es válido.", "error");
      return;
    }

    setGuardando(true);
    try {
      const { data: id, error } = await supabase.rpc(
        "guardar_venta",
        {
          p_cliente_id: form.cliente_id,
          p_fecha: form.fecha,
          p_moneda: form.moneda,
          p_incluye_igv: form.incluye_igv,
          p_descuento: Number(form.descuento),
          p_observaciones: form.observaciones,
          p_items: form.items.map((i) => ({
            descripcion: texto(i.descripcion).trim(),
            unidad: i.unidad,
            cantidad: Number(i.cantidad),
            precio_unitario: Number(i.precio_unitario),
          })),
          p_cotizacion_id:
            form.origen === "cotizacion"
              ? form.cotizacion_id
              : null,
        }
      );

      if (error) throw error;

      setForm(formularioNuevo());
      avisar("Venta guardada correctamente.");
      await cargarDatos();

      // La venta ya está guardada. Un fallo del PDF
      // no debe provocar que se registre otra vez.
      try {
        await descargarPDF(id, false);
      } catch (pdfError) {
        avisar(
          "Venta guardada, pero el PDF falló: " + pdfError.message,
          "error"
        );
      }
    } catch (error) {
      avisar(error.message || "No se pudo guardar.", "error");
    } finally {
      setGuardando(false);
    }
  };

  const descargarPDF = async (ventaOId, mostrarAviso = true) => {
    const id = typeof ventaOId === "string"
      ? ventaOId
      : ventaOId.id;

    const [rv, ri, rp] = await Promise.all([
      supabase.from("ventas").select("*").eq("id", id).single(),
      supabase.from("venta_items").select("*")
        .eq("venta_id", id).order("orden"),
      supabase.from("venta_pagos").select("*")
        .eq("venta_id", id).order("creado_en"),
    ]);

    if (rv.error) throw rv.error;
    if (ri.error) throw ri.error;
    if (rp.error) throw rp.error;

    const venta = rv.data;
    const cliente = clientes.find(
      (c) => c.id === venta.cliente_id
    );

    generarPDF(venta, cliente, ri.data || [], rp.data || []);

    if (mostrarAviso) avisar("PDF descargado correctamente.");
  };

  const descargarConAviso = async (venta) => {
    try {
      await descargarPDF(venta);
    } catch (error) {
      avisar(error.message, "error");
    }
  };

  const registrarPago = async (e) => {
    e.preventDefault();
    if (!pagoVenta) return;

    const monto = Number(pagoForm.monto);
    if (
      !Number.isFinite(monto) ||
      monto <= 0 ||
      monto > Number(pagoVenta.saldo)
    ) {
      avisar("El pago debe ser mayor que cero y no superar el saldo.", "error");
      return;
    }

    setProcesandoPago(true);
    try {
      const { error } = await supabase.rpc(
        "registrar_pago_venta",
        {
          p_venta_id: pagoVenta.id,
          p_monto: monto,
          p_metodo: pagoForm.metodo,
          p_referencia: pagoForm.referencia,
        }
      );
      if (error) throw error;

      setPagoVenta(null);
      setPagoForm({
        monto: "",
        metodo: "transferencia",
        referencia: "",
      });
      avisar("Pago registrado correctamente.");
      await cargarDatos();
    } catch (error) {
      avisar(error.message, "error");
    } finally {
      setProcesandoPago(false);
    }
  };

  const cambiarEstado = async (venta, estado) => {
    if (venta.estado === estado) return;

    if (
      !window.confirm(
        `¿Cambiar ${numeroVenta(venta.numero)} a "${estado}"?`
      )
    ) return;

    try {
      const { error } = await supabase.rpc(
        "cambiar_estado_venta",
        {
          p_venta_id: venta.id,
          p_estado: estado,
        }
      );
      if (error) throw error;
      avisar("Estado actualizado.");
      await cargarDatos();
    } catch (error) {
      avisar(error.message, "error");
    }
  };

  const filtradas = useMemo(
    () => ventas.filter((v) => {
      const cliente = clientes.find(
        (c) => c.id === v.cliente_id
      );
      return [
        numeroVenta(v.numero),
        cliente?.nombre_razon_social,
        v.estado,
        v.origen,
      ].join(" ").toLowerCase().includes(busqueda.toLowerCase());
    }),
    [ventas, clientes, busqueda]
  );

  const indicadores = useMemo(() => {
    const activas = ventas.filter((v) => v.estado !== "anulada");
    const mes = hoy().slice(0, 7);

    return {
      mes: activas.filter(
        (v) => texto(v.fecha).startsWith(mes)
      ).reduce((s, v) => s + Number(v.total || 0), 0),
      cantidad: activas.length,
      pendiente: activas.reduce(
        (s, v) => s + Number(v.saldo || 0),
        0
      ),
      entregadas: activas.filter(
        (v) => v.estado === "entregada"
      ).length,
    };
  }, [ventas]);

  return (
    <main className="qr-ven">
      <header className="qr-ven-header">
        <div>
          <span className="qr-ven-brand">
            QR PIEDRAS NATURALES
          </span>
          <h1>Gestión de ventas</h1>
          <p>
            Ventas directas, cotizaciones, cobros y seguimiento.
          </p>
        </div>
        <button
          type="button"
          className="qr-ven-gold"
          onClick={() => (onVolver || onBack)?.()}
        >
          ← Volver al Dashboard
        </button>
      </header>

      {mensaje && (
        <div className={`qr-ven-alert ${mensaje.tipo}`}>
          {mensaje.contenido}
        </div>
      )}

      <section className="qr-ven-kpis">
        <article>
          <span>Ventas del mes (PEN)</span>
          <strong>
            {dinero(
              ventas.filter(
                (v) =>
                  v.estado !== "anulada" &&
                  v.moneda === "PEN" &&
                  texto(v.fecha).startsWith(hoy().slice(0, 7))
              ).reduce((s, v) => s + Number(v.total || 0), 0)
            )}
          </strong>
        </article>
        <article>
          <span>Ventas registradas</span>
          <strong>{indicadores.cantidad}</strong>
        </article>
        <article>
          <span>Saldo pendiente (PEN)</span>
          <strong>
            {dinero(
              ventas.filter(
                (v) => v.estado !== "anulada" && v.moneda === "PEN"
              ).reduce((s, v) => s + Number(v.saldo || 0), 0)
            )}
          </strong>
        </article>
        <article>
          <span>Ventas entregadas</span>
          <strong>{indicadores.entregadas}</strong>
        </article>
      </section>

      <p className="qr-ven-nota">
        Los importes del resumen corresponden a ventas en soles.
        Las ventas en dólares se muestran individualmente en el historial.
      </p>

      <section className="qr-ven-panel">
        <div className="qr-ven-panel-head">
          <h2>Registrar venta</h2>
          <span>Nota de venta PDF</span>
        </div>

        <div className="qr-ven-tabs">
          <button
            type="button"
            className={form.origen === "directa" ? "activo" : ""}
            onClick={() => cambiarOrigen("directa")}
          >
            Venta directa
          </button>
          <button
            type="button"
            className={form.origen === "cotizacion" ? "activo" : ""}
            onClick={() => cambiarOrigen("cotizacion")}
          >
            Desde cotización
          </button>
        </div>

        <form onSubmit={guardar}>
          {form.origen === "cotizacion" && (
            <label className="qr-ven-cotizacion">
              Seleccionar cotización
              <select
                required
                value={form.cotizacion_id}
                onChange={(e) =>
                  seleccionarCotizacion(e.target.value)
                }
              >
                <option value="">
                  Seleccionar cotización disponible
                </option>
                {cotizacionesDisponibles.map((cot) => {
                  const cliente = clientes.find(
                    (c) => c.id === cot.cliente_id
                  );
                  return (
                    <option key={cot.id} value={cot.id}>
                      {numeroCotizacion(cot.numero)} —{" "}
                      {cliente?.nombre_razon_social || "Cliente"} —{" "}
                      {dinero(cot.total, cot.moneda)}
                    </option>
                  );
                })}
              </select>
              <small>
                La venta utilizará los materiales y precios originales
                de la cotización seleccionada.
              </small>
            </label>
          )}

          <div className="qr-ven-grid">
            <label className="doble">
              Cliente
              <select
                required
                disabled={form.origen === "cotizacion"}
                value={form.cliente_id}
                onChange={(e) =>
                  cambiar("cliente_id", e.target.value)
                }
              >
                <option value="">Seleccionar cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre_razon_social}
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
                onChange={(e) => cambiar("fecha", e.target.value)}
              />
            </label>

            <label>
              Moneda
              <select
                disabled={form.origen === "cotizacion"}
                value={form.moneda}
                onChange={(e) => cambiar("moneda", e.target.value)}
              >
                <option value="PEN">Soles (PEN)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </label>

            <label>
              Descuento
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={form.origen === "cotizacion"}
                value={form.descuento}
                onChange={(e) => cambiar("descuento", e.target.value)}
              />
            </label>

            <label className="qr-ven-check">
              <input
                type="checkbox"
                disabled={form.origen === "cotizacion"}
                checked={form.incluye_igv}
                onChange={(e) =>
                  cambiar("incluye_igv", e.target.checked)
                }
              />
              Agregar IGV (18%)
            </label>
          </div>

          <div className="qr-ven-subhead">
            <h3>Materiales y servicios</h3>
            {form.origen === "directa" && (
              <button type="button" onClick={agregarItem}>
                + Agregar concepto
              </button>
            )}
          </div>

          <div className="qr-ven-scroll">
            <table className="qr-ven-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Unidad</th>
                  <th>Cantidad</th>
                  <th>Precio unitario</th>
                  <th>Importe</th>
                  {form.origen === "directa" && <th>Acción</th>}
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, indice) => (
                  <tr key={indice}>
                    <td>
                      <input
                        required
                        readOnly={form.origen === "cotizacion"}
                        value={item.descripcion}
                        placeholder="Ej. Laja ayacuchana"
                        onChange={(e) =>
                          cambiarItem(
                            indice, "descripcion", e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <select
                        disabled={form.origen === "cotizacion"}
                        value={item.unidad}
                        onChange={(e) =>
                          cambiarItem(indice, "unidad", e.target.value)
                        }
                      >
                        <option value="m²">m²</option>
                        <option value="ml">ml</option>
                        <option value="m³">m³</option>
                        <option value="und">und</option>
                        <option value="servicio">Servicio</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        required
                        readOnly={form.origen === "cotizacion"}
                        value={item.cantidad}
                        onChange={(e) =>
                          cambiarItem(indice, "cantidad", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        readOnly={form.origen === "cotizacion"}
                        value={item.precio_unitario}
                        onChange={(e) =>
                          cambiarItem(
                            indice, "precio_unitario", e.target.value
                          )
                        }
                      />
                    </td>
                    <td className="importe">
                      {dinero(
                        Number(item.cantidad) *
                          Number(item.precio_unitario),
                        form.moneda
                      )}
                    </td>
                    {form.origen === "directa" && (
                      <td>
                        <button
                          type="button"
                          className="qr-ven-danger"
                          onClick={() => quitarItem(indice)}
                        >
                          Quitar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="qr-ven-totales">
            <div>
              <span>Subtotal</span>
              <strong>{dinero(totales.subtotal, form.moneda)}</strong>
            </div>
            <div>
              <span>Descuento</span>
              <strong>{dinero(totales.descuento, form.moneda)}</strong>
            </div>
            <div>
              <span>IGV (18%)</span>
              <strong>{dinero(totales.igv, form.moneda)}</strong>
            </div>
            <div className="principal">
              <span>TOTAL</span>
              <strong>{dinero(totales.total, form.moneda)}</strong>
            </div>
          </div>

          <label className="qr-ven-observaciones">
            Observaciones
            <textarea
              rows="3"
              placeholder="Detalles de entrega o condiciones comerciales"
              value={form.observaciones}
              onChange={(e) =>
                cambiar("observaciones", e.target.value)
              }
            />
          </label>

          <div className="qr-ven-acciones">
            <button
              type="submit"
              className="qr-ven-gold"
              disabled={guardando}
            >
              {guardando
                ? "Guardando..."
                : "Guardar venta y generar PDF"}
            </button>
            <button
              type="button"
              onClick={() => cambiarOrigen("directa")}
            >
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <section className="qr-ven-panel">
        <div className="qr-ven-panel-head">
          <div>
            <h2>Historial de ventas</h2>
            <p>{ventas.length} registros</p>
          </div>
          <button type="button" onClick={cargarDatos}>
            Actualizar
          </button>
        </div>

        <input
          className="qr-ven-buscar"
          placeholder="Buscar número, cliente o estado..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="qr-ven-scroll">
          <table className="qr-ven-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Origen</th>
                <th>Total</th>
                <th>Pagado</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((v) => {
                const cliente = clientes.find(
                  (c) => c.id === v.cliente_id
                );
                return (
                  <tr key={v.id}>
                    <td>{numeroVenta(v.numero)}</td>
                    <td>{cliente?.nombre_razon_social || "—"}</td>
                    <td>{fechaPE(v.fecha)}</td>
                    <td>{v.origen}</td>
                    <td className="importe">
                      {dinero(v.total, v.moneda)}
                    </td>
                    <td className="importe">
                      {dinero(v.monto_pagado, v.moneda)}
                    </td>
                    <td className="importe">
                      {dinero(v.saldo, v.moneda)}
                    </td>
                    <td>
                      <select
                        className="qr-ven-estado"
                        value={v.estado}
                        disabled={v.estado === "anulada"}
                        onChange={(e) =>
                          cambiarEstado(v, e.target.value)
                        }
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="confirmada">Confirmada</option>
                        <option value="entregada">Entregada</option>
                        <option value="anulada">Anulada</option>
                      </select>
                    </td>
                    <td>
                      <div className="qr-ven-fila-acciones">
                        <button
                          type="button"
                          onClick={() => descargarConAviso(v)}
                        >
                          PDF
                        </button>
                        {v.estado !== "anulada" &&
                          Number(v.saldo) > 0 && (
                            <button
                              type="button"
                              className="qr-ven-gold"
                              onClick={() => {
                                setPagoVenta(v);
                                setPagoForm({
                                  monto: "",
                                  metodo: "transferencia",
                                  referencia: "",
                                });
                              }}
                            >
                              Cobrar
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filtradas.length && (
                <tr>
                  <td colSpan="9" className="qr-ven-vacio">
                    {cargando
                      ? "Cargando ventas..."
                      : "No se encontraron ventas."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {pagoVenta && (
        <div
          className="qr-ven-modal-fondo"
          onClick={() => setPagoVenta(null)}
        >
          <div
            className="qr-ven-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Registrar pago"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Registrar pago</h2>
            <p>
              Venta: {numeroVenta(pagoVenta.numero)}
            </p>
            <p>
              Saldo: {dinero(pagoVenta.saldo, pagoVenta.moneda)}
            </p>

            <form onSubmit={registrarPago}>
              <label>
                Monto a cobrar
                <input
                  type="number"
                  required
                  min="0.01"
                  max={pagoVenta.saldo}
                  step="0.01"
                  value={pagoForm.monto}
                  onChange={(e) =>
                    setPagoForm((p) => ({
                      ...p,
                      monto: e.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Método de pago
                <select
                  value={pagoForm.metodo}
                  onChange={(e) =>
                    setPagoForm((p) => ({
                      ...p,
                      metodo: e.target.value,
                    }))
                  }
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="yape">Yape</option>
                  <option value="plin">Plin</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="otro">Otro</option>
                </select>
              </label>

              <label>
                Referencia / número de operación
                <input
                  value={pagoForm.referencia}
                  onChange={(e) =>
                    setPagoForm((p) => ({
                      ...p,
                      referencia: e.target.value,
                    }))
                  }
                  placeholder="Opcional"
                />
              </label>

              <div className="qr-ven-acciones">
                <button
                  className="qr-ven-gold"
                  type="submit"
                  disabled={procesandoPago}
                >
                  {procesandoPago
                    ? "Registrando..."
                    : "Confirmar pago"}
                </button>
                <button
                  type="button"
                  onClick={() => setPagoVenta(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="qr-ven-footer">
        QR PIEDRAS NATURALES · Sistema de Gestión Empresarial
      </footer>
    </main>
  );
}
