import { supabase } from '../lib/supabase';

const modulos = [
  'Clientes',
  'Materiales',
  'Cotizaciones',
  'Ventas',
  'Pagos',
  'Contratos'
];

export default function Dashboard({ perfil, onLogout }) {
  async function cerrarSesion() {
    await supabase.auth.signOut();
    onLogout();
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#111317',
      color: 'white',
      padding: 32,
      fontFamily: 'Arial, sans-serif'
    }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <h1 style={{ color: '#d4af67' }}>
            QR PIEDRAS
          </h1>
          <p>Sistema de Gestión Empresarial</p>
        </div>

        <button onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </header>

      <h2>Bienvenido, {perfil?.nombre || 'Usuario'}</h2>
      <p>Rol: {perfil?.rol || 'Sin asignar'}</p>

      <section style={{
        display: 'grid',
        gridTemplateColumns:
          'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 20,
        marginTop: 30
      }}>
        {modulos.map(modulo => (
          <article key={modulo} style={{
            padding: 28,
            borderRadius: 14,
            background: '#202329',
            border: '1px solid #b89a55'
          }}>
            <h3>{modulo}</h3>
            <p style={{ color: '#aaa' }}>
              Módulo en desarrollo
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}