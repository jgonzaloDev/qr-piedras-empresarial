import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowLeft,
  RefreshCw,
  Wallet,
  Search,
  Download,
  BarChart3,
  FileSpreadsheet,
  FileDown,
  CreditCard,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import "./Pagos.css";

const METODOS = [
  "efectivo",
  "transferencia",
  "yape",
  "plin",
  "tarjeta",
  "otro",
];

const nombresMetodos = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  yape: "Yape",
  plin: "Plin",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

const dinero = (valor, moneda = "PEN") =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "PEN",
  }).format(Number(valor) || 0);

const codigoVenta = (numero) => `VEN-${String(numero ?? 0).padStart(6, "0")}`;

const fechaPE = (valor) => {
  if (!valor) return "—";
  const [a, m, d] = String(valor).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

const estadoCobro = (venta) => {
  if (venta.estado === "anulada") return "Anulada";

  const saldo = Number(
    venta.saldo ?? Number(venta.total) - Number(venta.monto_pagado || 0),
  );

  if (saldo <= 0.005) return "Pagada";
  if (Number(venta.monto_pagado || 0) > 0) return "Parcial";
  return "Pendiente";
};

// Consultas paginadas para evitar el límite de 1000 filas.
async function consultarTabla(tabla, columnas, orden = "creado_en") {
  const resultado = [];

  for (let desde = 0; desde < 100000; desde += 1000) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columnas)
      .order(orden, { ascending: false })
      .range(desde, desde + 999);

    if (error) throw error;

    resultado.push(...(data || []));

    if (!data || data.length < 1000) break;
  }

  return resultado;
}

// Protección básica contra fórmulas en Excel.
function celdaCSV(valor) {
  let texto = String(valor ?? "");

  if (/^[=+\-@\t\r]/.test(texto)) {
    texto = "'" + texto;
  }

  return `"${texto.replace(/"/g, '""')}"`;
}

function exportarCSV(filas) {
  const encabezados = [
    "Fecha",
    "Venta",
    "Cliente",
    "Metodo",
    "Referencia",
    "Moneda",
    "Monto",
  ];

  const registros = filas.map(({ pago, venta, cliente }) => [
    String(pago.fecha).slice(0, 10),
    codigoVenta(venta.numero),
    cliente,
    nombresMetodos[pago.metodo] || pago.metodo,
    pago.referencia || "",
    venta.moneda || "PEN",
    redondear(pago.monto).toFixed(2),
  ]);

  const contenido = [encabezados, ...registros]
    .map((fila) => fila.map(celdaCSV).join(";"))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + contenido], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = "QR-PIEDRAS-REPORTE-PAGOS.csv";

  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function generarReportePDF(filas, totales, desde, hasta) {
  const doc = new jsPDF({ orientation: "landscape" });
  const ancho = doc.internal.pageSize.getWidth();

  doc.setFillColor(22, 23, 26);
  doc.rect(0, 0, ancho, 34, "F");

  doc.setTextColor(212, 175, 103);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("QR PIEDRAS NATURALES", 12, 15);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("REPORTE INTERNO DE COBROS", 12, 24);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);

  doc.text(
    `Período: ${desde ? fechaPE(desde) : "Inicio"} - ${
      hasta ? fechaPE(hasta) : "Actualidad"
    }`,
    12,
    43,
  );

  doc.text(`Movimientos: ${filas.length}`, 12, 50);

  let y = 58;

  Object.entries(totales).forEach(([moneda, monto]) => {
    doc.text(`Total cobrado ${moneda}: ${dinero(monto, moneda)}`, 12, y);
    y += 7;
  });

  autoTable(doc, {
    startY: y + 4,
    margin: { left: 12, right: 12 },
    head: [
      ["Fecha", "Venta", "Cliente", "Método", "Referencia", "Moneda", "Monto"],
    ],
    body: filas.map(({ pago, venta, cliente }) => [
      fechaPE(pago.fecha),
      codigoVenta(venta.numero),
      cliente,
      nombresMetodos[pago.metodo] || pago.metodo,
      pago.referencia || "—",
      venta.moneda || "PEN",
      dinero(pago.monto, venta.moneda),
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [22, 23, 26],
      textColor: [212, 175, 103],
    },
    columnStyles: {
      6: { halign: "right" },
    },
    didDrawPage: () => {
      const alto = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(
        "Reporte interno. No sustituye comprobantes SUNAT.",
        12,
        alto - 9,
      );
    },
  });

  doc.save("QR-PIEDRAS-REPORTE-PAGOS.pdf");
}

