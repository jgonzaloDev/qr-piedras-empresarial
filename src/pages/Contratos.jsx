import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
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
import { supabase } from "../lib/supabase";
import "./Contratos.css";

// =====================================================
// CONFIGURACIÓN
// =====================================================

const TIPOS = {
  suministro: "Suministro de piedra natural",
  suministro_instalacion: "Suministro e instalación de piedra natural",
  servicio_instalacion: "Servicio de instalación de piedra natural",
};

const ESTADOS = {
  borrador: "Borrador",
  firmado: "Firmado",
  cumplido: "Cumplido",
  cancelado: "Cancelado",
};

const PROVEEDORES = {
  gallito: {
    tipo_proveedor: "empresa",
    proveedor_nombre: "Gallito y Piedra S.A.C.",
    proveedor_documento: "",
    proveedor_domicilio: "",
    representante_legal: "",
    representante_dni: "",
  },

  personal: {
    tipo_proveedor: "persona_natural",
    proveedor_nombre: "Junior Gonzalo Quiñones Ramírez",
    proveedor_documento: "",
    proveedor_domicilio: "",
    representante_legal: "",
    representante_dni: "",
  },

  otra_empresa: {
    tipo_proveedor: "empresa",
    proveedor_nombre: "",
    proveedor_documento: "",
    proveedor_domicilio: "",
    representante_legal: "",
    representante_dni: "",
  },

  otra_persona: {
    tipo_proveedor: "persona_natural",
    proveedor_nombre: "",
    proveedor_documento: "",
    proveedor_domicilio: "",
    representante_legal: "",
    representante_dni: "",
  },
};

function fechaLocal() {
  const hoy = new Date();

  return [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0"),
  ].join("-");
}

function crearFormulario() {
  return {
    proveedor_opcion: "gallito",
    ...PROVEEDORES.gallito,

    cliente_id: "",
    cliente_nombre: "",
    cliente_tipo_documento: "",
    cliente_numero_documento: "",
    cliente_domicilio: "",
    cliente_representante: "",
    cliente_representante_dni: "",

    tipo_contrato: "suministro",
    objeto: "",
    especificaciones_tecnicas: "",

    moneda: "PEN",
    importe: "",
    adelanto: "0",
    forma_pago: "",
    incluye_igv: true,

    fecha_contrato: fechaLocal(),
    fecha_entrega: "",
    lugar_entrega: "",
    lugar_firma: "Lima, Perú",

    obligaciones_proveedor: "",
    obligaciones_cliente: "",
    garantia: "",
    penalidades: "",
    solucion_controversias: "",
    condiciones: "",
    observaciones: "",
  };
}

function codigoContrato(numero) {
  return `CONT-${String(numero || 0).padStart(6, "0")}`;
}

