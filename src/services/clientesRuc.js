import { supabase } from "../lib/supabase";

export async function buscarClientePorRuc(ruc) {
  const numero = String(ruc || "").trim();

  // Validar que el RUC tenga exactamente 11 dígitos
  if (!/^\d{11}$/.test(numero)) {
    throw new Error("El RUC debe tener 11 dígitos.");
  }

  // 1. Buscar primero en Supabase
  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("numero_documento", numero)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  // 2. Si ya existe, reutilizar sus datos
  if (cliente) {
    return {
      existe: true,
      cliente,
      datos: {
        ruc: numero,
        razon_social: cliente.nombre_razon_social,
        direccion: cliente.direccion || "",
      },
    };
  }

  // 3. Obtener sesión del usuario
  const { data: sesion, error: errorSesion } = await supabase.auth.getSession();

  const token = sesion?.session?.access_token;

  if (errorSesion || !token) {
    throw new Error("Inicia sesión para consultar el RUC.");
  }

  // 4. Consultar la API protegida de Vercel
  const respuesta = await fetch(
    `/api/consultar-ruc?ruc=${encodeURIComponent(numero)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(datos.error || "No se pudo consultar el RUC.");
  }

  if (!datos.razon_social) {
    throw new Error("El proveedor no devolvió la razón social.");
  }

  // 5. Devolver los datos para completar el formulario
  return {
    existe: false,
    cliente: null,
    datos,
  };
}
