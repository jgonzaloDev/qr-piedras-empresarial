/* global process */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Método no permitido",
    });
  }

  const ruc = String(req.query.ruc || "").trim();

  if (!/^\d{11}$/.test(ruc)) {
    return res.status(400).json({
      error: "El RUC debe tener 11 dígitos.",
    });
  }

  const token = process.env.CONSULTA_RUC_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: "Falta configurar CONSULTA_RUC_TOKEN.",
    });
  }

  try {
    const respuesta = await fetch(
      `https://consultaderuc.pe/api/v1/ruc/${ruc}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok || resultado.success === false) {
      return res.status(respuesta.status || 502).json({
        error: resultado.message || "No se pudo consultar el RUC.",
      });
    }

    // Adaptación de los datos del proveedor
    const datos = resultado.data || resultado.payload || resultado;

    return res.status(200).json({
      ruc: datos.ruc || ruc,
      razon_social:
        datos.razon_social ||
        datos.razonSocial ||
        datos.nombre_o_razon_social ||
        "",
      direccion:
        datos.direccion ||
        datos.direccion_fiscal ||
        datos.domicilio_fiscal ||
        "",
      estado: datos.estado || "",
      condicion: datos.condicion || "",
    });
  } catch {
    return res.status(502).json({
      error: "No fue posible conectar con el servicio de RUC.",
    });
  }
}
