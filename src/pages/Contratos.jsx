import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
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
  Pencil,
  CheckCircle2,
  Ban,
  Trash2,
} from "lucide-react";
import "./Contratos.css";

// ======================================================
// CONFIGURACIÓN
// ======================================================

const fechaHoy = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const PROVEEDORES = {
  gallito: {
    // Gallito y Piedra es el nombre comercial del negocio de Félix.
    // El proveedor contractual es la persona natural titular del RUC.
    tipo_proveedor: "persona_natural",
    proveedor_nombre: "Félix Mendoza Ochante",
    proveedor_documento: "10091300775",
    proveedor_domicilio:
      "Jr. Flor Iris, Asoc. de Servicios Múltiples, Int. 23, alt. Comisaría Pamplona 1, San Juan de Miraflores",
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
  otro_empresa: {
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

const formularioInicial = () => ({
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
  condiciones: "",
  especificaciones_tecnicas: "",

  moneda: "PEN",
  importe: "",
  adelanto: "0",
  incluye_igv: true,
  forma_pago: "",

  fecha_contrato: fechaHoy(),
  fecha_entrega: "",
  lugar_entrega: "",
  lugar_firma: "Lima, Perú",

  obligaciones_proveedor: "",
  obligaciones_cliente: "",
  garantia: "",
  penalidades: "",
  solucion_controversias: "",
  observaciones: "",
});

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function codigo(numero) {
  return `CONT-${String(numero || 0).padStart(6, "0")}`;
}

function formatoFecha(valor) {
  if (!valor) return "No especificada";

  const partes = String(valor).slice(0, 10).split("-");

  if (partes.length !== 3) return valor;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function dinero(valor, moneda = "PEN") {
  const simbolo = moneda === "USD" ? "US$" : "S/";

  return `${simbolo} ${Number(valor || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function texto(valor, defecto = "No especificado") {
  const limpio = String(valor ?? "").trim();
  return limpio || defecto;
}

function validarDocumento(tipo, documento) {
  const limpio = String(documento || "").trim();

  if (tipo === "empresa") {
    return /^\d{11}$/.test(limpio);
  }

  // Una persona natural puede identificarse con DNI o RUC.
  return /^(\d{8}|\d{11})$/.test(limpio);
}

// ======================================================
// COMPONENTES ESTABLES DEL FORMULARIO
// DEFINIDOS FUERA DE CONTRATOS PARA NO PERDER EL FOCO
// ======================================================

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
        name={nombre}
        type={tipo}
        required={requerido}
        value={valor ?? ""}
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
        rows={4}
        required={requerido}
        value={valor ?? ""}
        placeholder={placeholder}
        onChange={(e) => onCambiar(nombre, e.target.value)}
      />
    </label>
  );
}

// ======================================================
// GENERACIÓN DE PDF
// ======================================================

function generarPDF(contrato) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margen = 22;
  const ancho = 166;
  let y = 24;

  function comprobarEspacio(altura = 20) {
    if (y + altura > 269) {
      pdf.addPage();
      y = 25;
    }
  }

  function parrafo(contenido) {
    pdf.setFont("times", "normal");
    pdf.setFontSize(10.5);
    pdf.setTextColor(35, 35, 35);

    const lineas = pdf.splitTextToSize(String(contenido || ""), ancho);

    comprobarEspacio(lineas.length * 5.5 + 8);

    pdf.text(lineas, margen, y);
    y += lineas.length * 5.5 + 7;
  }

  function clausula(titulo, contenido) {
    comprobarEspacio(25);

    pdf.setFont("times", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(20, 20, 20);
    pdf.text(titulo, margen, y);

    y += 8;
    parrafo(contenido);
  }

  const empresa = contrato.tipo_proveedor === "empresa";

  const nombreProveedor = texto(contrato.proveedor_nombre);

  const nombreCliente = texto(contrato.cliente_nombre);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(157, 116, 52);
  pdf.text("QR PIEDRAS NATURALES", 105, y, { align: "center" });

  y += 10;

  pdf.setDrawColor(175, 143, 80);
  pdf.line(margen, y, 188, y);

  y += 12;

  const titulo = `CONTRATO DE ${texto(
    TIPOS[contrato.tipo_contrato],
    "SUMINISTRO",
  ).toUpperCase()}`;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(25, 25, 25);

  const lineasTitulo = pdf.splitTextToSize(titulo, 155);

  pdf.text(lineasTitulo, 105, y, {
    align: "center",
  });

  y += lineasTitulo.length * 6 + 5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  pdf.text(`Contrato N.º ${codigo(contrato.numero)}`, 105, y, {
    align: "center",
  });

  y += 14;

  const esGallito =
    !empresa &&
    contrato.proveedor_documento === "10091300775" &&
    nombreProveedor.toLowerCase().includes("félix mendoza ochante");

  const identificacionProveedor = empresa
    ? `${nombreProveedor}, con RUC N.º ${texto(
        contrato.proveedor_documento,
      )}, con domicilio en ${texto(
        contrato.proveedor_domicilio,
      )}, debidamente representada por ${texto(
        contrato.representante_legal,
      )}, identificado(a) con DNI N.º ${texto(contrato.representante_dni)}`
    : esGallito
      ? `${nombreProveedor}, identificado con DNI N.º 91300775 y RUC N.º 10091300775, quien desarrolla actividades comerciales bajo el nombre comercial Gallito y Piedra, con domicilio en ${texto(contrato.proveedor_domicilio)}`
      : `${nombreProveedor}, identificado(a) con ${String(contrato.proveedor_documento || "").length === 11 ? "RUC" : "DNI"} N.º ${texto(contrato.proveedor_documento)}, con domicilio en ${texto(contrato.proveedor_domicilio)}`;

  const identificacionCliente =
    `${nombreCliente}, identificado(a) con ` +
    `${texto(contrato.cliente_tipo_documento, "documento")} N.º ${texto(
      contrato.cliente_numero_documento,
    )}, con domicilio en ${texto(contrato.cliente_domicilio)}` +
    (contrato.cliente_representante
      ? `, representado(a) por ${contrato.cliente_representante}, con DNI N.º ${texto(
          contrato.cliente_representante_dni,
        )}`
      : "");

  parrafo(
    `Conste por el presente documento el contrato celebrado entre ` +
      `${identificacionProveedor}, en adelante EL PROVEEDOR; ` +
      `y ${identificacionCliente}, en adelante EL CONTRATANTE; ` +
      `bajo las siguientes cláusulas:`,
  );

  clausula("PRIMERA: OBJETO DEL CONTRATO", texto(contrato.objeto));

  clausula(
    "SEGUNDA: ESPECIFICACIONES TÉCNICAS",
    texto(contrato.especificaciones_tecnicas),
  );

  clausula(
    "TERCERA: PRECIO Y FORMA DE PAGO",
    `El importe contractual asciende a ${dinero(
      contrato.importe,
      contrato.moneda,
    )}. El adelanto pactado es ${dinero(
      contrato.adelanto,
      contrato.moneda,
    )}, quedando un saldo de ${dinero(
      Number(contrato.importe || 0) - Number(contrato.adelanto || 0),
      contrato.moneda,
    )}. Forma de pago: ${texto(
      contrato.forma_pago,
    )}. ${contrato.incluye_igv === false ? "El importe no incluye IGV, cuando resulte aplicable." : "El importe incluye IGV, cuando resulte aplicable."} Los comprobantes de pago se emitirán conforme a la normativa aplicable.`,
  );

  clausula(
    "CUARTA: PLAZO Y LUGAR DE ENTREGA",
    `El lugar de entrega o ejecución será ${texto(
      contrato.lugar_entrega,
    )}. La fecha prevista es ${formatoFecha(
      contrato.fecha_entrega,
    )}. Cualquier modificación deberá acordarse por escrito.`,
  );

  clausula(
    "QUINTA: OBLIGACIONES DEL PROVEEDOR",
    texto(contrato.obligaciones_proveedor),
  );

  clausula(
    "SEXTA: OBLIGACIONES DEL CONTRATANTE",
    texto(contrato.obligaciones_cliente),
  );

  clausula(
    "SÉPTIMA: RECEPCIÓN Y CONFORMIDAD",
    "La recepción de materiales o trabajos podrá documentarse mediante acta, constancia u otro documento acordado por las partes. Las observaciones deberán comunicarse por escrito para su evaluación conforme a las condiciones pactadas.",
  );

  clausula("OCTAVA: GARANTÍAS", texto(contrato.garantia));

  clausula(
    "NOVENA: PENALIDADES E INCUMPLIMIENTO",
    texto(
      contrato.penalidades,
      "No se han establecido penalidades específicas.",
    ),
  );

  clausula(
    "DÉCIMA: MODIFICACIONES Y RESOLUCIÓN",
    "Toda modificación del alcance, precio o plazo deberá constar por escrito y contar con aceptación de ambas partes. La resolución contractual se sujetará a lo pactado y a la normativa aplicable.",
  );

  clausula(
    "DÉCIMA PRIMERA: SOLUCIÓN DE CONTROVERSIAS",
    texto(
      contrato.solucion_controversias,
      "Las partes procurarán resolver sus diferencias mediante trato directo y, de no llegar a un acuerdo, acudirán a las autoridades competentes conforme a la legislación peruana.",
    ),
  );

  if (contrato.condiciones) {
    clausula("DÉCIMA SEGUNDA: CONDICIONES ADICIONALES", contrato.condiciones);
  }

  if (contrato.observaciones) {
    clausula("OBSERVACIONES", contrato.observaciones);
  }

  comprobarEspacio(70);

  parrafo(
    `En señal de conformidad, las partes suscriben el presente contrato en ${texto(
      contrato.lugar_firma,
    )}, con fecha ${formatoFecha(
      contrato.fecha_firma || contrato.fecha_contrato,
    )}.`,
  );

  comprobarEspacio(50);

  y += 17;

  pdf.setDrawColor(70, 70, 70);
  pdf.line(24, y, 92, y);
  pdf.line(118, y, 186, y);

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

  pdf.text(pdf.splitTextToSize(nombreProveedor, 65), 58, y, {
    align: "center",
  });

  pdf.text(pdf.splitTextToSize(nombreCliente, 65), 152, y, { align: "center" });

  const paginas = pdf.getNumberOfPages();

  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(110, 110, 110);

    pdf.text(
      `${codigo(contrato.numero)} - Página ${i} de ${paginas}`,
      105,
      287,
      { align: "center" },
    );
  }

  pdf.save(`${codigo(contrato.numero)}.pdf`);
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function Contratos({ perfil, onVolver }) {
  const [contratos, setContratos] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [formulario, setFormulario] = useState(formularioInicial);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [editandoId, setEditandoId] = useState(null);

  const puedeCrear =
    ["administrador", "vendedor"].includes(perfil?.rol) &&
    perfil?.activo !== false;

  const esAdmin = perfil?.rol === "administrador" && perfil?.activo !== false;

  // ====================================================
  // CARGAR DATOS
  // ====================================================

  const cargarDatos = useCallback(async () => {
    setCargando(true);

    const [rContratos, rClientes] = await Promise.all([
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

    if (rContratos.error || rClientes.error) {
      setMensaje(rContratos.error?.message || rClientes.error?.message);
    } else {
      setContratos(rContratos.data || []);
      setClientes(rClientes.data || []);
    }

    setCargando(false);
  }, []);

  useEffect(() => {
    // Iniciar la consulta después del montaje del componente.
    const temporizador = setTimeout(() => {
      void cargarDatos();
    }, 0);
    return () => clearTimeout(temporizador);
  }, [cargarDatos]);

  // ====================================================
  // ACTUALIZAR CAMPOS
  // ====================================================

  function actualizar(nombre, valor) {
    setFormulario((anterior) => ({
      ...anterior,
      [nombre]: valor,
    }));
  }

  // ====================================================
  // SELECCIONAR O ESCRIBIR PROVEEDOR
  // ====================================================

  function seleccionarProveedor(opcion) {
    const datos = PROVEEDORES[opcion] || PROVEEDORES.gallito;

    setFormulario((anterior) => ({
      ...anterior,
      ...datos,
      proveedor_opcion: opcion,
    }));
  }

  // ====================================================
  // SELECCIONAR CLIENTE
  // ====================================================

  function seleccionarCliente(id) {
    const cliente = clientes.find((c) => c.id === id);

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

  // ====================================================
  // FILTROS
  // ====================================================

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();

    return contratos.filter((c) => {
      const contenido = [
        codigo(c.numero),
        c.cliente_nombre,
        c.proveedor_nombre,
        c.objeto,
        c.estado,
        TIPOS[c.tipo_contrato],
      ]
        .join(" ")
        .toLowerCase();

      return contenido.includes(q);
    });
  }, [contratos, busqueda]);

  // ====================================================
  // GUARDAR CONTRATO
  // ====================================================

  async function guardar(e) {
    e.preventDefault();

    if (!puedeCrear || guardando || (editandoId && !esAdmin)) return;

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

    if (
      !validarDocumento(
        formulario.tipo_proveedor,
        formulario.proveedor_documento,
      )
    ) {
      setMensaje(
        formulario.tipo_proveedor === "empresa"
          ? "El RUC del proveedor debe tener 11 dígitos."
          : "Ingresa un DNI de 8 dígitos o un RUC de 11 dígitos.",
      );
      return;
    }

    if (
      formulario.tipo_proveedor === "empresa" &&
      (!formulario.representante_legal.trim() ||
        !/^\d{8}$/.test(formulario.representante_dni.trim()))
    ) {
      setMensaje("Completa el representante legal y su DNI de 8 dígitos.");
      return;
    }

    if (
      !formulario.cliente_nombre.trim() ||
      !formulario.cliente_numero_documento.trim() ||
      !formulario.cliente_domicilio.trim()
    ) {
      setMensaje("Completa la identificación y domicilio del cliente.");
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
      setMensaje(
        "El importe debe ser mayor a cero y el adelanto no puede superar el importe.",
      );
      return;
    }

    setGuardando(true);

    try {
      const datosFormulario = { ...formulario };
      delete datosFormulario.proveedor_opcion;

      const datos = {
        ...datosFormulario,
        importe,
        adelanto,
        fecha_entrega: formulario.fecha_entrega || null,
        fecha_contrato: formulario.fecha_contrato || null,
      };

      if (editandoId) {
        // Se comprueba nuevamente el estado para impedir modificar
        // un contrato que otro usuario ya firmó o canceló.
        const { data: actual, error: errorActual } = await supabase
          .from("contratos")
          .select("id,numero,estado")
          .eq("id", editandoId)
          .single();
        if (errorActual) throw errorActual;
        if (actual.estado !== "borrador") {
          throw new Error("Solo se pueden editar contratos en borrador.");
        }

        const { data: actualizado, error } = await supabase
          .from("contratos")
          .update({ ...datos, actualizado_en: new Date().toISOString() })
          .eq("id", editandoId)
          .eq("estado", "borrador")
          .select("id,numero")
          .maybeSingle();
        if (error) throw error;
        if (!actualizado)
          throw new Error("No se actualizó: el estado del contrato cambió.");
        setMensaje(
          `Contrato ${codigo(actualizado.numero)} actualizado correctamente.`,
        );
      } else {
        // numero es GENERATED ALWAYS AS IDENTITY: PostgreSQL lo genera.
        const { data: usuarioData, error: usuarioError } =
          await supabase.auth.getUser();
        if (usuarioError || !usuarioData?.user) {
          throw new Error("No se encontró una sesión válida.");
        }
        const { data: nuevo, error } = await supabase
          .from("contratos")
          .insert({
            ...datos,
            estado: "borrador",
            creado_por: usuarioData.user.id,
            cotizacion_id: null,
            venta_id: null,
          })
          .select("id,numero")
          .single();
        if (error) throw error;
        setMensaje(
          `Contrato ${codigo(nuevo.numero)} registrado correctamente.`,
        );
      }

      setFormulario(formularioInicial());
      setEditandoId(null);
      setMostrarFormulario(false);
      await cargarDatos();
    } catch (error) {
      setMensaje(error.message || "No fue posible guardar el contrato.");
    } finally {
      setGuardando(false);
    }
  }

  // ====================================================
  // EDITAR, ACEPTAR, CANCELAR Y ELIMINAR
  // ====================================================

  function cerrarFormulario() {
    setFormulario(formularioInicial());
    setEditandoId(null);
    setMostrarFormulario(false);
  }

  function editarContrato(contrato) {
    if (!esAdmin || contrato.estado !== "borrador") return;
    const base = formularioInicial();
    const opcion =
      contrato.tipo_proveedor === "empresa"
        ? "otro_empresa"
        : contrato.proveedor_documento ===
              PROVEEDORES.gallito.proveedor_documento &&
            contrato.proveedor_nombre === PROVEEDORES.gallito.proveedor_nombre
          ? "gallito"
          : contrato.proveedor_nombre === PROVEEDORES.personal.proveedor_nombre
            ? "personal"
            : "otra_persona";
    const campos = Object.keys(base).filter(
      (campo) => campo !== "proveedor_opcion",
    );
    const valores = {};
    for (const campo of campos) {
      const valor = contrato[campo];
      if (valor !== null && valor !== undefined) {
        valores[campo] = campo.startsWith("fecha_")
          ? String(valor).slice(0, 10)
          : valor;
      }
    }
    setFormulario({ ...base, ...valores, proveedor_opcion: opcion });
    setEditandoId(contrato.id);
    setMostrarFormulario(true);
    setMensaje(
      `Editando ${codigo(contrato.numero)}. Guarda los cambios al terminar.`,
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function cambiarEstado(contrato, nuevoEstado) {
    if (!esAdmin || !["firmado", "cancelado"].includes(nuevoEstado)) return;
    if (contrato.estado === "cancelado" || contrato.estado === "cumplido")
      return;
    if (nuevoEstado === "firmado" && contrato.estado !== "borrador") return;
    if (
      nuevoEstado === "cancelado" &&
      !["borrador", "firmado"].includes(contrato.estado)
    )
      return;

    const pregunta =
      nuevoEstado === "firmado"
        ? `¿Confirmas que ambas partes ya firmaron ${codigo(contrato.numero)}? Esto solo registra el estado; no constituye una firma electrónica.`
        : `¿Cancelar ${codigo(contrato.numero)}? Se conservará en el historial.`;
    if (!window.confirm(pregunta)) return;

    const { data, error } = await supabase
      .from("contratos")
      .update({
        estado: nuevoEstado,
        actualizado_en: new Date().toISOString(),
        ...(nuevoEstado === "firmado" ? { fecha_firma: fechaHoy() } : {}),
      })
      .eq("id", contrato.id)
      .eq("estado", contrato.estado)
      .select("id")
      .maybeSingle();
    if (error) {
      setMensaje(error.message);
      return;
    }
    if (!data) {
      setMensaje("El contrato cambió de estado. Actualiza la pantalla.");
      return;
    }
    if (editandoId === contrato.id) cerrarFormulario();
    await cargarDatos();
    setMensaje(
      nuevoEstado === "firmado"
        ? "Contrato marcado como firmado. Verifica que exista el documento realmente suscrito."
        : "Contrato cancelado y conservado en el historial.",
    );
  }

  async function eliminarContrato(contrato) {
    if (!esAdmin || !["borrador", "cancelado"].includes(contrato.estado))
      return;
    const confirmacion = window.prompt(
      `Eliminar permanentemente ${codigo(contrato.numero)}? Esta acción no se puede deshacer. Escribe ELIMINAR para confirmar:`,
    );
    if (confirmacion !== "ELIMINAR") return;
    const { data, error } = await supabase
      .from("contratos")
      .delete()
      .eq("id", contrato.id)
      .in("estado", ["borrador", "cancelado"])
      .select("id")
      .maybeSingle();
    if (error) {
      setMensaje(error.message);
      return;
    }
    if (!data) {
      setMensaje(
        "No se eliminó el contrato. Comprueba los permisos o su estado actual.",
      );
      return;
    }
    if (editandoId === contrato.id) cerrarFormulario();
    await cargarDatos();
    setMensaje(
      `Contrato ${codigo(contrato.numero)} eliminado permanentemente.`,
    );
  }

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <div className="qc-pagina">
      <div className="qc-contenedor">
        {/* ENCABEZADO */}

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

            <p>Contratos comerciales, documentación formal y seguimiento.</p>
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
                onClick={() => {
                  if (mostrarFormulario) cerrarFormulario();
                  else {
                    setFormulario(formularioInicial());
                    setEditandoId(null);
                    setMostrarFormulario(true);
                  }
                }}
              >
                {mostrarFormulario ? <X size={17} /> : <Plus size={17} />}

                {mostrarFormulario ? "Cerrar" : "Nuevo contrato"}
              </button>
            )}
          </div>
        </header>

        {mensaje && <div className="qc-mensaje">{mensaje}</div>}

        {/* INDICADORES */}

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

        {/* FORMULARIO */}

        {mostrarFormulario && puedeCrear && (!editandoId || esAdmin) && (
          <form className="qc-panel" onSubmit={guardar}>
            <h2 style={{ color: "#f5f5f5" }}>
              {editandoId ? "Editar contrato" : "Registrar nuevo contrato"}
            </h2>

            {/* 1. PROVEEDOR */}

            <h3>1. Identificación del proveedor</h3>

            <div className="qc-grid">
              <label className="qc-campo qc-ancho">
                <span>Seleccionar proveedor o ingresar uno nuevo</span>

                <select
                  value={formulario.proveedor_opcion}
                  onChange={(e) => seleccionarProveedor(e.target.value)}
                >
                  <option value="gallito">
                    Gallito y Piedra — Negocio de Félix Mendoza Ochante
                  </option>

                  <option value="personal">
                    Junior Gonzalo Quiñones Ramírez — Persona natural
                  </option>

                  <option value="otro_empresa">
                    Otra empresa — Digitar razón social
                  </option>

                  <option value="otra_persona">
                    Otra persona natural — Digitar nombre completo
                  </option>
                </select>
              </label>

              <Campo
                titulo={
                  formulario.tipo_proveedor === "empresa"
                    ? "Razón social de la empresa"
                    : "Nombre completo de la persona natural"
                }
                nombre="proveedor_nombre"
                valor={formulario.proveedor_nombre}
                onCambiar={actualizar}
                requerido
                placeholder="Escribe el nombre o razón social"
              />

              <Campo
                titulo={
                  formulario.tipo_proveedor === "empresa" ? "RUC" : "DNI o RUC"
                }
                nombre="proveedor_documento"
                valor={formulario.proveedor_documento}
                onCambiar={actualizar}
                requerido
                maxLength={formulario.tipo_proveedor === "empresa" ? 11 : 11}
              />

              {formulario.proveedor_opcion === "gallito" && (
                <p className="qc-aviso qc-ancho">
                  Gallito y Piedra es el nombre comercial. El contrato se
                  celebra a nombre de Félix Mendoza Ochante, persona natural
                  titular del RUC 10091300775. Verifica el domicilio y la
                  situación del RUC en SUNAT antes de firmar.
                </p>
              )}

              <Campo
                titulo="Domicilio del proveedor"
                nombre="proveedor_domicilio"
                valor={formulario.proveedor_domicilio}
                onCambiar={actualizar}
                requerido
                placeholder="Dirección completa"
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

            {/* 2. CLIENTE */}

            <h3>2. Identificación del cliente</h3>

            <div className="qc-grid">
              <label className="qc-campo qc-ancho">
                <span>Seleccionar cliente registrado</span>

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
                titulo="Representante del cliente (si corresponde)"
                nombre="cliente_representante"
                valor={formulario.cliente_representante}
                onCambiar={actualizar}
              />

              <Campo
                titulo="DNI del representante del cliente"
                nombre="cliente_representante_dni"
                valor={formulario.cliente_representante_dni}
                onCambiar={actualizar}
              />
            </div>

            {/* 3. MODALIDAD */}

            <h3>3. Modalidad y objeto contractual</h3>

            <div className="qc-grid">
              <label className="qc-campo qc-ancho">
                <span>Tipo de contrato</span>

                <select
                  value={formulario.tipo_contrato}
                  onChange={(e) => actualizar("tipo_contrato", e.target.value)}
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
                valor={formulario.objeto}
                onCambiar={actualizar}
                requerido
                placeholder="Describe el suministro o servicio contratado"
              />

              <Area
                titulo="Especificaciones técnicas"
                nombre="especificaciones_tecnicas"
                valor={formulario.especificaciones_tecnicas}
                onCambiar={actualizar}
                requerido
                placeholder="Material, formato, espesor, acabado, metraje y demás especificaciones"
              />
            </div>

            {/* 4. ECONOMÍA */}

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

              <label className="qc-campo">
                <span>Tratamiento del IGV</span>
                <select
                  value={formulario.incluye_igv ? "si" : "no"}
                  onChange={(e) =>
                    actualizar("incluye_igv", e.target.value === "si")
                  }
                >
                  <option value="si">Incluye IGV (si corresponde)</option>
                  <option value="no">No incluye IGV (si corresponde)</option>
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

              <Area
                titulo="Forma de pago"
                nombre="forma_pago"
                valor={formulario.forma_pago}
                onCambiar={actualizar}
                requerido
                placeholder="Indica fechas, porcentajes, medios de pago y condiciones"
              />
            </div>

            {/* 5. FECHAS */}

            <h3>5. Plazos y lugar de entrega</h3>

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

            {/* 6. CLÁUSULAS */}

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
                titulo="Penalidades pactadas"
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
              El contrato se registrará como borrador. Revisa la identidad de
              las partes, sus facultades de representación, condiciones y anexos
              técnicos antes de firmarlo.
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

        {/* LISTADO */}

        <section className="qc-panel">
          <div className="qc-barra">
            <h2 style={{ color: "#f5f5f5" }}>Contratos registrados</h2>

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
                  <th>Acciones</th>
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

                    <td>{ESTADOS[c.estado] || c.estado}</td>

                    <td>
                      <button
                        type="button"
                        className="qc-boton"
                        onClick={() => generarPDF(c)}
                      >
                        <Download size={15} />
                        PDF
                      </button>
                    </td>
                    <td>
                      {esAdmin && (
                        <div
                          style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                        >
                          {c.estado === "borrador" && (
                            <>
                              <button
                                type="button"
                                className="qc-boton"
                                onClick={() => editarContrato(c)}
                                title="Editar borrador"
                              >
                                <Pencil size={14} /> Editar
                              </button>
                              <button
                                type="button"
                                className="qc-boton"
                                onClick={() => cambiarEstado(c, "firmado")}
                                title="Confirmar que ambas partes firmaron"
                              >
                                <CheckCircle2 size={14} /> Aceptar
                              </button>
                            </>
                          )}
                          {["borrador", "firmado"].includes(c.estado) && (
                            <button
                              type="button"
                              className="qc-boton"
                              onClick={() => cambiarEstado(c, "cancelado")}
                            >
                              <Ban size={14} /> Cancelar
                            </button>
                          )}
                          {["borrador", "cancelado"].includes(c.estado) && (
                            <button
                              type="button"
                              className="qc-boton"
                              onClick={() => eliminarContrato(c)}
                              title="Eliminar permanentemente"
                            >
                              <Trash2 size={14} /> Eliminar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {cargando && <p className="qc-vacio">Cargando contratos...</p>}

            {!cargando && filtrados.length === 0 && (
              <p className="qc-vacio">No se encontraron contratos.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
