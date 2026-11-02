import { supabase } from "../lib/supabase";

export async function buscarClientePorRuc(ruc) {
  const numero = String(ruc || "").trim();
  if (!/^\d{11}$/.test(numero))
    throw new Error("El RUC debe tener 11 dígitos.");

  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("numero_documento", numero)
    .maybeSingle();
  if (error) throw new Error(error.message);
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

  const { data: sesion, error: errorSesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (errorSesion || !token)
    throw new Error("Inicia sesión para consultar el RUC.");

  const respuesta = await fetch(
    `/api/consultar-ruc?ruc=${encodeURIComponent(numero)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok)
    throw new Error(datos.error || "No se pudo consultar el RUC.");
  if (!datos.razon_social)
    throw new Error("El proveedor no devolvió la razón social.");
  return { existe: false, cliente: null, datos };
}
