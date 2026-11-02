/* global process */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });
  const ruc = String(req.query.ruc || '').trim();
  if (!/^\\d{11}$/.test(ruc)) return res.status(400).json({ error: 'El RUC debe tener 11 dígitos.' });

  // Verificar sesión Supabase en el servidor: nunca confiar solo en el frontend.
  const bearer = req.headers.authorization || '';
  const jwt = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
  if (!jwt) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) return res.status(500).json({ error: 'Falta configuración de Supabase.' });
  try {
    
const validar = await fetch(
  `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`,
  {
    headers: {
      apikey: supabaseAnon,
      Authorization: `Bearer ${jwt}`,
    },
  }
);

    if (!validar.ok) return res.status(401).json({ error: 'Sesión no válida o vencida.' });
    const usuario = await validar.json();
    if (!usuario?.id) return res.status(401).json({ error: 'Sesión no válida.' });
  } catch {
    return res.status(502).json({ error: 'No se pudo verificar la sesión.' });
  }

  const token = process.env.CONSULTA_RUC_TOKEN;
  if (!token) return res.status(500).json({ error: 'Falta configurar CONSULTA_RUC_TOKEN.' });
  try {
    const respuesta = await fetch(`https://consultaderuc.pe/api/v1/ruc/${ruc}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const resultado = await respuesta.json();
    if (!respuesta.ok || resultado.success === false) {
      return res.status(respuesta.ok ? 502 : respuesta.status).json({
        error: resultado.message || 'No se pudo consultar el RUC.',
      });
    }
    const datos = resultado.data || resultado.payload || resultado;
    return res.status(200).json({
      ruc: datos.ruc || ruc,
      razon_social: datos.razon_social || datos.razonSocial || datos.nombre_o_razon_social || '',
      direccion: datos.direccion || datos.direccion_fiscal || datos.domicilio_fiscal || '',
      estado: datos.estado || '',
      condicion: datos.condicion_domicilio || datos.condicion || '',
    });
  } catch {
    return res.status(502).json({ error: 'No fue posible conectar con el servicio de RUC.' });
  }
}