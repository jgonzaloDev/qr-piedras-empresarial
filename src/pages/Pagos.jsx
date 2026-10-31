import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  RefreshCw,
  Wallet,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import "./Pagos.css";

const METODOS = [
  "efectivo",
  "transferencia",
  "yape",
  "plin",
  "tarjeta",
  "otro",
];
const formatoMoneda = (n, moneda = "PEN") =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: moneda === "USD" ? "USD" : "PEN",
  }).format(Number(n) || 0);
const codigoVenta = (n) => `VEN-${String(n ?? 0).padStart(6, "0")}`;
const fechaCorta = (f) => {
  if (!f) return "—";
  const [a, m, d] = String(f).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
const fechaHora = (f) =>
  f
    ? new Date(f).toLocaleString("es-PE", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
const estadoCobro = (v) =>
  v.estado === "anulada"
    ? "Anulada"
    : Number(v.saldo ?? Number(v.total) - Number(v.monto_pagado || 0)) <= 0.005
      ? "Pagada"
      : Number(v.monto_pagado || 0) > 0.005
        ? "Parcial"
        : "Pendiente";
const paginaDatos = async (tabla, columnas, orden = "creado_en") => {
  const resultados = [];
  for (let desde = 0; desde < 10000; desde += 1000) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columnas)
      .order(orden, { ascending: false })
      .range(desde, desde + 999);
    if (error) throw error;
    resultados.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return resultados;
};

function constanciaPDF(pago, venta, cliente) {
  const doc = new jsPDF();
  const ancho = doc.internal.pageSize.getWidth();
  doc.setFillColor(22, 23, 26);
  doc.rect(0, 0, ancho, 42, "F");
  doc.setTextColor(212, 175, 103);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("QR PIEDRAS NATURALES", 14, 20);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("CONSTANCIA INTERNA DE PAGO", 14, 30);
  doc.setTextColor(35, 35, 35);
  doc.setFontSize(11);
  let y = 57;
  const linea = (etiqueta, valor) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${etiqueta}:`, 14, y);
    doc.setFont("helvetica", "normal");
    const lineas = doc.splitTextToSize(String(valor ?? "—"), 115);
    doc.text(lineas, 78, y);
    y += Math.max(9, lineas.length * 6 + 3);
  };
  linea("Venta", codigoVenta(venta.numero));
  linea("Cliente", cliente?.nombre_razon_social || "Cliente no disponible");
  linea("Fecha del pago", fechaCorta(pago.fecha));
  linea("Registrado", fechaHora(pago.creado_en));
  linea("Método", pago.metodo.toUpperCase());
  linea("Referencia", pago.referencia || "Sin referencia");
  linea("Monto recibido", formatoMoneda(pago.monto, venta.moneda));
  doc.setDrawColor(212, 175, 103);
  doc.line(14, y + 3, ancho - 14, y + 3);
  y += 15;
  doc.setFontSize(9);
  doc.setTextColor(95, 95, 95);
  doc.text(
    doc.splitTextToSize(
      "Constancia de registro interno de pago. No sustituye una boleta o factura electrónica ni acredita por sí sola la recepción bancaria.",
      ancho - 28,
    ),
    14,
    y,
  );
  doc.save(`PAGO-${codigoVenta(venta.numero)}-${pago.id.slice(0, 8)}.pdf`);
}

export default function Pagos({ perfil, onVolver }) {
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("pendientes");
  const [ventaId, setVentaId] = useState("");
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("transferencia");
  const [referencia, setReferencia] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const puedeCobrar =
    ["administrador", "caja"].includes(perfil?.rol) && perfil?.activo !== false;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [v, c, p] = await Promise.all([
        paginaDatos(
          "ventas",
          "id,numero,cliente_id,fecha,total,monto_pagado,saldo,estado,moneda,archivada,es_prueba,creado_en",
        ),
        paginaDatos(
          "clientes",
          "id,nombre_razon_social",
          "nombre_razon_social",
        ),
        paginaDatos(
          "venta_pagos",
          "id,venta_id,fecha,monto,metodo,referencia,creado_en",
        ),
      ]);
      setVentas(v);
      setClientes(c);
      setPagos(p);
      setMensaje(null);
    } catch (e) {
      setMensaje({
        error: true,
        texto: e.message || "Error al cargar los datos.",
      });
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const clientesPorId = useMemo(
    () => Object.fromEntries(clientes.map((c) => [c.id, c])),
    [clientes],
  );
  const ventasPorId = useMemo(
    () => Object.fromEntries(ventas.map((v) => [v.id, v])),
    [ventas],
  );
  const activas = useMemo(
    () => ventas.filter((v) => v.estado !== "anulada" && !v.archivada),
    [ventas],
  );
  const filtradas = useMemo(
    () =>
      activas.filter((v) => {
        const estado = estadoCobro(v);
        if (filtro === "pendientes" && estado === "Pagada") return false;
        if (filtro === "pagadas" && estado !== "Pagada") return false;
        const q = busqueda.trim().toLowerCase();
        return (
          !q ||
          `${codigoVenta(v.numero)} ${clientesPorId[v.cliente_id]?.nombre_razon_social || ""} ${estado}`
            .toLowerCase()
            .includes(q)
        );
      }),
    [activas, filtro, busqueda, clientesPorId],
  );
  const historial = useMemo(
    () =>
      pagos.filter((p) => {
        const v = ventasPorId[p.venta_id];
        if (!v || v.archivada || v.estado === "anulada") return false;
        if (fechaDesde && String(p.fecha).slice(0, 10) < fechaDesde)
          return false;
        if (fechaHasta && String(p.fecha).slice(0, 10) > fechaHasta)
          return false;
        const q = busqueda.trim().toLowerCase();
        return (
          !q ||
          `${codigoVenta(v.numero)} ${clientesPorId[v.cliente_id]?.nombre_razon_social || ""} ${p.metodo} ${p.referencia || ""}`
            .toLowerCase()
            .includes(q)
        );
      }),
    [pagos, ventasPorId, clientesPorId, busqueda, fechaDesde, fechaHasta],
  );
  const seleccionada = ventasPorId[ventaId];
  const resumen = useMemo(
    () => ({
      cobrado: activas.reduce((s, v) => s + Number(v.monto_pagado || 0), 0),
      saldo: activas.reduce(
        (s, v) =>
          s +
          Math.max(
            0,
            Number(v.saldo ?? Number(v.total) - Number(v.monto_pagado || 0)),
          ),
        0,
      ),
      pagadas: activas.filter((v) => estadoCobro(v) === "Pagada").length,
      movimientos: historial.length,
    }),
    [activas, historial],
  );
  const monedas = [...new Set(activas.map((v) => v.moneda || "PEN"))];
  const monedaUnica = monedas.length <= 1 ? monedas[0] || "PEN" : null;

  const abrirCobro = (v) => {
    setVentaId(v.id);
    setMonto("");
    setMetodo("transferencia");
    setReferencia("");
    setMensaje(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const registrar = async (e) => {
    e.preventDefault();
    if (!puedeCobrar)
      return setMensaje({
        error: true,
        texto: "Tu perfil no tiene permisos para registrar pagos.",
      });
    if (
      !seleccionada ||
      seleccionada.archivada ||
      seleccionada.estado === "anulada"
    )
      return;
    const valor = Number(monto);
    if (
      !Number.isFinite(valor) ||
      valor <= 0 ||
      Math.round(valor * 100) !== valor * 100 ||
      valor > Number(seleccionada.saldo)
    ) {
      setMensaje({
        error: true,
        texto:
          "Ingresa un importe positivo, de máximo dos decimales y que no supere el saldo.",
      });
      return;
    }
    setProcesando(true);
    try {
      const { error } = await supabase.rpc("registrar_pago_venta", {
        p_venta_id: seleccionada.id,
        p_monto: valor,
        p_metodo: metodo,
        p_referencia: referencia.trim(),
      });
      if (error) throw error;
      setVentaId("");
      setMonto("");
      setReferencia("");
      await cargar();
      setMensaje({ error: false, texto: "Pago registrado correctamente." });
    } catch (err) {
      setMensaje({
        error: true,
        texto: err.message || "No se pudo registrar el pago.",
      });
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="qp-pagos">
      <div className="qp-contenedor">
        <header className="qp-cabecera">
          <div>
            <button type="button" className="qp-volver" onClick={onVolver}>
              <ArrowLeft size={17} /> Volver al panel
            </button>
            <p className="qp-etiqueta">QR PIEDRAS NATURALES</p>
            <h1>Gestión de pagos</h1>
            <p className="qp-subtitulo">
              Control de adelantos, cobros y saldos por venta
            </p>
          </div>
          <button
            type="button"
            className="qp-boton qp-secundario"
            onClick={cargar}
            disabled={cargando || procesando}
          >
            <RefreshCw size={17} /> Actualizar
          </button>
        </header>
        {mensaje && (
          <div
            role="alert"
            className={`qp-aviso ${mensaje.error ? "qp-error" : "qp-exito"}`}
          >
            {mensaje.error ? (
              <AlertCircle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}{" "}
            {mensaje.texto}
          </div>
        )}
        {monedaUnica === null && (
          <div className="qp-aviso qp-error">
            Existen ventas en distintas monedas. Los importes generales se
            muestran separados para evitar sumas incorrectas.
          </div>
        )}
        <section className="qp-indicadores">
          <div className="qp-indicador">
            <span>Total cobrado</span>
            <strong>
              {monedaUnica
                ? formatoMoneda(resumen.cobrado, monedaUnica)
                : "Varias monedas"}
            </strong>
          </div>
          <div className="qp-indicador">
            <span>Saldo pendiente</span>
            <strong>
              {monedaUnica
                ? formatoMoneda(resumen.saldo, monedaUnica)
                : "Varias monedas"}
            </strong>
          </div>
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
              <h2>Registrar un pago</h2>
            </div>
            {!puedeCobrar && (
              <p className="qp-nota">
                Solo los perfiles administrador y caja pueden registrar pagos.
              </p>
            )}
            <form onSubmit={registrar} className="qp-formulario">
              <label>
                Seleccionar venta pendiente
                <select
                  value={ventaId}
                  onChange={(e) => {
                    setVentaId(e.target.value);
                    setMonto("");
                  }}
                  disabled={!puedeCobrar || procesando}
                  required
                >
                  <option value="">Selecciona una venta</option>
                  {activas
                    .filter((v) => Number(v.saldo) > 0.005)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {codigoVenta(v.numero)} —{" "}
                        {clientesPorId[v.cliente_id]?.nombre_razon_social ||
                          "Cliente"}{" "}
                        — {formatoMoneda(v.saldo, v.moneda)}
                      </option>
                    ))}
                </select>
              </label>
              {seleccionada && (
                <div className="qp-saldo">
                  <span>Saldo disponible</span>
                  <strong>
                    {formatoMoneda(seleccionada.saldo, seleccionada.moneda)}
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
                    placeholder="0.00"
                    disabled={!puedeCobrar || procesando}
                    required
                  />
                </label>
                <label>
                  Método
                  <select
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                    disabled={!puedeCobrar || procesando}
                  >
                    {METODOS.map((m) => (
                      <option key={m} value={m}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Referencia (opcional)
                <input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  maxLength={150}
                  placeholder="N.º de operación, banco o detalle"
                  disabled={!puedeCobrar || procesando}
                />
              </label>
              <button
                type="submit"
                className="qp-boton qp-primario"
                disabled={!puedeCobrar || !seleccionada || procesando}
              >
                {procesando ? "Registrando…" : "Registrar pago"}
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
                placeholder="Buscar venta o cliente"
              />
            </div>
            <div className="qp-filtros">
              <button
                className={filtro === "pendientes" ? "activo" : ""}
                onClick={() => setFiltro("pendientes")}
              >
                Pendientes
              </button>
              <button
                className={filtro === "pagadas" ? "activo" : ""}
                onClick={() => setFiltro("pagadas")}
              >
                Pagadas
              </button>
              <button
                className={filtro === "todas" ? "activo" : ""}
                onClick={() => setFiltro("todas")}
              >
                Todas
              </button>
            </div>
            <div className="qp-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Venta / Cliente</th>
                    <th>Total</th>
                    <th>Saldo</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <strong>{codigoVenta(v.numero)}</strong>
                        <small>
                          {clientesPorId[v.cliente_id]?.nombre_razon_social ||
                            "Cliente"}
                        </small>
                        {v.es_prueba && <small>Venta de prueba</small>}
                      </td>
                      <td>{formatoMoneda(v.total, v.moneda)}</td>
                      <td>{formatoMoneda(v.saldo, v.moneda)}</td>
                      <td>
                        <span
                          className={`qp-estado ${estadoCobro(v).toLowerCase()}`}
                        >
                          {estadoCobro(v)}
                        </span>
                      </td>
                      <td>
                        {Number(v.saldo) > 0.005 && puedeCobrar && (
                          <button
                            className="qp-enlace"
                            type="button"
                            onClick={() => abrirCobro(v)}
                          >
                            Cobrar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filtradas.length && (
                    <tr>
                      <td colSpan={5} className="qp-vacio">
                        {cargando
                          ? "Cargando…"
                          : "No hay ventas para este filtro."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <section className="qp-panel qp-historial">
          <div className="qp-titulo">
            <h2>Historial de pagos</h2>
          </div>
          <div className="qp-fechas">
            <label>
              Desde
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </label>
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
                {historial.map((p) => {
                  const v = ventasPorId[p.venta_id];
                  const c = clientesPorId[v.cliente_id];
                  return (
                    <tr key={p.id}>
                      <td>{fechaCorta(p.fecha)}</td>
                      <td>{codigoVenta(v.numero)}</td>
                      <td>{c?.nombre_razon_social || "Cliente"}</td>
                      <td className="qp-capital">{p.metodo}</td>
                      <td>{p.referencia || "—"}</td>
                      <td>
                        <strong>{formatoMoneda(p.monto, v.moneda)}</strong>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="qp-enlace"
                          onClick={() => constanciaPDF(p, v, c)}
                          title="Descargar constancia"
                        >
                          <Download size={16} /> PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!historial.length && (
                  <tr>
                    <td colSpan={7} className="qp-vacio">
                      {cargando ? "Cargando…" : "No se encontraron pagos."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="qp-nota">
            Los pagos se leen de venta_pagos. Las ventas archivadas o anuladas
            no se incluyen en este historial operativo. Los registros eliminados
            definitivamente no aparecen.
          </p>
        </section>
      </div>
    </div>
  );
}
