
import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../lib/supabase";
import "./Ventas.css";

// ==================================================
// CONFIGURACIÓN
// ==================================================

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

const texto = (valor) => String(valor ?? "");

const numeroVenta = (numero) =>
  numero == null
    ? "BORRADOR"
    : `VEN-${String(numero).padStart(6, "0")}`;

const numeroCotizacion = (numero) =>
  numero == null
    ? "COT"
    : `COT-${String(numero).padStart(6, "0")}`;

const hoy = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const fechaPE = (valor) => {
  if (!valor) return "—";
  const partes = texto(valor).slice(0, 10).split("-");
  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : texto(valor);
};

const dinero = (valor, moneda = "PEN") =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "PEN",
  }).format(Number(valor) || 0);

const estadoCobro = (venta) => {
  if (venta.estado === "anulada") return "Anulada";

  const pagado = Number(venta.monto_pagado || 0);
  const saldo = Number(
    venta.saldo ??
      Math.max(0, Number(venta.total || 0) - pagado)
  );

  if (saldo <= 0.005) return "Pagada";
  if (pagado > 0.005) return "Parcial";
  return "Pendiente";
};

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
  const subtotal =
    Math.round(
      items.reduce(
        (suma, item) =>
          suma +
          Number(item.cantidad || 0) *
            Number(item.precio_unitario || 0),
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

// ==================================================
// GENERAR PDF
// ==================================================

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

  const escribir = (valor, x, y, opciones = {}) => {
    doc.text(texto(valor), x, y, opciones);
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

  if (venta.estado === "anulada") {
    doc.setFontSize(9);
    doc.setTextColor(255, 140, 140);
    escribir("ANULADA", W - 12, 24, {
      align: "right",
    });
  }

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
  escribir(
    `Estado: ${texto(venta.estado).toUpperCase()}`,
    12,
    y + 5
  );
  escribir(
    `Origen: ${
      venta.origen === "cotizacion"
        ? "Cotización"
        : "Directa"
    }`,
    12,
    y + 10
  );

  const datosCliente = [
    cliente?.nombre_razon_social || "Cliente",
    cliente?.numero_documento
      ? `${
          cliente.tipo_documento || "Documento"
        }: ${cliente.numero_documento}`
      : "",
    cliente?.direccion || "",
    cliente?.telefono
      ? `Tel: ${cliente.telefono}`
      : "",
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
    margin: {
      left: 12,
      right: 12,
      bottom: 18,
    },
    head: [[
      "N.º",
      "Descripción",
      "Unidad",
      "Cantidad",
      "P. unitario",
      "Importe",
    ]],
    body: items.map((item, index) => [
      texto(index + 1),
      texto(item.descripcion),
      texto(item.unidad),
      texto(item.cantidad),
      dinero(item.precio_unitario, venta.moneda),
      dinero(
        item.importe ??
          Number(item.cantidad) *
            Number(item.precio_unitario),
        venta.moneda
      ),
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

  const titulo = (valor) => {
    asegurar(12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NEGRO);
    escribir(valor, 12, y);

    y += 4;
    doc.setDrawColor(...ORO);
    doc.line(12, y, W - 12, y);
    y += 6;
  };

  const lineaTotal = (nombre, valor, negrita = false) => {
    asegurar(9);

    doc.setFont(
      "helvetica",
      negrita ? "bold" : "normal"
    );
    doc.setFontSize(negrita ? 10 : 8);
    doc.setTextColor(...NEGRO);

    escribir(nombre, 122, y);
    escribir(
      dinero(valor, venta.moneda),
      W - 12,
      y,
      { align: "right" }
    );

    y += negrita ? 8 : 6;
  };

  lineaTotal("Subtotal", venta.subtotal);
  lineaTotal("Descuento", venta.descuento);
  lineaTotal("IGV", venta.igv);
  lineaTotal("TOTAL", venta.total, true);

  y += 3;

  titulo(
    `ESTADO DE COBRO: ${estadoCobro(
      venta
    ).toUpperCase()}`
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  escribir(
    `Monto pagado: ${dinero(
      venta.monto_pagado,
      venta.moneda
    )}`,
    12,
    y
  );

  escribir(
    `Saldo pendiente: ${dinero(
      venta.saldo,
      venta.moneda
    )}`,
    105,
    y
  );

  y += 7;

  if (pagos.length) {
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);

    for (const pago of pagos) {
      asegurar(6);

      escribir(
        `${fechaPE(pago.fecha)} | ${
          pago.metodo
        } | ${dinero(pago.monto, venta.moneda)}`,
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

  const ALTO_BANCOS = 55;
  const Y_BANCOS = H - 20 - ALTO_BANCOS;

  if (y > Y_BANCOS - 4) {
    doc.addPage();
    y = 20;
  }

  doc.setFillColor(247, 246, 243);
  doc.roundedRect(
    12,
    Y_BANCOS,
    W - 24,
    ALTO_BANCOS,
    2,
    2,
    "F"
  );

  doc.setFillColor(...NEGRO);
  doc.rect(
    12,
    Y_BANCOS,
    W - 24,
    10,
    "F"
  );

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
  doc.line(
    17,
    Y_BANCOS + 19,
    W - 17,
    Y_BANCOS + 19
  );

  doc.setFontSize(8);

  escribir(
    "BCP - SOLES",
    17,
    Y_BANCOS + 25
  );

  escribir(
    "INTERBANK - SOLES",
    108,
    Y_BANCOS + 25
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.3);

  escribir(
    `Cuenta: ${EMPRESA.bcp}`,
    17,
    Y_BANCOS + 31
  );

  escribir(
    `CCI: ${EMPRESA.bcpCCI}`,
    17,
    Y_BANCOS + 37
  );

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
  doc.line(
    17,
    Y_BANCOS + 42,
    W - 17,
    Y_BANCOS + 42
  );

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
    doc.line(
      12,
      H - 14,
      W - 12,
      H - 14
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRIS);

    escribir(
      `${EMPRESA.nombre} | WhatsApp: ${EMPRESA.telefono}`,
      12,
      H - 9
    );

    escribir(
      `Página ${p} de ${paginas}`,
      W - 12,
      H - 9,
      { align: "right" }
    );
  }

  doc.save(
    `QR-PIEDRAS-${numeroVenta(venta.numero)}.pdf`
  );
}

// ==================================================
// COMPONENTE PRINCIPAL
// ==================================================

export default function Ventas({ onVolver, onBack }) {
  const [clientes, setClientes] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [ventas, setVentas] = useState([]);

  const [form, setForm] = useState(formularioNuevo);
  const [busqueda, setBusqueda] = useState("");
  const [vistaHistorial, setVistaHistorial] = useState("activas");
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [procesandoLote, setProcesandoLote] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [motivoEdicion, setMotivoEdicion] = useState("");

  const [anulandoVenta, setAnulandoVenta] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [
    procesandoAnulacion,
    setProcesandoAnulacion,
  ] = useState(false);

  const [pagoVenta, setPagoVenta] = useState(null);
  const [pagoForm, setPagoForm] = useState({
    monto: "",
    metodo: "transferencia",
    referencia: "",
  });

  const [procesandoPago, setProcesandoPago] = useState(false);

  const avisar = (contenido, tipo = "ok") =>
    setMensaje({ contenido, tipo });

  // ==================================================
  // CARGAR DATOS
  // ==================================================

  const cargarDatos = useCallback(async () => {
    setCargando(true);

    try {
      const [rc, rq, rv] = await Promise.all([
        supabase
          .from("clientes")
          .select("*")
          .order("nombre_razon_social"),

        supabase
          .from("cotizaciones")
          .select("*")
          .order("creado_en", { ascending: false }),

        supabase
          .from("ventas")
          .select("*")
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

  // ==================================================
  // FORMULARIO
  // ==================================================

  const cambiar = (campo, valor) =>
    setForm((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));

  const limpiarFormulario = () => {
    setForm(formularioNuevo());
    setEditandoId(null);
    setMotivoEdicion("");
    setMensaje(null);
  };

  const cambiarOrigen = (origen) => {
    if (editandoId) return;

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
        i === indice
          ? { ...item, [campo]: valor }
          : item
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
      items:
        anterior.items.length > 1
          ? anterior.items.filter((_, i) => i !== indice)
          : [itemNuevo()],
    }));
  };

  const cotizacionesDisponibles = useMemo(() => {
    const usadas = new Set(
      ventas
        .filter(
          (v) =>
            v.cotizacion_id &&
            v.estado !== "anulada"
        )
        .map((v) => v.cotizacion_id)
    );

    return cotizaciones.filter(
      (c) =>
        c.estado !== "anulada" &&
        !usadas.has(c.id)
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
      const cot = cotizaciones.find(
        (c) => c.id === id
      );

      if (!cot) {
        throw new Error("Cotización no encontrada");
      }

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
          cot.incluye_igv ??
          cot.aplicar_igv ??
          true,
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
    () =>
      calcular(
        form.items,
        form.descuento,
        form.incluye_igv
      ),
    [
      form.items,
      form.descuento,
      form.incluye_igv,
    ]
  );

  // ==================================================
  // MODIFICAR VENTA
  // ==================================================

  const iniciarEdicion = async (venta) => {
    if (venta.estado === "anulada") {
      avisar(
        "No se puede modificar una venta anulada.",
        "error"
      );
      return;
    }

    if (Number(venta.monto_pagado || 0) > 0) {
      avisar(
        "No se puede modificar una venta con pagos.",
        "error"
      );
      return;
    }

    try {
      const { data, error } = await supabase
        .from("venta_items")
        .select("*")
        .eq("venta_id", venta.id)
        .order("orden");

      if (error) throw error;

      setForm({
        origen: venta.origen || "directa",
        cliente_id: venta.cliente_id || "",
        cotizacion_id: venta.cotizacion_id || "",
        fecha: venta.fecha || hoy(),
        moneda: venta.moneda || "PEN",
        incluye_igv: venta.incluye_igv ?? true,
        descuento: Number(venta.descuento || 0),
        observaciones: venta.observaciones || "",
        items:
          data?.length
            ? data.map((item) => ({
                descripcion: item.descripcion,
                unidad: item.unidad,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
              }))
            : [itemNuevo()],
      });

      setEditandoId(venta.id);
      setMotivoEdicion("");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      avisar(
        `Editando ${numeroVenta(venta.numero)}`
      );
    } catch (error) {
      avisar(error.message, "error");
    }
  };

  // ==================================================
  // CREAR O GUARDAR MODIFICACIÓN
  // ==================================================

  const guardar = async (e) => {
    e.preventDefault();
    setMensaje(null);

    if (!form.cliente_id) {
      avisar("Selecciona un cliente.", "error");
      return;
    }

    if (
      !editandoId &&
      form.origen === "cotizacion" &&
      !form.cotizacion_id
    ) {
      avisar(
        "Selecciona una cotización.",
        "error"
      );
      return;
    }

    if (
      !form.items.length ||
      form.items.some(
        (item) =>
          !texto(item.descripcion).trim() ||
          !Number.isFinite(Number(item.cantidad)) ||
          Number(item.cantidad) <= 0 ||
          !Number.isFinite(
            Number(item.precio_unitario)
          ) ||
          Number(item.precio_unitario) < 0
      )
    ) {
      avisar(
        "Revisa los materiales, cantidades y precios.",
        "error"
      );
      return;
    }

    if (
      !Number.isFinite(Number(form.descuento)) ||
      Number(form.descuento) < 0 ||
      Number(form.descuento) > totales.subtotal
    ) {
      avisar(
        "El descuento no es válido.",
        "error"
      );
      return;
    }

    if (
      editandoId &&
      motivoEdicion.trim().length < 5
    ) {
      avisar(
        "Escribe un motivo de modificación de al menos 5 caracteres.",
        "error"
      );
      return;
    }

    setGuardando(true);

    try {
      const items = form.items.map((item) => ({
        descripcion: texto(
          item.descripcion
        ).trim(),
        unidad: item.unidad,
        cantidad: Number(item.cantidad),
        precio_unitario: Number(
          item.precio_unitario
        ),
      }));

      const esEdicion = Boolean(editandoId);
      let idVenta;

      if (esEdicion) {
        const { error } = await supabase.rpc(
          "editar_venta_sin_pagos",
          {
            p_venta_id: editandoId,
            p_cliente_id: form.cliente_id,
            p_fecha: form.fecha,
            p_moneda: form.moneda,
            p_incluye_igv: form.incluye_igv,
            p_descuento: Number(
              form.descuento
            ),
            p_observaciones:
              form.observaciones,
            p_items: items,
            p_motivo: motivoEdicion.trim(),
          }
        );

        if (error) throw error;

        idVenta = editandoId;
      } else {
        const { data, error } = await supabase.rpc(
          "guardar_venta",
          {
            p_cliente_id: form.cliente_id,
            p_fecha: form.fecha,
            p_moneda: form.moneda,
            p_incluye_igv: form.incluye_igv,
            p_descuento: Number(
              form.descuento
            ),
            p_observaciones:
              form.observaciones,
            p_items: items,
            p_cotizacion_id:
              form.origen === "cotizacion"
                ? form.cotizacion_id
                : null,
          }
        );

        if (error) throw error;

        idVenta = data;
      }

      setForm(formularioNuevo());
      setEditandoId(null);
      setMotivoEdicion("");

      await cargarDatos();

      avisar(
        esEdicion
          ? "Venta modificada correctamente."
          : "Venta registrada correctamente."
      );

      // El PDF no debe causar una venta duplicada
      try {
        await descargarPDF(idVenta, false);
      } catch (pdfError) {
        avisar(
          "La venta se guardó, pero el PDF no pudo descargarse: " +
            pdfError.message,
          "error"
        );
      }
    } catch (error) {
      avisar(
        error.message ||
          "No se pudo guardar la venta.",
        "error"
      );
    } finally {
      setGuardando(false);
    }
  };

  // ==================================================
  // DESCARGAR PDF
  // ==================================================

  const descargarPDF = async (
    ventaOId,
    mostrarAviso = true
  ) => {
    const id =
      typeof ventaOId === "string"
        ? ventaOId
        : ventaOId.id;

    const [rv, ri, rp] = await Promise.all([
      supabase
        .from("ventas")
        .select("*")
        .eq("id", id)
        .single(),

      supabase
        .from("venta_items")
        .select("*")
        .eq("venta_id", id)
        .order("orden"),

      supabase
        .from("venta_pagos")
        .select("*")
        .eq("venta_id", id)
        .order("creado_en"),
    ]);

    if (rv.error) throw rv.error;
    if (ri.error) throw ri.error;
    if (rp.error) throw rp.error;

    const venta = rv.data;

    const cliente = clientes.find(
      (c) => c.id === venta.cliente_id
    );

    generarPDF(
      venta,
      cliente,
      ri.data || [],
      rp.data || []
    );

    if (mostrarAviso) {
      avisar("PDF descargado correctamente.");
    }
  };

  const descargarConAviso = async (venta) => {
    try {
      await descargarPDF(venta);
    } catch (error) {
      avisar(error.message, "error");
    }
  };

  // ==================================================
  // REGISTRAR PAGOS
  // ==================================================

  const registrarPago = async (e) => {
    e.preventDefault();

    if (!pagoVenta) return;

    const monto = Number(pagoForm.monto);

    if (
      !Number.isFinite(monto) ||
      monto <= 0 ||
      monto > Number(pagoVenta.saldo)
    ) {
      avisar(
        "El pago debe ser mayor que cero y no superar el saldo.",
        "error"
      );
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

      await cargarDatos();

      avisar("Pago registrado correctamente.");
    } catch (error) {
      avisar(error.message, "error");
    } finally {
      setProcesandoPago(false);
    }
  };

  // ==================================================
  // ANULAR VENTA
  // ==================================================

  const abrirAnulacion = (venta) => {
    if (venta.estado === "anulada") {
      avisar("Esta venta ya está anulada.", "error");
      return;
    }

    if (Number(venta.monto_pagado || 0) > 0) {
      avisar(
        "La venta tiene pagos. Debes regularizar la devolución antes de solicitar su anulación.",
        "error"
      );
      return;
    }

    setAnulandoVenta(venta);
    setMotivoAnulacion("");
  };

  const confirmarAnulacion = async () => {
    if (!anulandoVenta) return;

    if (motivoAnulacion.trim().length < 5) {
      avisar(
        "Escribe un motivo de al menos 5 caracteres.",
        "error"
      );
      return;
    }

    setProcesandoAnulacion(true);

    try {
      const { error } = await supabase.rpc(
        "anular_venta_sin_pagos",
        {
          p_venta_id: anulandoVenta.id,
          p_motivo: motivoAnulacion.trim(),
        }
      );

      if (error) throw error;

      setAnulandoVenta(null);
      setMotivoAnulacion("");

      await cargarDatos();

      avisar("Venta anulada correctamente.");
    } catch (error) {
      avisar(error.message, "error");
    } finally {
      setProcesandoAnulacion(false);
    }
  };

  // ARCHIVO Y ELIMINACIÓN CONTROLADA
  const ejecutarLote = async (accion) => {
    if (!seleccionadas.length || procesandoLote) return;
    const etiqueta = accion === "archivar" ? "archivar" : accion === "restaurar" ? "restaurar" : "eliminar DEFINITIVAMENTE";
    if (!window.confirm(`¿Deseas ${etiqueta} ${seleccionadas.length} venta(s)?`)) return;
    if (accion === "eliminar") {
      const confirmacion = window.prompt('Para confirmar, escribe ELIMINAR DEFINITIVAMENTE');
      if (confirmacion !== 'ELIMINAR DEFINITIVAMENTE') return;
    }
    setProcesandoLote(true);
    try {
      const { data, error } = await supabase.rpc("gestionar_historial_ventas", {
        p_ids: seleccionadas,
        p_accion: accion,
      });
      if (error) throw error;
      setSeleccionadas([]);
      await cargarDatos();
      avisar(`${data ?? seleccionadas.length} venta(s) procesada(s) correctamente.`);
    } catch (error) {
      avisar(error.message || "No se pudo completar la operación.", "error");
    } finally {
      setProcesandoLote(false);
    }
  };

  // ==================================================
  // BÚSQUEDA E INDICADORES
  // ==================================================

  const filtradas = useMemo(
    () =>
      ventas.filter((venta) => {
        if (Boolean(venta.archivada) !== (vistaHistorial === "archivadas")) return false;
        const cliente = clientes.find(
          (c) => c.id === venta.cliente_id
        );

        const contenido = [
          numeroVenta(venta.numero),
          cliente?.nombre_razon_social,
          venta.estado,
          estadoCobro(venta),
          venta.origen,
        ]
          .join(" ")
          .toLowerCase();

        return contenido.includes(
          busqueda.toLowerCase()
        );
      }),
    [ventas, clientes, busqueda, vistaHistorial]
  );

  const indicadores = useMemo(() => {
    const activas = ventas.filter(
      (venta) => venta.estado !== "anulada"
    );

    const enSoles = activas.filter(
      (venta) => venta.moneda === "PEN"
    );

    return {
      mes: enSoles
        .filter((venta) =>
          texto(venta.fecha).startsWith(
            hoy().slice(0, 7)
          )
        )
        .reduce(
          (suma, venta) =>
            suma + Number(venta.total || 0),
          0
        ),

      cantidad: activas.length,

      pendiente: enSoles.reduce(
        (suma, venta) =>
          suma + Number(venta.saldo || 0),
        0
      ),

      pagadas: activas.filter(
        (venta) =>
          estadoCobro(venta) === "Pagada"
      ).length,

      anuladas: ventas.filter(
        (venta) => venta.estado === "anulada"
      ).length,
    };
  }, [ventas]);

  // ==================================================
  // INTERFAZ
  // ==================================================

  return (
    <main className="qr-ven">
      <header className="qr-ven-header">
        <div>
          <span className="qr-ven-brand">
            QR PIEDRAS NATURALES
          </span>

          <h1>Gestión de ventas</h1>

          <p>
            Crear, modificar, anular, cobrar y
            generar notas de venta.
          </p>
        </div>

        <button
          type="button"
          className="qr-ven-gold"
          onClick={() =>
            (onVolver || onBack)?.()
          }
        >
          ← Volver al Dashboard
        </button>
      </header>

      {mensaje && (
        <div
          className={`qr-ven-alert ${mensaje.tipo}`}
        >
          {mensaje.contenido}
        </div>
      )}

      {/* INDICADORES */}

      <section className="qr-ven-kpis">
        <article>
          <span>Ventas del mes (PEN)</span>
          <strong>
            {dinero(indicadores.mes)}
          </strong>
        </article>

        <article>
          <span>Ventas registradas</span>
          <strong>
            {indicadores.cantidad}
          </strong>
        </article>

        <article>
          <span>Saldo pendiente (PEN)</span>
          <strong>
            {dinero(indicadores.pendiente)}
          </strong>
        </article>

        <article>
          <span>Ventas pagadas</span>
          <strong>
            {indicadores.pagadas}
          </strong>
        </article>
      </section>

      <p className="qr-ven-nota">
        Resumen comercial en soles. Las ventas
        anuladas se excluyen de los totales.
        Las ventas en dólares se muestran
        individualmente en el historial.
      </p>

      {/* FORMULARIO */}

      <section className="qr-ven-panel">
        <div className="qr-ven-panel-head">
          <div>
            <h2>
              {editandoId
                ? "Modificar venta"
                : "Registrar nueva venta"}
            </h2>

            <p>
              {editandoId
                ? "Edita los datos y registra el motivo."
                : "Completa los datos para crear una venta."}
            </p>
          </div>

          {editandoId && (
            <button
              type="button"
              onClick={limpiarFormulario}
            >
              Cancelar edición
            </button>
          )}
        </div>

        {!editandoId && (
          <div className="qr-ven-tabs">
            <button
              type="button"
              className={
                form.origen === "directa"
                  ? "activo"
                  : ""
              }
              onClick={() =>
                cambiarOrigen("directa")
              }
            >
              Venta directa
            </button>

            <button
              type="button"
              className={
                form.origen === "cotizacion"
                  ? "activo"
                  : ""
              }
              onClick={() =>
                cambiarOrigen("cotizacion")
              }
            >
              Desde cotización
            </button>
          </div>
        )}

        <form onSubmit={guardar}>
          {!editandoId &&
            form.origen === "cotizacion" && (
              <label className="qr-ven-cotizacion">
                Seleccionar cotización

                <select
                  required
                  value={form.cotizacion_id}
                  onChange={(e) =>
                    seleccionarCotizacion(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Seleccionar cotización
                    disponible
                  </option>

                  {cotizacionesDisponibles.map(
                    (cot) => {
                      const cliente =
                        clientes.find(
                          (c) =>
                            c.id ===
                            cot.cliente_id
                        );

                      return (
                        <option
                          key={cot.id}
                          value={cot.id}
                        >
                          {numeroCotizacion(
                            cot.numero
                          )}
                          {" — "}
                          {cliente?.nombre_razon_social ||
                            "Cliente"}
                          {" — "}
                          {dinero(
                            cot.total,
                            cot.moneda
                          )}
                        </option>
                      );
                    }
                  )}
                </select>
              </label>
            )}

          <div className="qr-ven-grid">
            <label className="doble">
              Cliente

              <select
                required
                disabled={
                  !editandoId &&
                  form.origen === "cotizacion"
                }
                value={form.cliente_id}
                onChange={(e) =>
                  cambiar(
                    "cliente_id",
                    e.target.value
                  )
                }
              >
                <option value="">
                  Seleccionar cliente
                </option>

                {clientes.map((cliente) => (
                  <option
                    key={cliente.id}
                    value={cliente.id}
                  >
                    {cliente.nombre_razon_social}
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
                onChange={(e) =>
                  cambiar(
                    "fecha",
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Moneda

              <select
                disabled={
                  !editandoId &&
                  form.origen === "cotizacion"
                }
                value={form.moneda}
                onChange={(e) =>
                  cambiar(
                    "moneda",
                    e.target.value
                  )
                }
              >
                <option value="PEN">
                  Soles (PEN)
                </option>

                <option value="USD">
                  Dólares (USD)
                </option>
              </select>
            </label>

            <label>
              Descuento

              <input
                type="number"
                min="0"
                step="0.01"
                disabled={
                  !editandoId &&
                  form.origen === "cotizacion"
                }
                value={form.descuento}
                onChange={(e) =>
                  cambiar(
                    "descuento",
                    e.target.value
                  )
                }
              />
            </label>

            <label className="qr-ven-check">
              <input
                type="checkbox"
                disabled={
                  !editandoId &&
                  form.origen === "cotizacion"
                }
                checked={form.incluye_igv}
                onChange={(e) =>
                  cambiar(
                    "incluye_igv",
                    e.target.checked
                  )
                }
              />

              Agregar IGV (18%)
            </label>
          </div>

          {/* MATERIALES */}

          <div className="qr-ven-subhead">
            <h3>Materiales y servicios</h3>

            {(editandoId ||
              form.origen === "directa") && (
              <button
                type="button"
                onClick={agregarItem}
              >
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

                  {(editandoId ||
                    form.origen === "directa") && (
                    <th>Acción</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {form.items.map(
                  (item, indice) => {
                    const bloqueado =
                      !editandoId &&
                      form.origen ===
                        "cotizacion";

                    return (
                      <tr key={indice}>
                        <td>
                          <input
                            required
                            readOnly={
                              bloqueado
                            }
                            value={
                              item.descripcion
                            }
                            placeholder="Ej. Laja ayacuchana"
                            onChange={(e) =>
                              cambiarItem(
                                indice,
                                "descripcion",
                                e.target.value
                              )
                            }
                          />
                        </td>

                        <td>
                          <select
                            disabled={
                              bloqueado
                            }
                            value={item.unidad}
                            onChange={(e) =>
                              cambiarItem(
                                indice,
                                "unidad",
                                e.target.value
                              )
                            }
                          >
                            <option value="m²">
                              m²
                            </option>

                            <option value="ml">
                              ml
                            </option>

                            <option value="m³">
                              m³
                            </option>

                            <option value="und">
                              und
                            </option>

                            <option value="servicio">
                              Servicio
                            </option>
                          </select>
                        </td>

                        <td>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            required
                            readOnly={
                              bloqueado
                            }
                            value={
                              item.cantidad
                            }
                            onChange={(e) =>
                              cambiarItem(
                                indice,
                                "cantidad",
                                e.target.value
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            readOnly={
                              bloqueado
                            }
                            value={
                              item.precio_unitario
                            }
                            onChange={(e) =>
                              cambiarItem(
                                indice,
                                "precio_unitario",
                                e.target.value
                              )
                            }
                          />
                        </td>

                        <td className="importe">
                          {dinero(
                            Number(
                              item.cantidad
                            ) *
                              Number(
                                item.precio_unitario
                              ),
                            form.moneda
                          )}
                        </td>

                        {!bloqueado && (
                          <td>
                            <button
                              type="button"
                              className="qr-ven-danger"
                              onClick={() =>
                                quitarItem(
                                  indice
                                )
                              }
                            >
                              Quitar
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>

          {/* TOTALES */}

          <div className="qr-ven-totales">
            <div>
              <span>Subtotal</span>
              <strong>
                {dinero(
                  totales.subtotal,
                  form.moneda
                )}
              </strong>
            </div>

            <div>
              <span>Descuento</span>
              <strong>
                {dinero(
                  totales.descuento,
                  form.moneda
                )}
              </strong>
            </div>

            <div>
              <span>IGV (18%)</span>
              <strong>
                {dinero(
                  totales.igv,
                  form.moneda
                )}
              </strong>
            </div>

            <div className="principal">
              <span>TOTAL</span>
              <strong>
                {dinero(
                  totales.total,
                  form.moneda
                )}
              </strong>
            </div>
          </div>

          <label className="qr-ven-observaciones">
            Observaciones

            <textarea
              rows="3"
              placeholder="Detalles de entrega o condiciones comerciales"
              value={form.observaciones}
              onChange={(e) =>
                cambiar(
                  "observaciones",
                  e.target.value
                )
              }
            />
          </label>

          {editandoId && (
            <label className="qr-ven-observaciones">
              Motivo de modificación *

              <textarea
                rows="2"
                required
                minLength={5}
                placeholder="Ej. Corrección de cantidad y precio del material"
                value={motivoEdicion}
                onChange={(e) =>
                  setMotivoEdicion(
                    e.target.value
                  )
                }
              />
            </label>
          )}

          <div className="qr-ven-acciones">
            <button
              type="submit"
              className="qr-ven-gold"
              disabled={guardando}
            >
              {guardando
                ? "Guardando..."
                : editandoId
                ? "Guardar modificación"
                : "Crear venta y generar PDF"}
            </button>

            <button
              type="button"
              onClick={limpiarFormulario}
            >
              {editandoId
                ? "Cancelar edición"
                : "Limpiar"}
            </button>
          </div>
        </form>
      </section>

      {/* HISTORIAL */}

      <section className="qr-ven-panel">
        <div className="qr-ven-panel-head">
          <div>
            <h2>Historial de ventas</h2>
            <p>
              {ventas.length} registros
              {" · "}
              {indicadores.anuladas} anuladas
            </p>
          </div>

          <button
            type="button"
            onClick={cargarDatos}
          >
            Actualizar
          </button>
        </div>

        <div className="qr-ven-acciones" style={{ flexWrap: "wrap", marginBottom: 14 }}>
          <button type="button" className={vistaHistorial === "activas" ? "qr-ven-gold" : ""}
            onClick={() => { setVistaHistorial("activas"); setSeleccionadas([]); }}>Activas</button>
          <button type="button" className={vistaHistorial === "archivadas" ? "qr-ven-gold" : ""}
            onClick={() => { setVistaHistorial("archivadas"); setSeleccionadas([]); }}>Archivadas</button>
          <button type="button" disabled={!seleccionadas.length || procesandoLote}
            onClick={() => ejecutarLote(vistaHistorial === "archivadas" ? "restaurar" : "archivar")}>
            {vistaHistorial === "archivadas" ? "Restaurar" : "Archivar"} seleccionadas ({seleccionadas.length})
          </button>
          <button type="button" className="qr-ven-danger" disabled={!seleccionadas.length || procesandoLote}
            onClick={() => ejecutarLote("eliminar")}>Eliminar definitivamente ({seleccionadas.length})</button>
        </div>

        <input
          className="qr-ven-buscar"
          placeholder="Buscar número, cliente o estado..."
          value={busqueda}
          onChange={(e) =>
            setBusqueda(e.target.value)
          }
        />

        <div className="qr-ven-scroll">
          <table className="qr-ven-table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label="Seleccionar todas las ventas visibles"
                  checked={filtradas.length > 0 && filtradas.every(v => seleccionadas.includes(v.id))}
                  onChange={e => setSeleccionadas(e.target.checked ? filtradas.map(v => v.id) : [])} /></th>
                <th>Número</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Origen</th>
                <th>Total</th>
                <th>Pagado</th>
                <th>Saldo</th>
                <th>Cobro</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtradas.map((venta) => {
                const cliente = clientes.find(
                  (c) =>
                    c.id === venta.cliente_id
                );

                const anulada =
                  venta.estado === "anulada";

                const sinPagos =
                  Number(
                    venta.monto_pagado || 0
                  ) === 0;

                return (
                  <tr key={venta.id}>
                    <td><input type="checkbox" aria-label={`Seleccionar ${numeroVenta(venta.numero)}`}
                      checked={seleccionadas.includes(venta.id)}
                      onChange={e => setSeleccionadas(prev => e.target.checked ? [...prev, venta.id] : prev.filter(id => id !== venta.id))} /></td>
                    <td>
                      {numeroVenta(
                        venta.numero
                      )}
                    </td>

                    <td>
                      {cliente?.nombre_razon_social ||
                        "—"}
                    </td>

                    <td>
                      {fechaPE(
                        venta.fecha
                      )}
                    </td>

                    <td>
                      {venta.origen ||
                        "directa"}
                    </td>

                    <td className="importe">
                      {dinero(
                        venta.total,
                        venta.moneda
                      )}
                    </td>

                    <td className="importe">
                      {dinero(
                        venta.monto_pagado,
                        venta.moneda
                      )}
                    </td>

                    <td className="importe">
                      {dinero(
                        venta.saldo,
                        venta.moneda
                      )}
                    </td>

                    <td>
                      <span
                        className={`qr-ven-cobro qr-ven-cobro-${estadoCobro(
                          venta
                        ).toLowerCase()}`}
                      >
                        {estadoCobro(
                          venta
                        )}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`qr-ven-cobro qr-ven-cobro-${venta.estado}`}
                      >
                        {venta.estado}
                      </span>
                    </td>

                    <td>
                      <div className="qr-ven-fila-acciones">
                        <button
                          type="button"
                          onClick={() =>
                            descargarConAviso(
                              venta
                            )
                          }
                        >
                          PDF
                        </button>

                        {!anulada &&
                          sinPagos && (
                            <button
                              type="button"
                              onClick={() =>
                                iniciarEdicion(
                                  venta
                                )
                              }
                            >
                              Modificar
                            </button>
                          )}

                        {!anulada &&
                          sinPagos && (
                            <button
                              type="button"
                              className="qr-ven-danger"
                              onClick={() =>
                                abrirAnulacion(
                                  venta
                                )
                              }
                            >
                              Anular
                            </button>
                          )}

                        {!anulada &&
                          Number(
                            venta.saldo
                          ) > 0 && (
                            <button
                              type="button"
                              className="qr-ven-gold"
                              onClick={() => {
                                setPagoVenta(
                                  venta
                                );

                                setPagoForm({
                                  monto: "",
                                  metodo:
                                    "transferencia",
                                  referencia: "",
                                });
                              }}
                            >
                              Cobrar
                            </button>
                          )}

                        {anulada && (
                          <span>
                            Anulada
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filtradas.length && (
                <tr>
                  <td
                    colSpan="11"
                    className="qr-ven-vacio"
                  >
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

      {/* MODAL REGISTRAR PAGO */}

      {pagoVenta && (
        <div
          className="qr-ven-modal-fondo"
          onClick={() =>
            setPagoVenta(null)
          }
        >
          <div
            className="qr-ven-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Registrar pago"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <h2>Registrar pago</h2>

            <p>
              Venta:{" "}
              {numeroVenta(
                pagoVenta.numero
              )}
            </p>

            <p>
              Saldo:{" "}
              {dinero(
                pagoVenta.saldo,
                pagoVenta.moneda
              )}
            </p>

            <form onSubmit={registrarPago}>
              <label>
                Monto a cobrar

                <input
                  type="number"
                  required
                  min="0.01"
                  max={
                    pagoVenta.saldo
                  }
                  step="0.01"
                  value={
                    pagoForm.monto
                  }
                  onChange={(e) =>
                    setPagoForm(
                      (anterior) => ({
                        ...anterior,
                        monto:
                          e.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                Método de pago

                <select
                  value={
                    pagoForm.metodo
                  }
                  onChange={(e) =>
                    setPagoForm(
                      (anterior) => ({
                        ...anterior,
                        metodo:
                          e.target.value,
                      })
                    )
                  }
                >
                  <option value="efectivo">
                    Efectivo
                  </option>

                  <option value="transferencia">
                    Transferencia
                  </option>

                  <option value="yape">
                    Yape
                  </option>

                  <option value="plin">
                    Plin
                  </option>

                  <option value="tarjeta">
                    Tarjeta
                  </option>

                  <option value="otro">
                    Otro
                  </option>
                </select>
              </label>

              <label>
                Referencia / número de operación

                <input
                  value={
                    pagoForm.referencia
                  }
                  placeholder="Opcional"
                  onChange={(e) =>
                    setPagoForm(
                      (anterior) => ({
                        ...anterior,
                        referencia:
                          e.target.value,
                      })
                    )
                  }
                />
              </label>

              <div className="qr-ven-acciones">
                <button
                  className="qr-ven-gold"
                  type="submit"
                  disabled={
                    procesandoPago
                  }
                >
                  {procesandoPago
                    ? "Registrando..."
                    : "Confirmar pago"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPagoVenta(null)
                  }
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ANULAR VENTA */}

      {anulandoVenta && (
        <div
          className="qr-ven-modal-fondo"
          onClick={() => {
            if (!procesandoAnulacion) {
              setAnulandoVenta(null);
            }
          }}
        >
          <div
            className="qr-ven-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Anular venta"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <h2>Anular venta</h2>

            <p>
              Venta:{" "}
              <strong>
                {numeroVenta(
                  anulandoVenta.numero
                )}
              </strong>
            </p>

            <p>
              Total:{" "}
              <strong>
                {dinero(
                  anulandoVenta.total,
                  anulandoVenta.moneda
                )}
              </strong>
            </p>

            <p>
              Esta operación conservará el
              historial de la venta. No se
              eliminarán registros.
            </p>

            <label>
              Motivo de anulación *

              <textarea
                rows="3"
                required
                minLength={5}
                value={
                  motivoAnulacion
                }
                placeholder="Ej. Venta duplicada por error"
                onChange={(e) =>
                  setMotivoAnulacion(
                    e.target.value
                  )
                }
              />
            </label>

            <div className="qr-ven-acciones">
              <button
                type="button"
                className="qr-ven-danger"
                disabled={
                  procesandoAnulacion
                }
                onClick={
                  confirmarAnulacion
                }
              >
                {procesandoAnulacion
                  ? "Anulando..."
                  : "Confirmar anulación"}
              </button>

              <button
                type="button"
                disabled={
                  procesandoAnulacion
                }
                onClick={() =>
                  setAnulandoVenta(
                    null
                  )
                }
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="qr-ven-footer">
        QR PIEDRAS NATURALES · Sistema
        de Gestión Empresarial
      </footer>
    </main>
  );
}
