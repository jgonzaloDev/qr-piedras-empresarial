
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Dashboard from './pages/Dashboard';

const ROLES_PERMITIDOS = ['administrador', 'vendedor'];

export default function App() {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // 1. Recuperar sesión y escuchar cambios de autenticación
  useEffect(() => {
    let montado = true;

    async function cargarSesion() {
      try {
        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (!montado) return;

        if (sessionError) {
          console.error('Error de sesión:', sessionError);
          setError(sessionError.message);
        }

        setSession(data?.session ?? null);
      } catch (err) {
        if (!montado) return;

        console.error('Error al recuperar sesión:', err);
        setError('No se pudo recuperar la sesión.');
        setLoading(false);
      }
    }

    cargarSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nuevaSesion) => {
        if (!montado) return;

        setSession(nuevaSesion);
      }
    );

    return () => {
      montado = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Consultar perfil del usuario autenticado
  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId) {
      setPerfil(null);
      setLoading(false);
      return;
    }

    let activo = true;

    async function cargarPerfil() {
      setLoading(true);
      setPerfil(null);
      setError('');

      console.log('UID de la sesión:', userId);

      try {
        const { data, error: perfilError } = await supabase
          .from('perfiles')
          .select('id, nombre, rol, activo')
          .eq('id', userId)
          .maybeSingle();

        if (!activo) return;

        console.log('Perfil obtenido:', data);
        console.log('Error de Supabase:', perfilError);

        if (perfilError) {
          setPerfil(null);
          setError(
            `Error al consultar perfil: ${perfilError.message}`
          );
          return;
        }

        if (!data) {
          setPerfil(null);
          setError(
            'No se encontró un perfil accesible para este usuario.'
          );
          return;
        }

        if (data.activo !== true) {
          setPerfil(null);
          setError('Tu perfil se encuentra desactivado.');
          return;
        }

        if (!ROLES_PERMITIDOS.includes(data.rol)) {
          setPerfil(null);
          setError(
            `El rol "${data.rol}" no tiene acceso autorizado.`
          );
          return;
        }

        console.log('Acceso autorizado:', {
          nombre: data.nombre,
          rol: data.rol,
        });

        setPerfil(data);
        setError('');
      } catch (err) {
        if (!activo) return;

        console.error('Error inesperado:', err);
        setPerfil(null);
        setError('Error inesperado al cargar el perfil.');
      } finally {
        if (activo) {
          setLoading(false);
        }
      }
    }

    cargarPerfil();

    return () => {
      activo = false;
    };
  }, [session?.user?.id]);

  // 3. Iniciar sesión
  async function login(e) {
    e.preventDefault();

    if (enviando) return;

    setError('');
    setEnviando(true);

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        console.error('Error de login:', loginError);
        setError(loginError.message);
      } else {
        setPassword('');
      }
    } catch (err) {
      console.error('Error inesperado de login:', err);
      setError('No fue posible iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  }

  // 4. Cerrar sesión
  async function logout() {
    setError('');

    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) {
      console.error('Error al cerrar sesión:', logoutError);
      setError(logoutError.message);
      return;
    }

    setSession(null);
    setPerfil(null);
    setPassword('');
  }

  // 5. Pantalla de carga
  if (loading) {
    return (
      <main style={pantallaStyle}>
        <div style={tarjetaStyle}>
          <h1 style={tituloStyle}>QR PIEDRAS</h1>
          <p style={{ textAlign: 'center' }}>
            Verificando sesión y permisos...
          </p>
        </div>
      </main>
    );
  }

  // 6. Usuario autenticado y autorizado
  if (session && perfil) {
    return (
      <Dashboard
        perfil={perfil}
        onLogout={logout}
      />
    );
  }

  // 7. Usuario autenticado, pero sin autorización
  if (session && !perfil) {
    return (
      <main style={pantallaStyle}>
        <section style={tarjetaStyle}>
          <h1 style={tituloStyle}>QR PIEDRAS</h1>

          <h2 style={{ textAlign: 'center' }}>
            Acceso no autorizado
          </h2>

          <p
            role="alert"
            style={{
              color: '#f2a6a6',
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            {error || 'No se pudo validar tu perfil.'}
          </p>

          <p style={textoSecundarioStyle}>
            Revisa la consola del navegador (F12)
            para consultar el diagnóstico.
          </p>

          <button
            type="button"
            onClick={logout}
            style={botonStyle}
          >
            Cerrar sesión
          </button>
        </section>
      </main>
    );
  }

  // 8. Pantalla de inicio de sesión
  return (
    <main style={pantallaStyle}>
      <form onSubmit={login} style={tarjetaStyle}>
        <h1 style={tituloStyle}>QR PIEDRAS</h1>

        <p
          style={{
            textAlign: 'center',
            color: '#e5e5e5',
            marginBottom: 28,
          }}
        >
          Sistema de Gestión Empresarial
        </p>

        <label htmlFor="email" style={labelStyle}>
          Correo electrónico
        </label>

        <input
          id="email"
          type="email"
          placeholder="correo@empresa.com"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <label htmlFor="password" style={labelStyle}>
          Contraseña
        </label>

        <input
          id="password"
          type="password"
          placeholder="Ingresa tu contraseña"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={enviando}
          style={{
            ...botonStyle,
            opacity: enviando ? 0.7 : 1,
            cursor: enviando ? 'wait' : 'pointer',
          }}
        >
          {enviando ? 'Ingresando...' : 'Iniciar sesión'}
        </button>

        {error && (
          <p
            role="alert"
            style={{
              color: '#f2a6a6',
              textAlign: 'center',
              marginTop: 18,
            }}
          >
            {error}
          </p>
        )}

        <p style={textoSecundarioStyle}>
          Acceso exclusivo para personal autorizado
        </p>
      </form>
    </main>
  );
}

// 9. Estilos visuales
const pantallaStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: '#101114',
  color: '#ffffff',
  fontFamily: 'Arial, sans-serif',
  padding: 20,
  boxSizing: 'border-box',
};

const tarjetaStyle = {
  width: '100%',
  maxWidth: 400,
  boxSizing: 'border-box',
  padding: 32,
  background: '#1b1d21',
  border: '1px solid #b89a55',
  borderRadius: 16,
  boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
};

const tituloStyle = {
  color: '#d4af67',
  textAlign: 'center',
  fontSize: 36,
  margin: '0 0 12px',
  letterSpacing: 1,
};

const labelStyle = {
  display: 'block',
  marginBottom: 8,
  fontSize: 14,
  color: '#e5e5e5',
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 13,
  marginBottom: 18,
  borderRadius: 8,
  border: '1px solid #555',
  background: '#292c31',
  color: '#ffffff',
  fontSize: 15,
  outlineColor: '#d4af67',
};

const botonStyle = {
  width: '100%',
  padding: 14,
  background: '#d4af67',
  color: '#171717',
  border: 0,
  borderRadius: 8,
  fontWeight: 'bold',
  fontSize: 15,
  cursor: 'pointer',
};

const textoSecundarioStyle = {
  textAlign: 'center',
  color: '#a0a0a0',
  fontSize: 12,
  marginTop: 22,
  lineHeight: 1.6,
};
