
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const DORADO = '#d4af67';
const FONDO = '#101114';
const PANEL = '#1d1f23';
const BORDE = '#66552f';

const FORMULARIO_VACIO = {
  nombre_razon_social: '',
  tipo_documento: 'DNI',
  numero_documento: '',
  telefono: '',
  correo: '',
  direccion: '',
};

const TIPOS_DOCUMENTO = ['DNI', 'RUC', 'CE', 'PASAPORTE'];

function limpiarFormulario(datos = FORMULARIO_VACIO) {
  return {
    nombre_razon_social: datos.nombre_razon_social || '',
    tipo_documento: datos.tipo_documento || 'DNI',
    numero_documento: datos.numero_documento || '',
    telefono: datos.telefono || '',
    correo: datos.correo || '',
    direccion: datos.direccion || '',
  };
}

function validarCliente(cliente) {
  if (!cliente.nombre_razon_social.trim()) {
    return 'Ingresa el nombre o razón social del cliente.';
  }

  const documento = cliente.numero_documento.trim();

  if (cliente.tipo_documento === 'DNI' && documento) {
    if (!/^\d{8}$/.test(documento)) {
      return 'El DNI debe contener exactamente 8 números.';
    }
  }

  if (cliente.tipo_documento === 'RUC' && documento) {
    if (!/^\d{11}$/.test(documento)) {
      return 'El RUC debe contener exactamente 11 números.';
    }
  }

  if (cliente.correo.trim()) {
    const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formatoCorreo.test(cliente.correo.trim())) {
      return 'Ingresa un correo electrónico válido.';
    }
  }

  return '';
}

const campoStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '13px 14px',
  borderRadius: 9,
  border: '1px solid #45484e',
  background: '#292c32',
  color: '#ffffff',
  fontSize: 14,
  outlineColor: DORADO,
};

const botonPrincipal = {
  padding: '12px 20px',
  background: DORADO,
  color: '#101114',
  border: 'none',
  borderRadius: 9,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};

const botonSecundario = {
  padding: '10px 15px',
  background: '#303238',
  color: '#ffffff',
  border: '1px solid #555',
  borderRadius: 8,
  cursor: 'pointer',
};

