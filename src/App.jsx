import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let activo = true;

    async function cargarSesion() {
      const { data } = await supabase.auth.getSession();
      if (activo) setSession(data.session);
      if (!data.session && activo) setLoading(false);
    }

    cargarSesion();

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
        setSession(nuevaSesion);
        if (!nuevaSesion) {
          setPerfil(null);
          setLoading(false);
        }
      });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;

    let activo = true;

    async function cargarPerfil() {
      setLoading(true);

      const { data, error: perfilError } = await supabase
        .from('perfiles')
        .select('nombre, rol, activo')
        .eq('id', session.user.id)
        .single();

      if (!activo) return;

      if (perfilError || !data || !data.activo) {
        setPerfil(null);
        setError('Usuario sin perfil activo o autorizado.');
      } else {
        setPerfil(data);
        setError('');
      }

      setLoading(false);
    }

    cargarPerfil();

    return () => { activo = false; };
  }, [session?.user?.id]);

  async function login(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (loginError) setError(loginError.message);
    setEnviando(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setPerfil(null);
  }

  if (loading) {
    return <p style={{ padding: 30 }}>Cargando QR Piedras...</p>;
  }

  if (session && perfil) {
    return <Dashboard perfil={perfil} onLogout={logout} />;
  }

  if (session && !perfil) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Acceso no autorizado</h2>
        <p>{error}</p>
        <button onClick={logout}>Cerrar sesión</button>
      </div>
    );
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: '#101114',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <form onSubmit={login} style={{
        width: '90%',
        maxWidth: 380,
        padding: 32,
        background: '#1b1d21',
        border: '1px solid #b89a55',
        borderRadius: 16
      }}>
        <h1 style={{ color: '#d4af67' }}>QR PIEDRAS</h1>
        <p>Sistema de Gestión Empresarial</p>

        <input
          type="email"
          placeholder="Correo electrónico"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Contraseña"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={enviando}
          style={{
            width: '100%',
            padding: 14,
            background: '#d4af67',
            border: 0,
            borderRadius: 8,
            fontWeight: 'bold'
          }}
        >
          {enviando ? 'Ingresando...' : 'Iniciar sesión'}
        </button>

        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 13,
  marginBottom: 18,
  borderRadius: 8
};