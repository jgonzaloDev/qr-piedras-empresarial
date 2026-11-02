
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowLeft,
  FileSignature,
  Plus,
  Search,
  Download,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import "./Contratos.css";

const HOY = new Date().toLocaleDateString("en-CA");

const FORMULARIO = {
  tipo_proveedor: "empresa",
  proveedor_nombre: "Gallito y Piedra S.A.C.",
  proveedor_documento: "",
  proveedor_domicilio: "",
  representante_legal: "",
  representante_dni: "",
  cliente_id: "",
  tipo_contrato: "suministro",
  objeto: "",
  condiciones: "",
  especificaciones_tecnicas: "",
  lugar_entrega: "",
  fecha_entrega: "",
  fecha_contrato: HOY,
  lugar_firma: "Lima, Perú",
  moneda: "PEN",
  importe: "",
  adelanto: "0",
  forma_pago: "",
  garantia: "",
  penalidades: "",
  obligaciones_proveedor: "",
  obligaciones_cliente: "",
  solucion_controversias: "",
  observaciones: "",
};

const TIPOS = {
  suministro: "Suministro de piedra natural",
  suministro_instalacion: "Suministro e instalación de piedra natural",
  servicio_instalacion: "Prestación de servicios de instalación",
};

const ESTADOS = {
  borrador: "Borrador",
  firmado: "Firmado",
  cumplido: "Cumplido",
  cancelado: "Cancelado",
};

function codigo(numero) {
  return `CONT-${String(numero || 0).padStart(6, "0")}`;
}