export default function Clientes({ onVolver, perfil }) {
  const [clientes, setClientes] = useState([]);
  const [formulario, setFormulario] = useState(
    { ...FORMULARIO_VACIO }
  );

  const [editandoId, setEditandoId] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const rol = String(perfil?.rol || '').toLowerCase();

  const puedeGestionar = [
    'administrador',
    'vendedor',
  ].includes(rol);

  const puedeEliminar = rol === 'administrador';

  const cargarClientes = useCallback(async () => {
    setCargando(true);

    const { data, error: consultaError } = await supabase
      .from('clientes')
      .select(`
        id,
        nombre_razon_social,
        tipo_documento,
        numero_documento,
        telefono,
        correo,
        direccion,
        creado_en
      `)
      .order('creado_en', { ascending: false });

    if (consultaError) {
      console.error('Error al consultar clientes:', consultaError);
      setError(`No se pudieron cargar los clientes: ${consultaError.message}`);
    } else {
      setClientes(data || []);
      setError('');
    }

    setCargando(false);
  }, []);

  useEffect(() => {
    cargarClientes();
  }, [cargarClientes]);

  const clientesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) return clientes;

    return clientes.filter((cliente) => {
      return [
        cliente.nombre_razon_social,
        cliente.numero_documento,
        cliente.telefono,
        cliente.correo,
        cliente.direccion,
      ]
        .some((valor) =>
          String(valor || '').toLowerCase().includes(texto)
        );
    });
  }, [clientes, busqueda]);

  function actualizarCampo(evento) {
    const { name, value } = evento.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  }

  function limpiar() {
    setFormulario({ ...FORMULARIO_VACIO });
    setEditandoId(null);
    setError('');
    setMensaje('');
  }

  async function guardarCliente(evento) {
    evento.preventDefault();

    if (!puedeGestionar) {
      setError('Tu usuario no tiene permiso para guardar clientes.');
      return;
    }

    const errorValidacion = validarCliente(formulario);

    if (errorValidacion) {
      setError(errorValidacion);
      setMensaje('');
      return;
    }

    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const { data: usuarioData, error: usuarioError } =
        await supabase.auth.getUser();

      if (usuarioError || !usuarioData?.user) {
        throw new Error('Tu sesión ha expirado. Vuelve a iniciar sesión.');
      }

      const datosCliente = {
        nombre_razon_social:
          formulario.nombre_razon_social.trim(),
        tipo_documento:
          formulario.tipo_documento,
        numero_documento:
          formulario.numero_documento.trim() || null,
        telefono:
          formulario.telefono.trim() || null,
        correo:
          formulario.correo.trim() || null,
        direccion:
          formulario.direccion.trim() || null,
      };

      if (editandoId) {
        const { error: actualizarError } = await supabase
          .from('clientes')
          .update(datosCliente)
          .eq('id', editandoId)
          .select('id')
          .single();

        if (actualizarError) {
          throw actualizarError;
        }

        setMensaje('Cliente actualizado correctamente.');
      } else {
        const { error: insertarError } = await supabase
          .from('clientes')
          .insert({
            ...datosCliente,
            creado_por: usuarioData.user.id,
          })
          .select('id')
          .single();

        if (insertarError) {
          throw insertarError;
        }

        setMensaje('Cliente registrado correctamente.');
      }

      setFormulario({ ...FORMULARIO_VACIO });
      setEditandoId(null);

      await cargarClientes();
    } catch (err) {
      console.error('Error al guardar cliente:', err);
      setError(err.message || 'Ocurrió un error al guardar el cliente.');
    } finally {
      setGuardando(false);
    }
  }

  function editarCliente(cliente) {
    if (!puedeGestionar) return;

    setFormulario(limpiarFormulario(cliente));
    setEditandoId(cliente.id);
    setError('');
    setMensaje('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function eliminarCliente(cliente) {
    if (!puedeEliminar) {
      setError('Solo el administrador puede eliminar clientes.');
      return;
    }

    const confirmado = window.confirm(
      `¿Seguro que deseas eliminar a "${cliente.nombre_razon_social}"?`
    );

    if (!confirmado) return;

    setEliminandoId(cliente.id);
    setError('');
    setMensaje('');

    try {
      const { data, error: eliminarError } = await supabase
        .from('clientes')
        .delete()
        .eq('id', cliente.id)
        .select('id');

      if (eliminarError) throw eliminarError;

      if (!data || data.length === 0) {
        throw new Error(
          'No se eliminó el cliente. Verifica los permisos de Supabase.'
        );
      }

      if (editandoId === cliente.id) {
        setFormulario({ ...FORMULARIO_VACIO });
        setEditandoId(null);
      }

      setMensaje('Cliente eliminado correctamente.');
      await cargarClientes();
    } catch (err) {
      console.error('Error al eliminar cliente:', err);
      setError(
        err.message ||
        'No fue posible eliminar el cliente.'
      );
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: FONDO,
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        padding: '28px 18px 60px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: 1250,
          margin: '0 auto',
        }}
      >
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div>
            <div
              style={{
                color: DORADO,
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              QR PIEDRAS
            </div>

            <h1
              style={{
                color: '#ffffff',
                fontSize: 'clamp(28px, 4vw, 42px)',
                margin: '0 0 8px',
              }}
            >
              Gestión de Clientes
            </h1>

            <p
              style={{
                color: '#b7b7b7',
                margin: 0,
              }}
            >
              Sistema de Gestión Empresarial
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (typeof onVolver === 'function') {
                onVolver();
              }
            }}
            style={botonPrincipal}
          >
            ← Volver al Dashboard
          </button>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              padding: 15,
              background: '#3a1f22',
              border: '1px solid #a54851',
              color: '#ffb6bc',
              borderRadius: 10,
              marginBottom: 18,
            }}
          >
            {error}
          </div>
        )}

        {mensaje && (
          <div
            role="status"
            style={{
              padding: 15,
              background: '#173529',
              border: '1px solid #39845e',
              color: '#b8f1cf',
              borderRadius: 10,
              marginBottom: 18,
            }}
          >
            {mensaje}
          </div>
        )}

        {puedeGestionar && (
          <section
            style={{
              background: PANEL,
              border: `1px solid ${BORDE}`,
              borderRadius: 16,
              padding: 24,
              marginBottom: 30,
            }}
          >
            <h2
              style={{
                color: DORADO,
                margin: '0 0 22px',
                fontSize: 23,
              }}
            >
              {editandoId
                ? 'Editar cliente'
                : 'Registrar nuevo cliente'}
            </h2>

            <form onSubmit={guardarCliente}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                }}
              >
                <div>
                  <label style={labelStyle}>
                    Nombre o razón social *
                  </label>

                  <input
                    name="nombre_razon_social"
                    value={formulario.nombre_razon_social}
                    onChange={actualizarCampo}
                    placeholder="Nombre completo o empresa"
                    required
                    maxLength={200}
                    style={campoStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Tipo de documento
                  </label>

                  <select
                    name="tipo_documento"
                    value={formulario.tipo_documento}
                    onChange={actualizarCampo}
                    style={campoStyle}
                  >
                    {TIPOS_DOCUMENTO.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>
                    Número de documento
                  </label>

                  <input
                    name="numero_documento"
                    value={formulario.numero_documento}
                    onChange={actualizarCampo}
                    placeholder="DNI, RUC u otro"
                    maxLength={
                      formulario.tipo_documento === 'DNI'
                        ? 8
                        : formulario.tipo_documento === 'RUC'
                          ? 11
                          : 25
                    }
                    style={campoStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Teléfono
                  </label>

                  <input
                    name="telefono"
                    type="tel"
                    value={formulario.telefono}
                    onChange={actualizarCampo}
                    placeholder="Número de contacto"
                    maxLength={25}
                    style={campoStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Correo electrónico
                  </label>

                  <input
                    name="correo"
                    type="email"
                    value={formulario.correo}
                    onChange={actualizarCampo}
                    placeholder="cliente@correo.com"
                    maxLength={200}
                    style={campoStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Dirección
                  </label>

                  <input
                    name="direccion"
                    value={formulario.direccion}
                    onChange={actualizarCampo}
                    placeholder="Dirección del cliente"
                    maxLength={300}
                    style={campoStyle}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 24,
                }}
              >
                <button
                  type="submit"
                  disabled={guardando}
                  style={{
                    ...botonPrincipal,
                    opacity: guardando ? 0.6 : 1,
                  }}
                >
                  {guardando
                    ? 'Guardando...'
                    : editandoId
                      ? 'Guardar cambios'
                      : 'Registrar cliente'}
                </button>

                <button
                  type="button"
                  onClick={limpiar}
                  style={botonSecundario}
                >
                  {editandoId
                    ? 'Cancelar edición'
                    : 'Limpiar formulario'}
                </button>
              </div>
            </form>
          </section>
        )}

        <section
          style={{
            background: PANEL,
            border: `1px solid ${BORDE}`,
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              marginBottom: 22,
            }}
          >
            <div>
              <h2
                style={{
                  color: DORADO,
                  fontSize: 23,
                  margin: '0 0 8px',
                }}
              >
                Clientes registrados ({clientes.length})
              </h2>

              <p
                style={{
                  color: '#aeb1b8',
                  fontSize: 13,
                  margin: 0,
                }}
              >
                Consulta y administra tu cartera de clientes.
              </p>
            </div>

            <button
              type="button"
              onClick={cargarClientes}
              style={botonSecundario}
              disabled={cargando}
            >
              {cargando ? 'Actualizando...' : '↻ Actualizar'}
            </button>
          </div>

          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, documento, teléfono o correo..."
            aria-label="Buscar clientes"
            style={{
              ...campoStyle,
              maxWidth: 530,
              marginBottom: 22,
            }}
          />

          <div
            style={{
              overflowX: 'auto',
              borderRadius: 10,
              border: '1px solid #35383d',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 850,
                textAlign: 'left',
              }}
            >
              <thead
                style={{
                  background: '#292c32',
                  color: DORADO,
                }}
              >
                <tr>
                  <th style={celdaEncabezado}>
                    Cliente
                  </th>
                  <th style={celdaEncabezado}>
                    Documento
                  </th>
                  <th style={celdaEncabezado}>
                    Teléfono
                  </th>
                  <th style={celdaEncabezado}>
                    Correo
                  </th>
                  <th style={celdaEncabezado}>
                    Dirección
                  </th>
                  <th style={celdaEncabezado}>
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {cargando ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={celdaVacia}
                    >
                      Cargando clientes...
                    </td>
                  </tr>
                ) : clientesFiltrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={celdaVacia}
                    >
                      {busqueda
                        ? 'No se encontraron clientes con esa búsqueda.'
                        : 'Todavía no hay clientes registrados.'}
                    </td>
                  </tr>
                ) : (
                  clientesFiltrados.map((cliente) => (
                    <tr
                      key={cliente.id}
                      style={{
                        borderTop: '1px solid #383b40',
                      }}
                    >
                      <td style={celdaStyle}>
                        <strong>
                          {cliente.nombre_razon_social}
                        </strong>
                      </td>

                      <td style={celdaStyle}>
                        {cliente.tipo_documento || '—'}
                        {cliente.numero_documento
                          ? `: ${cliente.numero_documento}`
                          : ''}
                      </td>

                      <td style={celdaStyle}>
                        {cliente.telefono || '—'}
                      </td>

                      <td style={celdaStyle}>
                        {cliente.correo || '—'}
                      </td>

                      <td style={celdaStyle}>
                        {cliente.direccion || '—'}
                      </td>

                      <td style={celdaStyle}>
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                          }}
                        >
                          {puedeGestionar && (
                            <button
                              type="button"
                              onClick={() => editarCliente(cliente)}
                              style={{
                                ...botonPrincipal,
                                padding: '9px 12px',
                              }}
                            >
                              Editar
                            </button>
                          )}

                          {puedeEliminar && (
                            <button
                              type="button"
                              onClick={() => eliminarCliente(cliente)}
                              disabled={eliminandoId === cliente.id}
                              style={{
                                ...botonSecundario,
                                padding: '9px 12px',
                                color: '#ffb6bc',
                                borderColor: '#a54851',
                              }}
                            >
                              {eliminandoId === cliente.id
                                ? 'Eliminando...'
                                : 'Eliminar'}
                            </button>
                          )}

                          {!puedeGestionar && (
                            <span style={{ color: '#aaa' }}>
                              Solo lectura
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p
            style={{
              color: '#aeb1b8',
              fontSize: 13,
              marginTop: 16,
            }}
          >
            Mostrando {clientesFiltrados.length} de {clientes.length} clientes.
          </p>
        </section>

        <footer
          style={{
            textAlign: 'center',
            color: '#777b82',
            fontSize: 12,
            marginTop: 30,
          }}
        >
          QR PIEDRAS — Sistema de Gestión Empresarial
        </footer>
      </div>
    </main>
  );
}

const labelStyle = {
  display: 'block',
  color: '#e0e0e0',
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 8,
};

const celdaEncabezado = {
  padding: '15px 13px',
  fontSize: 14,
  whiteSpace: 'nowrap',
};

const celdaStyle = {
  padding: '15px 13px',
  fontSize: 13,
  color: '#eeeeee',
  verticalAlign: 'middle',
};

const celdaVacia = {
  padding: 35,
  textAlign: 'center',
  color: '#b8bbc0',
};