function generarConstancia(pago, venta, cliente) {
  const doc = new jsPDF();
  const ancho = doc.internal.pageSize.getWidth();

  doc.setFillColor(22, 23, 26);
  doc.rect(0, 0, ancho, 40, "F");

  doc.setFont("helvetica", "bold");
  doc.setTextColor(212, 175, 103);
  doc.setFontSize(17);
  doc.text("QR PIEDRAS NATURALES", 14, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("CONSTANCIA INTERNA DE PAGO", 14, 29);

  let y = 55;

  const linea = (titulo, valor) => {
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${titulo}:`, 14, y);

    doc.setFont("helvetica", "normal");
    const lineas = doc.splitTextToSize(String(valor ?? "—"), 112);
    doc.text(lineas, 78, y);
    y += Math.max(10, lineas.length * 6 + 3);
  };

  linea("Venta", codigoVenta(venta.numero));
  linea("Cliente", cliente || "Cliente");
  linea("Fecha", fechaPE(pago.fecha));
  linea("Método", nombresMetodos[pago.metodo] || pago.metodo);
  linea("Referencia", pago.referencia || "Sin referencia");
  linea("Monto recibido", dinero(pago.monto, venta.moneda));

  doc.setDrawColor(212, 175, 103);
  doc.line(14, y + 4, ancho - 14, y + 4);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    doc.splitTextToSize(
      "Documento de control interno. No sustituye una boleta o factura electrónica.",
      ancho - 28,
    ),
    14,
    y + 17,
  );

  doc.save(`PAGO-${codigoVenta(venta.numero)}-${pago.id.slice(0, 8)}.pdf`);
}

export default function Pagos({ perfil, onVolver }) {
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [pagos, setPagos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("pendientes");

  const [ventaId, setVentaId] = useState("");
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("transferencia");
  const [referencia, setReferencia] = useState("");

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [incluirPruebas, setIncluirPruebas] = useState(false);

  const puedeCobrar =
    ["administrador", "caja"].includes(perfil?.rol) && perfil?.activo !== false;

  const cargarDatos = useCallback(async () => {
    setCargando(true);

    try {
      const [datosVentas, datosClientes, datosPagos] = await Promise.all([
        consultarTabla(
          "ventas",
          "id,numero,cliente_id,fecha,total,monto_pagado,saldo,estado,moneda,archivada,es_prueba,creado_en",
        ),
        consultarTabla(
          "clientes",
          "id,nombre_razon_social",
          "nombre_razon_social",
        ),
        consultarTabla(
          "venta_pagos",
          "id,venta_id,fecha,monto,metodo,referencia,creado_en",
        ),
      ]);

      setVentas(datosVentas);
      setClientes(datosClientes);
      setPagos(datosPagos);
    } catch (error) {
      setMensaje(error.message || "Error al cargar datos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const clientesPorId = useMemo(
    () => Object.fromEntries(clientes.map((cliente) => [cliente.id, cliente])),
    [clientes],
  );

  const ventasPorId = useMemo(
    () => Object.fromEntries(ventas.map((venta) => [venta.id, venta])),
    [ventas],
  );

  const ventasActivas = useMemo(
    () =>
      ventas.filter((venta) => venta.estado !== "anulada" && !venta.archivada),
    [ventas],
  );

  const ventasFiltradas = useMemo(() => {
    return ventasActivas.filter((venta) => {
      const estado = estadoCobro(venta);

      if (filtro === "pendientes" && estado === "Pagada") {
        return false;
      }

      if (filtro === "pagadas" && estado !== "Pagada") {
        return false;
      }

      const cliente =
        clientesPorId[venta.cliente_id]?.nombre_razon_social || "";

      const contenido =
        `${codigoVenta(venta.numero)} ${cliente} ${estado}`.toLowerCase();

      return contenido.includes(busqueda.toLowerCase());
    });
  }, [ventasActivas, filtro, busqueda, clientesPorId]);

  const historial = useMemo(() => {
    return pagos.filter((pago) => {
      const venta = ventasPorId[pago.venta_id];

      if (!venta || venta.archivada || venta.estado === "anulada") {
        return false;
      }

      if (!incluirPruebas && venta.es_prueba) {
        return false;
      }

      const fecha = String(pago.fecha).slice(0, 10);

      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;

      const cliente =
        clientesPorId[venta.cliente_id]?.nombre_razon_social || "";

      const contenido = [
        codigoVenta(venta.numero),
        cliente,
        pago.metodo,
        pago.referencia,
      ]
        .join(" ")
        .toLowerCase();

      return contenido.includes(busqueda.toLowerCase());
    });
  }, [
    pagos,
    ventasPorId,
    clientesPorId,
    incluirPruebas,
    desde,
    hasta,
    busqueda,
  ]);

  const filasReporte = useMemo(() => {
    return historial.map((pago) => {
      const venta = ventasPorId[pago.venta_id];

      return {
        pago,
        venta,
        cliente:
          clientesPorId[venta.cliente_id]?.nombre_razon_social || "Cliente",
      };
    });
  }, [historial, ventasPorId, clientesPorId]);

  const estadisticas = useMemo(() => {
    const totales = {};
    const metodos = {};
    const meses = {};

    filasReporte.forEach(({ pago, venta }) => {
      const moneda = venta.moneda || "PEN";
      const importe = redondear(pago.monto);

      totales[moneda] = redondear((totales[moneda] || 0) + importe);

      const nombreMetodo = nombresMetodos[pago.metodo] || pago.metodo;

      const claveMetodo = `${nombreMetodo} · ${moneda}`;
      metodos[claveMetodo] = redondear((metodos[claveMetodo] || 0) + importe);

      const mes = String(pago.fecha).slice(0, 7);
      const claveMes = `${mes} · ${moneda}`;

      meses[claveMes] = redondear((meses[claveMes] || 0) + importe);
    });

    return {
      totales,
      metodos: Object.entries(metodos).sort((a, b) => b[1] - a[1]),
      meses: Object.entries(meses).sort((a, b) => a[0].localeCompare(b[0])),
    };
  }, [filasReporte]);

  const resumen = useMemo(() => {
    const ventasReales = ventasActivas.filter(
      (venta) => incluirPruebas || !venta.es_prueba,
    );

    const porMoneda = {};

    ventasReales.forEach((venta) => {
      const moneda = venta.moneda || "PEN";

      if (!porMoneda[moneda]) {
        porMoneda[moneda] = { cobrado: 0, saldo: 0 };
      }

      porMoneda[moneda].cobrado += Number(venta.monto_pagado || 0);

      porMoneda[moneda].saldo += Math.max(0, Number(venta.saldo || 0));
    });

    return {
      porMoneda,
      pagadas: ventasReales.filter((venta) => estadoCobro(venta) === "Pagada")
        .length,
      movimientos: historial.length,
    };
  }, [ventasActivas, historial, incluirPruebas]);

  const seleccionada = ventasPorId[ventaId];

  const registrarPago = async (evento) => {
    evento.preventDefault();

    if (!puedeCobrar) {
      setMensaje("No tienes permisos para registrar pagos.");
      return;
    }

    if (
      !seleccionada ||
      seleccionada.archivada ||
      seleccionada.estado === "anulada"
    ) {
      setMensaje("Selecciona una venta válida.");
      return;
    }

    const importe = Number(monto);

    if (
      !Number.isFinite(importe) ||
      importe <= 0 ||
      Math.abs(importe * 100 - Math.round(importe * 100)) > 0.000001 ||
      importe > Number(seleccionada.saldo)
    ) {
      setMensaje("El monto es inválido o supera el saldo.");
      return;
    }

    setProcesando(true);

    try {
      const { error } = await supabase.rpc("registrar_pago_venta", {
        p_venta_id: seleccionada.id,
        p_monto: importe,
        p_metodo: metodo,
        p_referencia: referencia.trim(),
      });

      if (error) throw error;

      setVentaId("");
      setMonto("");
      setReferencia("");

      await cargarDatos();
      setMensaje("Pago registrado correctamente.");
    } catch (error) {
      setMensaje(error.message || "No se pudo registrar el pago.");
    } finally {
      setProcesando(false);
    }
  };

  const cobrarVenta = (venta) => {
    setVentaId(venta.id);
    setMonto("");
    setMetodo("transferencia");
    setReferencia("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="qp-pagos">
      <div className="qp-contenedor">
        <header className="qp-cabecera">
          <div>
            <button className="qp-volver" type="button" onClick={onVolver}>
              <ArrowLeft size={17} />
              Volver al panel
            </button>

            <p className="qp-etiqueta">QR PIEDRAS NATURALES</p>
            <h1>Gestión de pagos</h1>
            <p className="qp-subtitulo">
              Cobros, adelantos, reportes y estadísticas
            </p>
          </div>

          <button
            type="button"
            className="qp-boton qp-secundario"
            onClick={cargarDatos}
            disabled={cargando || procesando}
          >
            <RefreshCw size={17} />
            Actualizar
          </button>
        </header>

        {mensaje && <div className="qp-aviso">{mensaje}</div>}

        <section className="qp-indicadores">
          {Object.entries(resumen.porMoneda).map(([moneda, valores]) => (
            <div className="qp-indicador" key={moneda}>
              <span>Total cobrado · {moneda}</span>
              <strong>{dinero(valores.cobrado, moneda)}</strong>
              <span className="qp-dato-extra">
                Saldo pendiente: {dinero(valores.saldo, moneda)}
              </span>
            </div>
          ))}

          <div className="qp-indicador">
            <span>Ventas pagadas</span>
            <strong>{resumen.pagadas}</strong>
          </div>

          <div className="qp-indicador">
            <span>Movimientos filtrados</span>
            <strong>{resumen.movimientos}</strong>
          </div>
        </section>

        <div className="qp-columnas">
          <section className="qp-panel">
            <div className="qp-titulo">
              <Wallet size={20} />
              <h2>Registrar pago</h2>
            </div>

            {!puedeCobrar && (
              <p className="qp-nota">
                Solo administrador y caja pueden cobrar.
              </p>
            )}

            <form className="qp-formulario" onSubmit={registrarPago}>
              <label>
                Venta pendiente
                <select
                  value={ventaId}
                  onChange={(e) => {
                    setVentaId(e.target.value);
                    setMonto("");
                  }}
                  disabled={!puedeCobrar || procesando}
                  required
                >
                  <option value="">Seleccionar venta</option>

                  {ventasActivas
                    .filter((v) => Number(v.saldo) > 0)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {codigoVenta(v.numero)} —{" "}
                        {clientesPorId[v.cliente_id]?.nombre_razon_social ||
                          "Cliente"}{" "}
                        — {dinero(v.saldo, v.moneda)}
                      </option>
                    ))}
                </select>
              </label>

              {seleccionada && (
                <div className="qp-saldo">
                  <span>Saldo disponible</span>
                  <strong>
                    {dinero(seleccionada.saldo, seleccionada.moneda)}
                  </strong>
                </div>
              )}

              <div className="qp-dos">
                <label>
                  Monto
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    disabled={!puedeCobrar || procesando}
                    required
                  />
                </label>

                <label>
                  Método de pago
                  <select
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    disabled={!puedeCobrar || procesando}
                  >
                    {METODOS.map((item) => (
                      <option key={item} value={item}>
                        {nombresMetodos[item]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Referencia
                <input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Número de operación"
                  maxLength={150}
                  disabled={!puedeCobrar || procesando}
                />
              </label>

              <button
                className="qp-boton qp-primario"
                type="submit"
                disabled={!puedeCobrar || !seleccionada || procesando}
              >
                {procesando ? "Registrando..." : "Registrar pago"}
              </button>
            </form>
          </section>

          <section className="qp-panel">
            <div className="qp-titulo">
              <CreditCard size={20} />
              <h2>Ventas y saldos</h2>
            </div>

            <div className="qp-busqueda">
              <Search size={17} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar cliente o venta"
              />
            </div>

            <div className="qp-filtros">
              {[
                ["pendientes", "Pendientes"],
                ["pagadas", "Pagadas"],
                ["todas", "Todas"],
              ].map(([valor, nombre]) => (
                <button
                  key={valor}
                  type="button"
                  className={filtro === valor ? "activo" : ""}
                  onClick={() => setFiltro(valor)}
                >
                  {nombre}
                </button>
              ))}
            </div>

            <div className="qp-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Venta / Cliente</th>
                    <th>Total</th>
                    <th>Saldo</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {ventasFiltradas.map((venta) => (
                    <tr key={venta.id}>
                      <td>
                        <strong>{codigoVenta(venta.numero)}</strong>
                        <small>
                          {clientesPorId[venta.cliente_id]
                            ?.nombre_razon_social || "Cliente"}
                        </small>
                      </td>

                      <td>{dinero(venta.total, venta.moneda)}</td>

                      <td>{dinero(venta.saldo, venta.moneda)}</td>

                      <td>{estadoCobro(venta)}</td>

                      <td>
                        {Number(venta.saldo) > 0 && puedeCobrar && (
                          <button
                            type="button"
                            className="qp-enlace"
                            onClick={() => cobrarVenta(venta)}
                          >
                            Cobrar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {!ventasFiltradas.length && (
                    <tr>
                      <td colSpan={5} className="qp-vacio">
                        No hay ventas para este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="qp-panel qp-reportes">
          <div className="qp-titulo">
            <BarChart3 size={20} />
            <h2>Reportes y estadísticas</h2>
          </div>

          <p className="qp-nota">
            Los reportes se calculan según las fechas, la búsqueda y las ventas
            de prueba seleccionadas.
          </p>

          <div className="qp-fechas">
            <label>
              Desde
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </label>

            <label>
              Hasta
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </label>

            <label className="qp-check">
              <input
                type="checkbox"
                checked={incluirPruebas}
                onChange={(e) => setIncluirPruebas(e.target.checked)}
              />
              Incluir ventas de prueba
            </label>
          </div>

          <div className="qp-reporte-acciones">
            <button
              type="button"
              className="qp-boton qp-secundario"
              disabled={cargando || !filasReporte.length}
              onClick={() => exportarCSV(filasReporte)}
            >
              <FileSpreadsheet size={17} />
              Exportar Excel / CSV
            </button>

            <button
              type="button"
              className="qp-boton qp-primario"
              disabled={cargando || !filasReporte.length}
              onClick={() =>
                generarReportePDF(
                  filasReporte,
                  estadisticas.totales,
                  desde,
                  hasta,
                )
              }
            >
              <FileDown size={17} />
              Generar reporte PDF
            </button>
          </div>

          <div className="qp-reporte-resumen">
            <div className="qp-reporte-metrica">
              <span>Movimientos</span>
              <strong>{filasReporte.length}</strong>
            </div>

            {Object.entries(estadisticas.totales).map(([moneda, total]) => (
              <div className="qp-reporte-metrica" key={moneda}>
                <span>Total cobrado · {moneda}</span>
                <strong>{dinero(total, moneda)}</strong>
              </div>
            ))}
          </div>

          <div className="qp-reporte-grid">
            {[
              ["Cobros por método de pago", estadisticas.metodos],
              ["Evolución mensual de cobros", estadisticas.meses],
            ].map(([titulo, datos]) => (
              <div className="qp-reporte-bloque" key={titulo}>
                <h3>{titulo}</h3>

                {datos.length === 0 && (
                  <p className="qp-nota">No hay movimientos registrados.</p>
                )}

                {datos.map(([clave, total]) => {
                  const moneda = clave.split(" · ").at(-1);

                  const maximo = Math.max(
                    1,
                    ...datos
                      .filter(([k]) => k.endsWith(` · ${moneda}`))
                      .map(([, valor]) => valor),
                  );

                  return (
                    <div className="qp-barra-fila" key={clave}>
                      <div className="qp-barra-label">
                        <span>{clave}</span>
                        <strong>{dinero(total, moneda)}</strong>
                      </div>

                      <div className="qp-barra-fondo">
                        <div
                          style={{
                            width: `${(total / maximo) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <section className="qp-panel qp-historial">
          <div className="qp-titulo">
            <h2>Historial de pagos</h2>
          </div>

          <div className="qp-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Venta</th>
                  <th>Cliente</th>
                  <th>Método</th>
                  <th>Referencia</th>
                  <th>Monto</th>
                  <th>Constancia</th>
                </tr>
              </thead>

              <tbody>
                {filasReporte.map(({ pago, venta, cliente }) => (
                  <tr key={pago.id}>
                    <td>{fechaPE(pago.fecha)}</td>
                    <td>{codigoVenta(venta.numero)}</td>
                    <td>{cliente}</td>
                    <td>{nombresMetodos[pago.metodo] || pago.metodo}</td>
                    <td>{pago.referencia || "—"}</td>
                    <td>
                      <strong>{dinero(pago.monto, venta.moneda)}</strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="qp-enlace"
                        onClick={() => generarConstancia(pago, venta, cliente)}
                      >
                        <Download size={16} />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}

                {!filasReporte.length && (
                  <tr>
                    <td colSpan={7} className="qp-vacio">
                      {cargando
                        ? "Cargando información..."
                        : "No se encontraron pagos."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="qp-nota">
            Los reportes excluyen ventas archivadas, anuladas y registros
            eliminados. Las constancias son documentos internos.
          </p>
        </section>
      </div>
    </div>
  );
}