function fecha(valor) {
  if (!valor) return "No especificada";
  const [a, m, d] = valor.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

function dinero(valor, moneda = "PEN") {
  return `${moneda === "USD" ? "US$" : "S/"} ${Number(
    valor || 0
  ).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function texto(valor, defecto = "No especificado") {
  return String(valor || "").trim() || defecto;
}

function generarPDF(c) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margen = 22;
  const ancho = 166;
  let y = 25;

  function verificarEspacio(altura = 22) {
    if (y + altura > 270) {
      pdf.addPage();
      y = 25;
    }
  }

  function parrafo(contenido) {
    const lineas = pdf.splitTextToSize(String(contenido), ancho);
    const altura = lineas.length * 5.5;
    verificarEspacio(altura + 7);
    pdf.setFont("times", "normal");
    pdf.setFontSize(10.5);
    pdf.setTextColor(35, 35, 35);
    pdf.text(lineas, margen, y);
    y += altura + 6;
  }

  function clausula(titulo, contenido) {
    verificarEspacio(22);
    pdf.setFont("times", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(25, 25, 25);
    pdf.text(titulo, margen, y);
    y += 8;
    parrafo(contenido);
  }

  const nombreProveedor = texto(c.proveedor_nombre);
  const proveedorDocumento = texto(c.proveedor_documento);
  const nombreCliente = texto(c.cliente_nombre);
  const clienteDocumento = texto(c.cliente_numero_documento);
  const empresa = c.tipo_proveedor === "empresa";

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(150, 112, 49);
  pdf.text("QR PIEDRAS NATURALES", 105, y, { align: "center" });

  y += 11;
  pdf.setDrawColor(170, 140, 80);
  pdf.line(margen, y, 188, y);
  y += 12;

  pdf.setTextColor(20, 20, 20);
  pdf.setFontSize(13);

  const titulo = `CONTRATO DE ${TIPOS[
    c.tipo_contrato
  ]?.toUpperCase() || "SUMINISTRO"}`;

  const tituloLineas = pdf.splitTextToSize(titulo, 155);
  pdf.text(tituloLineas, 105, y, { align: "center" });
  y += tituloLineas.length * 6 + 5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`N.º ${codigo(c.numero)}`, 105, y, {
    align: "center",
  });
  y += 14;

  parrafo(
    `Conste por el presente documento el contrato que celebran, de una parte, ` +
      `${nombreProveedor}, identificado(a) con ${
        empresa ? "RUC" : "DNI"
      } N.º ${proveedorDocumento}, con domicilio en ` +
      `${texto(c.proveedor_domicilio)}${
        empresa
          ? `, debidamente representada por ${texto(
              c.representante_legal
            )}, identificado(a) con DNI N.º ${texto(
              c.representante_dni
            )}`
          : ""
      }, en adelante EL PROVEEDOR; y, de la otra parte, ` +
      `${nombreCliente}, identificado(a) con ${texto(
        c.cliente_tipo_documento,
        "documento"
      )} N.º ${clienteDocumento}, con domicilio en ` +
      `${texto(c.cliente_domicilio)}${
        c.cliente_representante
          ? `, representado(a) por ${c.cliente_representante}, con DNI N.º ${texto(
              c.cliente_representante_dni
            )}`
          : ""
      }, en adelante EL CONTRATANTE, bajo las cláusulas siguientes:`
  );

  clausula(
    "PRIMERA: OBJETO DEL CONTRATO",
    texto(c.objeto)
  );

  clausula(
    "SEGUNDA: ESPECIFICACIONES TÉCNICAS",
    texto(c.especificaciones_tecnicas) +
      " Los materiales, medidas, acabados y cantidades deberán corresponder a las especificaciones expresamente acordadas por las partes y a los anexos suscritos, si los hubiera."
  );

  clausula(
    "TERCERA: PRECIO Y FORMA DE PAGO",
    `El importe contractual asciende a ${dinero(
      c.importe,
      c.moneda
    )}. El adelanto pactado es ${dinero(
      c.adelanto,
      c.moneda
    )} y el saldo contractual es ${dinero(
      Number(c.importe || 0) - Number(c.adelanto || 0),
      c.moneda
    )}. Forma de pago: ${texto(c.forma_pago)}. ` +
      `El tratamiento de los tributos y comprobantes de pago será el que corresponda conforme a la normativa aplicable y a las condiciones expresamente pactadas.`
  );

  clausula(
    "CUARTA: PLAZO Y LUGAR DE ENTREGA",
    `Lugar de entrega o ejecución: ${texto(
      c.lugar_entrega
    )}. Fecha prevista: ${fecha(
      c.fecha_entrega
    )}. Las modificaciones de plazo deberán acordarse y documentarse entre las partes.`
  );

  clausula(
    "QUINTA: OBLIGACIONES DEL PROVEEDOR",
    texto(c.obligaciones_proveedor)
  );

  clausula(
    "SEXTA: OBLIGACIONES DEL CONTRATANTE",
    texto(c.obligaciones_cliente)
  );

  clausula(
    "SÉPTIMA: RECEPCIÓN Y CONFORMIDAD",
    "La recepción de los materiales o trabajos se documentará mediante constancia, acta o documento equivalente. Las observaciones sobre cantidades, especificaciones o ejecución deberán registrarse por escrito para su evaluación y atención conforme a lo pactado."
  );

  clausula(
    "OCTAVA: GARANTÍAS",
    texto(c.garantia) +
      " Las garantías expresamente pactadas se aplicarán sin perjuicio de los derechos que correspondan por ley."
  );

  clausula(
    "NOVENA: PENALIDADES E INCUMPLIMIENTO",
    texto(
      c.penalidades,
      "No se han establecido penalidades contractuales específicas."
    ) +
      " Cualquier incumplimiento será evaluado conforme a lo acordado y a la legislación aplicable."
  );

  clausula(
    "DÉCIMA: MODIFICACIONES Y RESOLUCIÓN",
    "Las modificaciones del alcance, precio o plazo deberán constar por escrito y contar con la aceptación de ambas partes. La resolución del contrato se sujetará a las causales pactadas y a la normativa aplicable."
  );

  clausula(
    "DÉCIMA PRIMERA: SOLUCIÓN DE CONTROVERSIAS",
    texto(
      c.solucion_controversias,
      "Las partes procurarán resolver sus controversias mediante trato directo y, de no alcanzar un acuerdo, acudirán a las autoridades competentes conforme a la legislación peruana."
    )
  );

  if (c.condiciones) {
    clausula(
      "DÉCIMA SEGUNDA: CONDICIONES ADICIONALES",
      c.condiciones
    );
  }

  if (c.observaciones) {
    clausula("OBSERVACIONES", c.observaciones);
  }

  verificarEspacio(65);
  parrafo(
    `En señal de conformidad, las partes suscriben el presente contrato en ${texto(
      c.lugar_firma
    )}, con fecha ${fecha(c.fecha_firma || c.fecha_contrato)}.`
  );

  verificarEspacio(45);
  y += 15;

  pdf.setDrawColor(80, 80, 80);
  pdf.line(25, y, 92, y);
  pdf.line(118, y, 185, y);
  y += 6;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("EL PROVEEDOR", 58, y, { align: "center" });
  pdf.text("EL CONTRATANTE", 151, y, {
    align: "center",
  });

  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(
    pdf.splitTextToSize(nombreProveedor, 65),
    58,
    y,
    { align: "center" }
  );
  pdf.text(
    pdf.splitTextToSize(nombreCliente, 65),
    151,
    y,
    { align: "center" }
  );

  const paginas = pdf.getNumberOfPages();

  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(110, 110, 110);
    pdf.text(
      `Contrato ${codigo(c.numero)} - Página ${i} de ${paginas}`,
      105,
      287,
      { align: "center" }
    );
  }

  pdf.save(`${codigo(c.numero)}.pdf`);
}

export default function Contratos({ perfil, onVolver }) {
  const [contratos, setContratos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const puedeCrear = ["administrador", "vendedor"].includes(
    perfil?.rol
  );

  const esAdmin = perfil?.rol === "administrador";

  const cargarDatos = useCallback(async () => {
    setCargando(true);

    const [respuestaContratos, respuestaClientes] =
      await Promise.all([
        supabase
          .from("contratos")
          .select("*")
          .order("numero", { ascending: false }),
        supabase
          .from("clientes")
          .select(
            "id,nombre_razon_social,tipo_documento,numero_documento,direccion"
          )
          .order("nombre_razon_social"),
      ]);

    if (respuestaContratos.error || respuestaClientes.error) {
      setMensaje(
        respuestaContratos.error?.message ||
          respuestaClientes.error?.message
      );
    } else {
      setContratos(respuestaContratos.data || []);
      setClientes(respuestaClientes.data || []);
    }

    setCargando(false);
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  function actualizar(campo, valor) {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function cambiarProveedor(tipo) {
    setFormulario((anterior) => ({
      ...anterior,
      tipo_proveedor: tipo,
      proveedor_nombre:
        tipo === "empresa"
          ? "Gallito y Piedra S.A.C."
          : "Junior Gonzalo Quiñones Ramírez",
      proveedor_documento: "",
      proveedor_domicilio: "",
      representante_legal: "",
      representante_dni: "",
    }));
  }

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();

    return contratos.filter((c) =>
      [
        codigo(c.numero),
        c.cliente_nombre,
        c.proveedor_nombre,
        c.objeto,
        c.estado,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [contratos, busqueda]);

  async function guardar(e) {
    e.preventDefault();

    if (!puedeCrear || guardando) return;

    setMensaje("");

    const cliente = clientes.find(
      (c) => c.id === formulario.cliente_id
    );

    if (!cliente) {
      setMensaje("Selecciona un cliente.");
      return;
    }

    if (
      !formulario.proveedor_nombre.trim() ||
      !formulario.proveedor_documento.trim() ||
      !formulario.proveedor_domicilio.trim()
    ) {
      setMensaje("Completa los datos del proveedor.");
      return;
    }

    if (
      formulario.tipo_proveedor === "empresa" &&
      (!formulario.representante_legal.trim() ||
        !formulario.representante_dni.trim())
    ) {
      setMensaje("Completa los datos del representante legal.");
      return;
    }

    const importe = Number(formulario.importe);
    const adelanto = Number(formulario.adelanto || 0);

    if (
      !Number.isFinite(importe) ||
      importe <= 0 ||
      !Number.isFinite(adelanto) ||
      adelanto < 0 ||
      adelanto > importe
    ) {
      setMensaje("Revisa el importe y el adelanto.");
      return;
    }

    setGuardando(true);

    const { data: usuarioData, error: usuarioError } =
      await supabase.auth.getUser();

    if (usuarioError || !usuarioData?.user) {
      setMensaje("Tu sesión no está disponible.");
      setGuardando(false);
      return;
    }

    const { data: ultimo, error: numeroError } = await supabase
      .from("contratos")
      .select("numero")
      .order("numero", { ascending: false })
      .limit(1);

    if (numeroError) {
      setMensaje(numeroError.message);
      setGuardando(false);
      return;
    }

    const numero = Number(ultimo?.[0]?.numero || 0) + 1;

    const datos = {
      ...formulario,
      numero,
      cliente_nombre: cliente.nombre_razon_social,
      cliente_tipo_documento: cliente.tipo_documento || "",
      cliente_numero_documento: cliente.numero_documento || "",
      cliente_domicilio: cliente.direccion || "",
      importe,
      adelanto,
      estado: "borrador",
      creado_por: usuarioData.user.id,
      fecha_entrega: formulario.fecha_entrega || null,
      fecha_contrato: formulario.fecha_contrato || null,
      cotizacion_id: null,
      venta_id: null,
    };

    const { error } = await supabase
      .from("contratos")
      .insert(datos);

    if (error) {
      setMensaje(
        error.code === "23505"
          ? "El número de contrato ya existe. Actualiza e inténtalo nuevamente."
          : error.message
      );
    } else {
      setMensaje("Contrato registrado correctamente.");
      setFormulario(FORMULARIO);
      setMostrarFormulario(false);
      await cargarDatos();
    }

    setGuardando(false);
  }

  async function cambiarEstado(contrato, estado) {
    if (!esAdmin) return;

    if (
      !window.confirm(
        `¿Cambiar ${codigo(contrato.numero)} a ${ESTADOS[estado]}?`
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("contratos")
      .update({
        estado,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", contrato.id);

    if (error) {
      setMensaje(error.message);
    } else {
      await cargarDatos();
    }
  }

  function Campo({ titulo, nombre, tipo = "text", requerido = false }) {
    return (
      <label className="qc-campo">
        <span>{titulo}</span>
        <input
          type={tipo}
          required={requerido}
          value={formulario[nombre] ?? ""}
          onChange={(e) => actualizar(nombre, e.target.value)}
        />
      </label>
    );
  }

  function Area({ titulo, nombre, requerido = false }) {
    return (
      <label className="qc-campo qc-ancho">
        <span>{titulo}</span>
        <textarea
          rows={3}
          required={requerido}
          value={formulario[nombre] ?? ""}
          onChange={(e) => actualizar(nombre, e.target.value)}
        />
      </label>
    );
  }

  return (
    <div className="qc-pagina">
      <div className="qc-contenedor">
        <header className="qc-encabezado">
          <div>
            <button className="qc-volver" onClick={onVolver}>
              <ArrowLeft size={17} /> Volver al panel
            </button>
            <h1>
              <FileSignature size={27} /> Gestión de contratos
            </h1>
            <p>
              Documentación comercial, contratos formales y
              seguimiento.
            </p>
          </div>

          <div className="qc-acciones">
            <button onClick={cargarDatos} className="qc-boton">
              <RefreshCw size={16} /> Actualizar
            </button>
            {puedeCrear && (
              <button
                className="qc-boton qc-primario"
                onClick={() =>
                  setMostrarFormulario(!mostrarFormulario)
                }
              >
                {mostrarFormulario ? <X size={17} /> : <Plus size={17} />}
                {mostrarFormulario ? "Cerrar" : "Nuevo contrato"}
              </button>
            )}
          </div>
        </header>

        {mensaje && <div className="qc-mensaje">{mensaje}</div>}

        <section className="qc-indicadores">
          <div>
            <span>Total de contratos</span>
            <strong>{contratos.length}</strong>
          </div>
          <div>
            <span>Firmados</span>
            <strong>
              {contratos.filter((c) => c.estado === "firmado").length}
            </strong>
          </div>
          <div>
            <span>Borradores</span>
            <strong>
              {contratos.filter((c) => c.estado === "borrador").length}
            </strong>
          </div>
          <div>
            <span>Cumplidos</span>
            <strong>
              {contratos.filter((c) => c.estado === "cumplido").length}
            </strong>
          </div>
        </section>

        {mostrarFormulario && puedeCrear && (
          <form className="qc-panel" onSubmit={guardar}>
            <h2>Registrar nuevo contrato</h2>

            <h3>1. Identificación del proveedor</h3>
            <div className="qc-grid">
              <label className="qc-campo qc-ancho">
                <span>Emitir contrato a nombre de</span>
                <select
                  value={formulario.tipo_proveedor}
                  onChange={(e) => cambiarProveedor(e.target.value)}
                >
                  <option value="empresa">
                    Gallito y Piedra S.A.C. — Persona jurídica
                  </option>
                  <option value="persona_natural">
                    Junior Gonzalo Quiñones Ramírez — Persona natural
                  </option>
                </select>
              </label>

              <Campo
                titulo="Nombre o razón social"
                nombre="proveedor_nombre"
                requerido
              />
              <Campo
                titulo={
                  formulario.tipo_proveedor === "empresa"
                    ? "RUC"
                    : "DNI"
                }
                nombre="proveedor_documento"
                requerido
              />
              <Campo
                titulo="Domicilio"
                nombre="proveedor_domicilio"
                requerido
              />

              {formulario.tipo_proveedor === "empresa" && (
                <>
                  <Campo
                    titulo="Representante legal"
                    nombre="representante_legal"
                    requerido
                  />
                  <Campo
                    titulo="DNI del representante"
                    nombre="representante_dni"
                    requerido
                  />
                </>
              )}
            </div>

            <h3>2. Cliente y modalidad contractual</h3>
            <div className="qc-grid">
              <label className="qc-campo">
                <span>Cliente</span>
                <select
                  required
                  value={formulario.cliente_id}
                  onChange={(e) =>
                    actualizar("cliente_id", e.target.value)
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

              <label className="qc-campo">
                <span>Tipo de contrato</span>
                <select
                  value={formulario.tipo_contrato}
                  onChange={(e) =>
                    actualizar("tipo_contrato", e.target.value)
                  }
                >
                  {Object.entries(TIPOS).map(([id, nombre]) => (
                    <option key={id} value={id}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </label>

              <Area
                titulo="Objeto del contrato"
                nombre="objeto"
                requerido
              />
              <Area
                titulo="Especificaciones técnicas de los materiales"
                nombre="especificaciones_tecnicas"
                requerido
              />
            </div>

            <h3>3. Condiciones económicas y entrega</h3>
            <div className="qc-grid">
              <label className="qc-campo">
                <span>Moneda</span>
                <select
                  value={formulario.moneda}
                  onChange={(e) =>
                    actualizar("moneda", e.target.value)
                  }
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </label>
              <Campo
                titulo="Importe total"
                nombre="importe"
                tipo="number"
                requerido
              />
              <Campo
                titulo="Adelanto"
                nombre="adelanto"
                tipo="number"
              />
              <Campo
                titulo="Fecha del contrato"
                nombre="fecha_contrato"
                tipo="date"
                requerido
              />
              <Campo
                titulo="Fecha de entrega"
                nombre="fecha_entrega"
                tipo="date"
              />
              <Campo
                titulo="Lugar de entrega"
                nombre="lugar_entrega"
              />
              <Campo
                titulo="Lugar de firma"
                nombre="lugar_firma"
              />
              <Area
                titulo="Forma de pago"
                nombre="forma_pago"
                requerido
              />
            </div>

            <h3>4. Cláusulas contractuales</h3>
            <div className="qc-grid">
              <Area
                titulo="Obligaciones del proveedor"
                nombre="obligaciones_proveedor"
                requerido
              />
              <Area
                titulo="Obligaciones del cliente"
                nombre="obligaciones_cliente"
                requerido
              />
              <Area
                titulo="Garantías"
                nombre="garantia"
                requerido
              />
              <Area
                titulo="Penalidades pactadas"
                nombre="penalidades"
              />
              <Area
                titulo="Solución de controversias"
                nombre="solucion_controversias"
              />
              <Area
                titulo="Condiciones adicionales"
                nombre="condiciones"
              />
              <Area
                titulo="Observaciones"
                nombre="observaciones"
              />
            </div>

            <p className="qc-aviso">
              Los contratos se registran inicialmente como borradores.
              Verifica la identidad, representación, condiciones y
              anexos antes de suscribir el documento.
            </p>

            <button
              className="qc-boton qc-primario"
              type="submit"
              disabled={guardando}
            >
              <Save size={17} />
              {guardando ? "Guardando..." : "Guardar contrato"}
            </button>
          </form>
        )}

        <section className="qc-panel">
          <div className="qc-barra">
            <h2>Contratos registrados</h2>
            <label className="qc-busqueda">
              <Search size={17} />
              <input
                placeholder="Buscar contrato, cliente o proveedor"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
          </div>

          <div className="qc-tabla-scroll">
            <table className="qc-tabla">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Proveedor</th>
                  <th>Tipo</th>
                  <th>Importe</th>
                  <th>Estado</th>
                  <th>Documento</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id}>
                    <td>{codigo(c.numero)}</td>
                    <td>{texto(c.cliente_nombre)}</td>
                    <td>{texto(c.proveedor_nombre)}</td>
                    <td>{TIPOS[c.tipo_contrato] || "No indicado"}</td>
                    <td>{dinero(c.importe, c.moneda)}</td>
                    <td>
                      {esAdmin ? (
                        <select
                          value={c.estado}
                          onChange={(e) =>
                            cambiarEstado(c, e.target.value)
                          }
                        >
                          {Object.entries(ESTADOS).map(([id, nombre]) => (
                            <option key={id} value={id}>
                              {nombre}
                            </option>
                          ))}
                        </select>
                      ) : (
                        ESTADOS[c.estado] || c.estado
                      )}
                    </td>
                    <td>
                      <button
                        className="qc-boton"
                        onClick={() => generarPDF(c)}
                      >
                        <Download size={15} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!cargando && filtrados.length === 0 && (
              <p className="qc-vacio">
                No se encontraron contratos.
              </p>
            )}
            {cargando && (
              <p className="qc-vacio">Cargando contratos...</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
