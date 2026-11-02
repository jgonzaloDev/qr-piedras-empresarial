import { supabase } from "../lib/supabase";

export async function buscarClientePorRuc(ruc) {
  const numero = String(ruc || "").trim();

  if (!/^\d{11}$/.test(numero)) {
    throw new Error("Ingresa un RUC válido de 11 dígitos.");
  }

  // Primero buscar en nuestra base de datos
  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("numero_documento", numero)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (cliente) {
    return {
      origen: "supabase",
      existe: true,
      cliente,
      datos: {
        ruc: cliente.numero_documento,
        razon_social: cliente.nombre_razon_social || "",
        direccion: cliente.direccion || "",
      },
    };
  }

  // Si no existe, consultar mediante nuestro backend
  const respuesta = await fetch(
    `/api/consultar-ruc?ruc=${encodeURIComponent(numero)}`,
  );

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(datos.error || "Error consultando RUC.");
  }

  if (!datos.razon_social) {
    throw new Error(
      "La consulta no devolvió una razón social. Revisa la respuesta de la API.",
    );
  }

  return {
    origen: "sunat",
    existe: false,
    cliente: null,
    datos,
  };
}

export async function guardarClienteConsultado(datos) {
  const ruc = String(datos.ruc || "").trim();

  if (!/^\d{11}$/.test(ruc)) {
    throw new Error("El RUC debe tener 11 dígitos.");
  }

  // Evitar duplicados
  const { data: existente, error: errorBusqueda } = await supabase
    .from("clientes")
    .select("*")
    .eq("numero_documento", ruc)
    .maybeSingle();

  if (errorBusqueda) {
    throw new Error(errorBusqueda.message);
  }

  if (existente) return existente;

  const { data: nuevo, error } = await supabase
    .from("clientes")
    .insert({
      tipo_documento: "RUC",
      numero_documento: ruc,
      nombre_razon_social: datos.razon_social,
      direccion: datos.direccion || "",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return nuevo;
}