function formatoFecha(fecha) {
  if (!fecha) return "No especificada";

  const partes = String(fecha).slice(0, 10).split("-");

  if (partes.length !== 3) return String(fecha);

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function dinero(valor, moneda = "PEN") {
  const simbolo = moneda === "USD" ? "US$" : "S/";

  return (
    simbolo +
    " " +
    Number(valor || 0).toLocaleString("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function valorTexto(valor, defecto = "No especificado") {
  const limpio = String(valor ?? "").trim();
  return limpio || defecto;
}

// =====================================================
// COMPONENTES ESTABLES
// ESTÁN FUERA DEL COMPONENTE PRINCIPAL
// PARA EVITAR QUE LOS CAMPOS PIERDAN EL FOCO
// =====================================================

function Campo({
  titulo,
  nombre,
  valor,
  onCambiar,
  tipo = "text",
  requerido = false,
  placeholder = "",
  min,
  step,
  maxLength,
}) {
  return (
    <label className="qc-campo">
      <span>{titulo}</span>

      <input
        type={tipo}
        name={nombre}
        value={valor ?? ""}
        required={requerido}
        placeholder={placeholder}
        min={min}
        step={step}
        maxLength={maxLength}
        onChange={(e) => onCambiar(nombre, e.target.value)}
      />
    </label>
  );
}

function Area({
  titulo,
  nombre,
  valor,
  onCambiar,
  requerido = false,
  placeholder = "",
}) {
  return (
    <label className="qc-campo qc-ancho">
      <span>{titulo}</span>

      <textarea
        name={nombre}
        value={valor ?? ""}
        required={requerido}
        placeholder={placeholder}
        rows={4}
        onChange={(e) => onCambiar(nombre, e.target.value)}
      />
    </label>
  );
}

// =====================================================
// PDF FORMAL
// =====================================================

function generarPDF(contrato) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margen = 22;
  const ancho = 166;
  let y = 24;

  function espacio(altura = 15) {
    if (y + altura > 270) {
      pdf.addPage();
      y = 24;
    }
  }

  function parrafo(contenido) {
    pdf.setFont("times", "normal");
    pdf.setFontSize(10.5);
    pdf.setTextColor(35, 35, 35);

    const lineas = pdf.splitTextToSize(String(contenido || ""), ancho);

    const altoLinea = 5.5;

    for (const linea of lineas) {
      espacio(altoLinea);
      pdf.text(linea, margen, y);
      y += altoLinea;
    }

    y += 5;
  }

  function clausula(titulo, contenido) {
    espacio(17);

    pdf.setFont("times", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(20, 20, 20);

    const lineas = pdf.splitTextToSize(titulo, ancho);

    for (const linea of lineas) {
      espacio(6);
      pdf.text(linea, margen, y);
      y += 6;
    }

    y += 2;
    parrafo(contenido);
  }

  const esEmpresa = contrato.tipo_proveedor === "empresa";

  const proveedor = valorTexto(contrato.proveedor_nombre);

  const cliente = valorTexto(contrato.cliente_nombre);

  const proveedorIdentificacion = esEmpresa
    ? `${proveedor}, con RUC N.º ${valorTexto(
        contrato.proveedor_documento,
      )}, domiciliada en ${valorTexto(
        contrato.proveedor_domicilio,
      )}, representada por ${valorTexto(
        contrato.representante_legal,
      )}, identificado(a) con DNI N.º ${valorTexto(contrato.representante_dni)}`
    : `${proveedor}, identificado(a) con DNI N.º ${valorTexto(
        contrato.proveedor_documento,
      )}, con domicilio en ${valorTexto(contrato.proveedor_domicilio)}`;

  const clienteIdentificacion =
    `${cliente}, identificado(a) con ` +
    `${valorTexto(
      contrato.cliente_tipo_documento,
      "documento",
    )} N.º ${valorTexto(
      contrato.cliente_numero_documento,
    )}, con domicilio en ${valorTexto(contrato.cliente_domicilio)}` +
    (contrato.cliente_representante
      ? `, representado(a) por ${contrato.cliente_representante}, con DNI N.º ${valorTexto(
          contrato.cliente_representante_dni,
        )}`
      : "");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(155, 116, 55);

  pdf.text("CONTRATO COMERCIAL", 105, y, { align: "center" });

  y += 10;

  pdf.setDrawColor(185, 150, 85);
  pdf.line(margen, y, 188, y);

  y += 11;

  const titulo = `CONTRATO DE ${valorTexto(
    TIPOS[contrato.tipo_contrato],
    "SUMINISTRO",
  ).toUpperCase()}`;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12.5);
  pdf.setTextColor(20, 20, 20);

  const lineasTitulo = pdf.splitTextToSize(titulo, 155);

  pdf.text(lineasTitulo, 105, y, {
    align: "center",
  });

  y += lineasTitulo.length * 6 + 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  pdf.text(`Contrato N.º ${codigoContrato(contrato.numero)}`, 105, y, {
    align: "center",
  });

  y += 13;

  parrafo(
    "Conste por el presente documento el contrato que " +
      "celebran, de una parte, " +
      proveedorIdentificacion +
      ", a quien en adelante se denominará EL PROVEEDOR; " +
      "y, de la otra parte, " +
      clienteIdentificacion +
      ", a quien en adelante se denominará EL CONTRATANTE; " +
      "en los términos y condiciones siguientes:",
  );

  clausula("PRIMERA: OBJETO DEL CONTRATO", valorTexto(contrato.objeto));

  clausula(
    "SEGUNDA: ESPECIFICACIONES TÉCNICAS",
    valorTexto(contrato.especificaciones_tecnicas),
  );

  const importe = Number(contrato.importe || 0);
  const adelanto = Number(contrato.adelanto || 0);

  clausula(
    "TERCERA: PRECIO Y FORMA DE PAGO",
    `El importe total pactado asciende a ${dinero(
      importe,
      contrato.moneda,
    )}. Se establece un adelanto de ${dinero(
      adelanto,
      contrato.moneda,
    )}, quedando un saldo de ${dinero(
      importe - adelanto,
      contrato.moneda,
    )}. Forma de pago: ${valorTexto(contrato.forma_pago)}. ${
      contrato.incluye_igv
        ? "El importe indicado incluye IGV, cuando resulte aplicable."
        : "El importe indicado no incluye IGV, cuando resulte aplicable."
    }`,
  );

  clausula(
    "CUARTA: PLAZO Y LUGAR DE ENTREGA",
    `La entrega o ejecución se realizará en ${valorTexto(
      contrato.lugar_entrega,
    )}. Fecha prevista: ${formatoFecha(
      contrato.fecha_entrega,
    )}. Cualquier modificación del plazo deberá ser acordada por escrito.`,
  );

  clausula(
    "QUINTA: OBLIGACIONES DEL PROVEEDOR",
    valorTexto(contrato.obligaciones_proveedor),
  );

  clausula(
    "SEXTA: OBLIGACIONES DEL CONTRATANTE",
    valorTexto(contrato.obligaciones_cliente),
  );

  clausula(
    "SÉPTIMA: RECEPCIÓN Y CONFORMIDAD",
    "Las partes podrán dejar constancia de la entrega " +
      "de materiales o de la ejecución de los trabajos " +
      "mediante acta de recepción, guía de remisión, " +
      "constancia de conformidad u otro documento acordado. " +
      "Las observaciones deberán comunicarse por escrito.",
  );

  clausula("OCTAVA: GARANTÍAS", valorTexto(contrato.garantia));

  clausula(
    "NOVENA: PENALIDADES E INCUMPLIMIENTO",
    valorTexto(
      contrato.penalidades,
      "No se han pactado penalidades específicas.",
    ),
  );

  clausula(
    "DÉCIMA: MODIFICACIONES CONTRACTUALES",
    "Toda modificación del objeto, precio, alcance, " +
      "materiales o plazo de ejecución deberá constar " +
      "por escrito y contar con la aceptación de ambas partes.",
  );

  clausula(
    "DÉCIMA PRIMERA: SOLUCIÓN DE CONTROVERSIAS",
    valorTexto(
      contrato.solucion_controversias,
      "Las partes procurarán resolver sus diferencias " +
        "mediante trato directo. De no alcanzarse un acuerdo, " +
        "podrán acudir a los mecanismos legales correspondientes " +
        "conforme a la legislación peruana.",
    ),
  );

  if (contrato.condiciones) {
    clausula("DÉCIMA SEGUNDA: CONDICIONES ADICIONALES", contrato.condiciones);
  }

  if (contrato.observaciones) {
    clausula("OBSERVACIONES", contrato.observaciones);
  }

  parrafo(
    `En señal de conformidad, las partes suscriben el ` +
      `presente contrato en ${valorTexto(
        contrato.lugar_firma,
        "Lima, Perú",
      )}, con fecha ${formatoFecha(contrato.fecha_contrato)}.`,
  );

  // Mantener juntas las firmas.
  espacio(58);
  y += 16;

  pdf.setDrawColor(65, 65, 65);
  pdf.line(23, y, 93, y);
  pdf.line(117, y, 187, y);

  y += 7;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);

  pdf.text("EL PROVEEDOR", 58, y, {
    align: "center",
  });

  pdf.text("EL CONTRATANTE", 152, y, {
    align: "center",
  });

  y += 7;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);

  const firmaProveedor = esEmpresa
    ? valorTexto(contrato.representante_legal)
    : proveedor;

  const firmaIzquierda = pdf.splitTextToSize(firmaProveedor, 65);

  const firmaDerecha = pdf.splitTextToSize(
    contrato.cliente_representante || cliente,
    65,
  );

  pdf.text(firmaIzquierda, 58, y, {
    align: "center",
  });

  pdf.text(firmaDerecha, 152, y, {
    align: "center",
  });

  const totalPaginas = pdf.getNumberOfPages();

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    pdf.setPage(pagina);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(110, 110, 110);

    pdf.text(
      `${codigoContrato(contrato.numero)} - Página ${pagina} de ${totalPaginas}`,
      105,
      287,
      { align: "center" },
    );
  }

  pdf.save(`${codigoContrato(contrato.numero)}.pdf`);
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function Contratos({ perfil, onVolver }) {
  const [contratos, setContratos] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [formulario, setFormulario] = useState(crearFormulario);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const puedeCrear =
    ["administrador", "vendedor"].includes(perfil?.rol) &&
    perfil?.activo !== false;

  const esAdministrador =
    perfil?.rol === "administrador" && perfil?.activo !== false;

  // ===================================================
  // CONSULTAR DATOS
  // ===================================================

  const cargarDatos = useCallback(async () => {
    setCargando(true);

    try {
      const [respuestaContratos, respuestaClientes] = await Promise.all([
        supabase.from("contratos").select("*").order("numero", {
          ascending: false,
        }),

        supabase
          .from("clientes")
          .select(
            "id,nombre_razon_social,tipo_documento,numero_documento,direccion",
          )
          .order("nombre_razon_social"),
      ]);

      if (respuestaContratos.error) {
        throw respuestaContratos.error;
      }

      if (respuestaClientes.error) {
        throw respuestaClientes.error;
      }

      setContratos(respuestaContratos.data || []);
      setClientes(respuestaClientes.data || []);
      setMensaje("");
    } catch (error) {
      setMensaje(error.message || "No fue posible cargar los datos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // Se difiere la llamada para evitar el aviso
    // de actualización síncrona dentro del efecto.
    const iniciar = () => {
      void cargarDatos();
    };

    const id = setTimeout(iniciar, 0);

    return () => clearTimeout(id);
  }, [cargarDatos]);

  // ===================================================
  // ACTUALIZAR FORMULARIO
  // ===================================================

  function actualizar(nombre, valor) {
    setFormulario((anterior) => ({
      ...anterior,
      [nombre]: valor,
    }));
  }

  // ===================================================
  // PROVEEDORES
  // ===================================================

  function seleccionarProveedor(opcion) {
    const proveedor = PROVEEDORES[opcion] || PROVEEDORES.gallito;

    setFormulario((anterior) => ({
      ...anterior,
      ...proveedor,
      proveedor_opcion: opcion,
    }));
  }

  // ===================================================
  // CLIENTES
  // ===================================================

  function seleccionarCliente(id) {
    const cliente = clientes.find((item) => item.id === id);

    if (!cliente) {
      setFormulario((anterior) => ({
        ...anterior,
        cliente_id: "",
        cliente_nombre: "",
        cliente_tipo_documento: "",
        cliente_numero_documento: "",
        cliente_domicilio: "",
      }));

      return;
    }

    setFormulario((anterior) => ({
      ...anterior,
      cliente_id: cliente.id,
      cliente_nombre: cliente.nombre_razon_social || "",
      cliente_tipo_documento: cliente.tipo_documento || "",
      cliente_numero_documento: cliente.numero_documento || "",
      cliente_domicilio: cliente.direccion || "",
    }));
  }

  // ===================================================
  // BUSCAR CONTRATOS
  // ===================================================

  const contratosFiltrados = useMemo(() => {
    const termino = busqueda.toLowerCase().trim();

    if (!termino) return contratos;

    return contratos.filter((contrato) => {
      const contenido = [
        codigoContrato(contrato.numero),
        contrato.cliente_nombre,
        contrato.proveedor_nombre,
        contrato.objeto,
        contrato.estado,
        TIPOS[contrato.tipo_contrato],
      ]
        .join(" ")
        .toLowerCase();

      return contenido.includes(termino);
    });
  }, [contratos, busqueda]);

  // ===================================================
  // GUARDAR
  // ===================================================

  async function guardarContrato(evento) {
    evento.preventDefault();

    if (!puedeCrear || guardando) return;

    setMensaje("");

    if (!formulario.cliente_id) {
      setMensaje("Debes seleccionar un cliente registrado.");
      return;
    }

    if (
      !formulario.proveedor_nombre.trim() ||
      !formulario.proveedor_domicilio.trim()
    ) {
      setMensaje("Completa el nombre y domicilio del proveedor.");
      return;
    }

    const documentoProveedor = formulario.proveedor_documento.trim();

    if (
      formulario.tipo_proveedor === "empresa" &&
      !/^\d{11}$/.test(documentoProveedor)
    ) {
      setMensaje("El RUC debe contener 11 dígitos.");
      return;
    }

    if (
      formulario.tipo_proveedor === "persona_natural" &&
      !/^\d{8}$/.test(documentoProveedor)
    ) {
      setMensaje("El DNI debe contener 8 dígitos.");
      return;
    }

    if (
      formulario.tipo_proveedor === "empresa" &&
      (!formulario.representante_legal.trim() ||
        !/^\d{8}$/.test(formulario.representante_dni.trim()))
    ) {
      setMensaje("Completa el representante legal y su DNI.");
      return;
    }

    if (
      !formulario.cliente_nombre.trim() ||
      !formulario.cliente_numero_documento.trim() ||
      !formulario.cliente_domicilio.trim()
    ) {
      setMensaje("Completa los datos del cliente.");
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
      setMensaje("Verifica el importe total y el adelanto.");
      return;
    }

    setGuardando(true);

    try {
      const { data: sesion, error: errorSesion } =
        await supabase.auth.getUser();

      if (errorSesion || !sesion?.user) {
        throw new Error("Debes iniciar sesión nuevamente.");
      }

      const { data: ultimo, error: errorNumero } = await supabase
        .from("contratos")
        .select("numero")
        .order("numero", {
          ascending: false,
        })
        .limit(1);

      if (errorNumero) {
        throw errorNumero;
      }

      const numero = Number(ultimo?.[0]?.numero || 0) + 1;

      const datosFormulario = {
        ...formulario,
      };

      // Este dato solo se utiliza en el formulario.
      delete datosFormulario.proveedor_opcion;

      const datos = {
        ...datosFormulario,
        numero,
        importe,
        adelanto,
        fecha_entrega: formulario.fecha_entrega || null,
        estado: "borrador",
        creado_por: sesion.user.id,
        cotizacion_id: null,
        venta_id: null,
      };

      const { error } = await supabase.from("contratos").insert(datos);

      if (error) {
        if (error.code === "23505") {
          throw new Error(
            "El número de contrato ya existe. Actualiza e intenta nuevamente.",
          );
        }

        throw error;
      }

      setFormulario(crearFormulario());
      setMostrarFormulario(false);

      await cargarDatos();

      setMensaje(`Contrato ${codigoContrato(numero)} guardado correctamente.`);
    } catch (error) {
      setMensaje(error.message || "No fue posible guardar el contrato.");
    } finally {
      setGuardando(false);
    }
  }

  // ===================================================
  // CAMBIAR ESTADO
  // ===================================================

  async function cambiarEstado(contrato, estado) {
    if (!esAdministrador) return;

    const confirmado = window.confirm(
      `¿Cambiar ${codigoContrato(contrato.numero)} a "${ESTADOS[estado]}"?`,
    );

    if (!confirmado) return;

    const { error } = await supabase
      .from("contratos")
      .update({ estado })
      .eq("id", contrato.id);

    if (error) {
      setMensaje(error.message);
      return;
    }

    await cargarDatos();
    setMensaje("Estado actualizado correctamente.");
  }

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <div className="qc-pagina">
      <div className="qc-contenedor">
        <header className="qc-encabezado">
          <div>
            <button type="button" className="qc-volver" onClick={onVolver}>
              <ArrowLeft size={17} />
              Volver al panel
            </button>

            <h1>
              <FileSignature size={27} />
              Gestión de contratos
            </h1>

            <p>
              Contratos comerciales, documentos formales y seguimiento
              contractual.
            </p>
          </div>

          <div className="qc-acciones">
            <button type="button" className="qc-boton" onClick={cargarDatos}>
              <RefreshCw size={16} />
              Actualizar
            </button>

            {puedeCrear && (
              <button
                type="button"
                className="qc-boton qc-primario"
                onClick={() => setMostrarFormulario((anterior) => !anterior)}
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

        {/* ============================================
            FORMULARIO
            ============================================ */}

        {mostrarFormulario && puedeCrear && (
          <form className="qc-panel" onSubmit={guardarContrato}>
            <h2>Registrar nuevo contrato</h2>

            <h3>1. Identificación del proveedor</h3>

            <div className="qc-grid">
              <label className="qc-campo qc-ancho">
                <span>Emitir contrato a nombre de</span>

                <select
                  value={formulario.proveedor_opcion}
                  onChange={(e) => seleccionarProveedor(e.target.value)}
                >
                  <option value="gallito">
                    Gallito y Piedra S.A.C. — Persona jurídica
                  </option>

                  <option value="personal">
                    Junior Gonzalo Quiñones Ramírez — Persona natural
                  </option>

                  <option value="otra_empresa">
                    Otra empresa — Digitar razón social
                  </option>

                  <option value="otra_persona">
                    Otra persona natural — Digitar nombre
                  </option>
                </select>
              </label>

              <Campo
                titulo={
                  formulario.tipo_proveedor === "empresa"
                    ? "Nombre o razón social"
                    : "Nombre completo"
                }
                nombre="proveedor_nombre"
                valor={formulario.proveedor_nombre}
                onCambiar={actualizar}
                requerido
              />

              <Campo
                titulo={formulario.tipo_proveedor === "empresa" ? "RUC" : "DNI"}
                nombre="proveedor_documento"
                valor={formulario.proveedor_documento}
                onCambiar={actualizar}
                requerido
                maxLength={formulario.tipo_proveedor === "empresa" ? 11 : 8}
              />

              <Campo
                titulo="Domicilio del proveedor"
                nombre="proveedor_domicilio"
                valor={formulario.proveedor_domicilio}
                onCambiar={actualizar}
                requerido
              />

              {formulario.tipo_proveedor === "empresa" && (
                <>
                  <Campo
                    titulo="Representante legal"
                    nombre="representante_legal"
                    valor={formulario.representante_legal}
                    onCambiar={actualizar}
                    requerido
                  />

                  <Campo
                    titulo="DNI del representante legal"
                    nombre="representante_dni"
                    valor={formulario.representante_dni}
                    onCambiar={actualizar}
                    requerido
                    maxLength={8}
                  />
                </>
              )}
            </div>

            <h3>2. Identificación del cliente</h3>

            <div className="qc-grid">
              <label className="qc-campo qc-ancho">
                <span>Seleccionar cliente</span>

                <select
                  required
                  value={formulario.cliente_id}
                  onChange={(e) => seleccionarCliente(e.target.value)}
                >
                  <option value="">Seleccionar cliente</option>

                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre_razon_social}
                    </option>
                  ))}
                </select>
              </label>

              <Campo
                titulo="Nombre o razón social del cliente"
                nombre="cliente_nombre"
                valor={formulario.cliente_nombre}
                onCambiar={actualizar}
                requerido
              />

              <Campo
                titulo="Tipo de documento"
                nombre="cliente_tipo_documento"
                valor={formulario.cliente_tipo_documento}
                onCambiar={actualizar}
                requerido
              />

              <Campo
                titulo="Número de documento"
                nombre="cliente_numero_documento"
                valor={formulario.cliente_numero_documento}
                onCambiar={actualizar}
                requerido
              />

              <Campo
                titulo="Domicilio del cliente"
                nombre="cliente_domicilio"
                valor={formulario.cliente_domicilio}
                onCambiar={actualizar}
                requerido
              />

              <Campo
                titulo="Representante del cliente (opcional)"
                nombre="cliente_representante"
                valor={formulario.cliente_representante}
                onCambiar={actualizar}
              />

              <Campo
                titulo="DNI del representante (opcional)"
                nombre="cliente_representante_dni"
                valor={formulario.cliente_representante_dni}
                onCambiar={actualizar}
              />
            </div>

            <h3>3. Modalidad contractual</h3>

            <div className="qc-grid">
              <label className="qc-campo qc-ancho">
                <span>Tipo de contrato</span>

                <select
                  value={formulario.tipo_contrato}
                  onChange={(e) => actualizar("tipo_contrato", e.target.value)}
                >
                  {Object.entries(TIPOS).map(([clave, nombre]) => (
                    <option key={clave} value={clave}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </label>

              <Area
                titulo="Objeto del contrato"
                nombre="objeto"
                valor={formulario.objeto}
                onCambiar={actualizar}
                requerido
                placeholder="Describir el trabajo o suministro contratado"
              />

              <Area
                titulo="Especificaciones técnicas de los materiales"
                nombre="especificaciones_tecnicas"
                valor={formulario.especificaciones_tecnicas}
                onCambiar={actualizar}
                requerido
                placeholder="Tipo de piedra, dimensiones, espesor, acabado, metraje, tolerancias y condiciones técnicas"
              />
            </div>

            <h3>4. Condiciones económicas</h3>

            <div className="qc-grid">
              <label className="qc-campo">
                <span>Moneda</span>

                <select
                  value={formulario.moneda}
                  onChange={(e) => actualizar("moneda", e.target.value)}
                >
                  <option value="PEN">Soles (PEN)</option>

                  <option value="USD">Dólares (USD)</option>
                </select>
              </label>

              <Campo
                titulo="Importe total"
                nombre="importe"
                tipo="number"
                valor={formulario.importe}
                onCambiar={actualizar}
                requerido
                min="0.01"
                step="0.01"
              />

              <Campo
                titulo="Adelanto"
                nombre="adelanto"
                tipo="number"
                valor={formulario.adelanto}
                onCambiar={actualizar}
                min="0"
                step="0.01"
              />

              <label className="qc-campo">
                <span>Tratamiento del IGV</span>

                <select
                  value={formulario.incluye_igv ? "si" : "no"}
                  onChange={(e) =>
                    actualizar("incluye_igv", e.target.value === "si")
                  }
                >
                  <option value="si">Incluye IGV cuando corresponda</option>

                  <option value="no">No incluye IGV cuando corresponda</option>
                </select>
              </label>

              <Area
                titulo="Forma de pago"
                nombre="forma_pago"
                valor={formulario.forma_pago}
                onCambiar={actualizar}
                requerido
                placeholder="Adelanto, pagos parciales, saldo y fechas pactadas"
              />
            </div>

            <h3>5. Plazos y entrega</h3>

            <div className="qc-grid">
              <Campo
                titulo="Fecha del contrato"
                nombre="fecha_contrato"
                tipo="date"
                valor={formulario.fecha_contrato}
                onCambiar={actualizar}
                requerido
              />

              <Campo
                titulo="Fecha de entrega"
                nombre="fecha_entrega"
                tipo="date"
                valor={formulario.fecha_entrega}
                onCambiar={actualizar}
              />

              <Campo
                titulo="Lugar de entrega o ejecución"
                nombre="lugar_entrega"
                valor={formulario.lugar_entrega}
                onCambiar={actualizar}
              />

              <Campo
                titulo="Lugar de firma"
                nombre="lugar_firma"
                valor={formulario.lugar_firma}
                onCambiar={actualizar}
              />
            </div>

            <h3>6. Cláusulas contractuales</h3>

            <div className="qc-grid">
              <Area
                titulo="Obligaciones del proveedor"
                nombre="obligaciones_proveedor"
                valor={formulario.obligaciones_proveedor}
                onCambiar={actualizar}
                requerido
              />

              <Area
                titulo="Obligaciones del contratante"
                nombre="obligaciones_cliente"
                valor={formulario.obligaciones_cliente}
                onCambiar={actualizar}
                requerido
              />

              <Area
                titulo="Garantías"
                nombre="garantia"
                valor={formulario.garantia}
                onCambiar={actualizar}
                requerido
              />

              <Area
                titulo="Penalidades"
                nombre="penalidades"
                valor={formulario.penalidades}
                onCambiar={actualizar}
              />

              <Area
                titulo="Solución de controversias"
                nombre="solucion_controversias"
                valor={formulario.solucion_controversias}
                onCambiar={actualizar}
              />

              <Area
                titulo="Condiciones adicionales"
                nombre="condiciones"
                valor={formulario.condiciones}
                onCambiar={actualizar}
              />

              <Area
                titulo="Observaciones"
                nombre="observaciones"
                valor={formulario.observaciones}
                onCambiar={actualizar}
              />
            </div>

            <p className="qc-aviso">
              El contrato se guardará como borrador. Verifica la identidad de
              las partes, facultades de representación, obligaciones y anexos
              técnicos antes de su firma.
            </p>

            <button
              type="submit"
              className="qc-boton qc-primario"
              disabled={guardando}
            >
              <Save size={17} />

              {guardando ? "Guardando contrato..." : "Guardar contrato"}
            </button>
          </form>
        )}

        {/* ============================================
            LISTADO DE CONTRATOS
            ============================================ */}

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
                {contratosFiltrados.map((contrato) => (
                  <tr key={contrato.id}>
                    <td>{codigoContrato(contrato.numero)}</td>

                    <td>{valorTexto(contrato.cliente_nombre)}</td>

                    <td>{valorTexto(contrato.proveedor_nombre)}</td>

                    <td>{TIPOS[contrato.tipo_contrato] || "No indicado"}</td>

                    <td>{dinero(contrato.importe, contrato.moneda)}</td>

                    <td>
                      {esAdministrador ? (
                        <select
                          value={contrato.estado}
                          onChange={(e) =>
                            cambiarEstado(contrato, e.target.value)
                          }
                        >
                          {Object.entries(ESTADOS).map(([clave, nombre]) => (
                            <option key={clave} value={clave}>
                              {nombre}
                            </option>
                          ))}
                        </select>
                      ) : (
                        ESTADOS[contrato.estado] || contrato.estado
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="qc-boton"
                        onClick={() => generarPDF(contrato)}
                      >
                        <Download size={15} />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {cargando && <p className="qc-vacio">Cargando contratos...</p>}

            {!cargando && contratosFiltrados.length === 0 && (
              <p className="qc-vacio">No se encontraron contratos.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
