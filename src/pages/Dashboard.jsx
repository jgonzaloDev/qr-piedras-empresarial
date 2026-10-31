import { useState } from "react";

import Ventas from "./Ventas";

import {
  LayoutDashboard,
  Users,
  Boxes,
  FileText,
  ShoppingCart,
  Wallet,
  FileSignature,
  LogOut,
  Menu,
  X,
  ArrowRight,
  ShieldCheck,
  Clock3,
} from "lucide-react";

import Clientes from "./Clientes";
import Cotizaciones from "./Cotizaciones";

const MODULOS = [
  {
    id: "clientes",
    nombre: "Clientes",
    descripcion: "Registro, búsqueda y administración de clientes.",
    icono: Users,
    disponible: true,
  },
  {
    id: "materiales",
    nombre: "Materiales",
    descripcion: "Catálogo, precios y control de materiales.",
    icono: Boxes,
    disponible: false,
  },
  {
    id: "cotizaciones",
    nombre: "Cotizaciones",
    descripcion: "Elaboración y seguimiento de cotizaciones.",
    icono: FileText,
    disponible: true,
  },
  {
    id: "ventas",
    nombre: "Ventas",
    descripcion: "Registro y seguimiento de operaciones.",
    icono: ShoppingCart,
    disponible: true,
  },
  {
    id: "pagos",
    nombre: "Pagos",
    descripcion: "Control de pagos, adelantos y saldos.",
    icono: Wallet,
    disponible: false,
  },
  {
    id: "contratos",
    nombre: "Contratos",
    descripcion: "Gestión de acuerdos comerciales.",
    icono: FileSignature,
    disponible: false,
  },
];

const COLORES = {
  fondo: "#101114",
  panel: "#1b1d21",
  panelClaro: "#22252b",
  dorado: "#d4af67",
  doradoSuave: "#b89a55",
  blanco: "#f5f5f5",
  secundario: "#aeb1b8",
  borde: "#39342b",
};

export default function Dashboard({ perfil, onLogout }) {
  const [modulo, setModulo] = useState("inicio");
  const [menuAbierto, setMenuAbierto] = useState(false);

  const nombre = perfil?.nombre || "Usuario";
  const rol = perfil?.rol || "Sin rol";

  function navegar(destino) {
    setModulo(destino);
    setMenuAbierto(false);
  }

  if (modulo === "clientes") {
    return <Clientes perfil={perfil} onVolver={() => navegar("inicio")} />;
  }

  if (modulo === "cotizaciones") {
    return <Cotizaciones perfil={perfil} onVolver={() => navegar("inicio")} />;
  }

  if (modulo === "ventas") {
    return <Ventas onVolver={() => navegar("inicio")} />;
  }

  const moduloActual = MODULOS.find((item) => item.id === modulo);

  const estiloBotonMenu = (activo) => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "13px 15px",
    border: activo
      ? "1px solid rgba(212,175,103,0.35)"
      : "1px solid transparent",
    borderRadius: 10,
    background: activo ? "rgba(212,175,103,0.12)" : "transparent",
    color: activo ? COLORES.dorado : COLORES.secundario,
    fontSize: 14,
    fontWeight: activo ? 700 : 500,
    textAlign: "left",
    cursor: "pointer",
  });

  return (
    <div className="qr-dashboard">
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        .qr-dashboard {
          min-height: 100vh;
          display: flex;
          background: ${COLORES.fondo};
          color: ${COLORES.blanco};
          font-family: Arial, Helvetica, sans-serif;
        }

        .qr-sidebar {
          width: 265px;
          min-width: 265px;
          min-height: 100vh;
          background: ${COLORES.panel};
          border-right: 1px solid ${COLORES.borde};
          padding: 28px 18px;
          display: flex;
          flex-direction: column;
          gap: 25px;
        }

        .qr-logo {
          padding: 10px 12px 20px;
          border-bottom: 1px solid ${COLORES.borde};
        }

        .qr-logo h1 {
          margin: 0;
          color: ${COLORES.dorado};
          font-size: 25px;
          letter-spacing: 1px;
        }

        .qr-logo p {
          margin: 8px 0 0;
          color: ${COLORES.secundario};
          font-size: 12px;
          line-height: 1.6;
        }

        .qr-menu-label {
          color: #777b84;
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 1.5px;
          padding: 0 14px;
          margin-bottom: 12px;
        }

        .qr-menu-items {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .qr-main {
          flex: 1;
          min-width: 0;
          padding: 30px 36px;
        }

        .qr-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding-bottom: 25px;
          border-bottom: 1px solid ${COLORES.borde};
        }

        .qr-topbar h2 {
          font-size: 22px;
          margin: 0 0 7px;
          color: ${COLORES.blanco};
        }

        .qr-topbar p {
          margin: 0;
          color: ${COLORES.secundario};
          font-size: 13px;
        }

        .qr-user {
          display: flex;
          align-items: center;
          gap: 13px;
          background: ${COLORES.panel};
          padding: 10px 15px;
          border: 1px solid ${COLORES.borde};
          border-radius: 12px;
        }

        .qr-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(212,175,103,0.15);
          color: ${COLORES.dorado};
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          flex-shrink: 0;
        }

        .qr-welcome {
          padding: 36px 0 28px;
        }

        .qr-welcome h2 {
          margin: 0 0 10px;
          font-size: clamp(24px, 3vw, 34px);
          color: ${COLORES.blanco};
        }

        .qr-welcome h2 span {
          color: ${COLORES.dorado};
        }

        .qr-welcome p {
          margin: 0;
          color: ${COLORES.secundario};
          line-height: 1.7;
        }

        .qr-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 34px;
        }

        .qr-summary-card {
          background: ${COLORES.panel};
          border: 1px solid ${COLORES.borde};
          border-radius: 14px;
          padding: 22px;
        }

        .qr-summary-card p {
          margin: 0 0 12px;
          color: ${COLORES.secundario};
          font-size: 13px;
        }

        .qr-summary-card strong {
          font-size: 22px;
          color: ${COLORES.blanco};
        }

        .qr-section-title {
          font-size: 19px;
          font-weight: 700;
          margin-bottom: 20px;
          color: ${COLORES.blanco};
        }

        .qr-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .qr-module {
          background: ${COLORES.panel};
          border: 1px solid ${COLORES.borde};
          border-radius: 15px;
          padding: 25px;
          text-align: left;
          color: ${COLORES.blanco};
          min-height: 210px;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: 0.2s ease;
          font: inherit;
        }

        .qr-module:hover:not(:disabled) {
          border-color: ${COLORES.dorado};
          transform: translateY(-3px);
          background: ${COLORES.panelClaro};
        }

        .qr-module:disabled {
          cursor: default;
          opacity: 0.7;
        }

        .qr-module-icon {
          width: 48px;
          height: 48px;
          background: rgba(212,175,103,0.12);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${COLORES.dorado};
          margin-bottom: 20px;
        }

        .qr-module h3 {
          margin: 0 0 9px;
          font-size: 18px;
          color: ${COLORES.blanco};
        }

        .qr-module p {
          margin: 0;
          color: ${COLORES.secundario};
          font-size: 13px;
          line-height: 1.6;
        }

        .qr-module-footer {
          margin-top: auto;
          padding-top: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: ${COLORES.dorado};
        }

        .qr-logout {
          margin-top: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 13px;
          background: transparent;
          border: 1px solid ${COLORES.borde};
          border-radius: 10px;
          color: #e6a0a0;
          cursor: pointer;
          font-weight: 600;
        }

        .qr-mobile-menu {
          display: none;
          border: 1px solid ${COLORES.borde};
          background: ${COLORES.panel};
          color: ${COLORES.dorado};
          border-radius: 8px;
          padding: 9px;
          cursor: pointer;
        }

        .qr-overlay {
          display: none;
        }

        @media (max-width: 1100px) {
          .qr-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 800px) {
          .qr-sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            z-index: 30;
            transform: translateX(-100%);
            transition: transform 0.2s ease;
            overflow-y: auto;
          }

          .qr-sidebar.open {
            transform: translateX(0);
          }

          .qr-overlay.open {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.65);
            z-index: 20;
          }

          .qr-mobile-menu {
            display: inline-flex;
          }

          .qr-main {
            padding: 18px;
          }

          .qr-summary {
            grid-template-columns: 1fr;
          }

          .qr-topbar {
            flex-wrap: wrap;
          }
        }

        @media (max-width: 520px) {
          .qr-grid {
            grid-template-columns: 1fr;
          }

          .qr-user {
            width: 100%;
          }
        }
      `}</style>

      <div
        className={`qr-overlay ${menuAbierto ? "open" : ""}`}
        onClick={() => setMenuAbierto(false)}
      />

      <aside className={`qr-sidebar ${menuAbierto ? "open" : ""}`}>
        <div className="qr-logo">
          <h1>QR PIEDRAS</h1>
          <p>Sistema de Gestión Empresarial</p>
        </div>

        <nav aria-label="Menú principal">
          <div className="qr-menu-label">NAVEGACIÓN</div>

          <div className="qr-menu-items">
            <button
              style={estiloBotonMenu(modulo === "inicio")}
              onClick={() => navegar("inicio")}
            >
              <LayoutDashboard size={19} />
              Panel principal
            </button>

            {MODULOS.map((item) => {
              const Icono = item.icono;

              return (
                <button
                  key={item.id}
                  style={{
                    ...estiloBotonMenu(modulo === item.id),
                    opacity: item.disponible ? 1 : 0.55,
                    cursor: item.disponible ? "pointer" : "not-allowed",
                  }}
                  onClick={() => navegar(item.id)}
                  disabled={!item.disponible}
                  title={
                    item.disponible
                      ? `Abrir ${item.nombre}`
                      : "Módulo en desarrollo"
                  }
                >
                  <Icono size={19} />
                  {item.nombre}
                </button>
              );
            })}
          </div>
        </nav>

        <button className="qr-logout" onClick={onLogout}>
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </aside>

      <main className="qr-main">
        <header className="qr-topbar">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <button
              className="qr-mobile-menu"
              onClick={() => setMenuAbierto(!menuAbierto)}
              aria-label="Abrir menú"
            >
              {menuAbierto ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div>
              <h2>Panel de administración</h2>
              <p>QR PIEDRAS / Inicio</p>
            </div>
          </div>

          <div className="qr-user">
            <div className="qr-avatar">{nombre.charAt(0).toUpperCase()}</div>

            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {nombre}
              </div>

              <div
                style={{
                  color: COLORES.dorado,
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {rol}
              </div>
            </div>

            <ShieldCheck size={20} color={COLORES.dorado} />
          </div>
        </header>

        {modulo === "inicio" ? (
          <>
            <section className="qr-welcome">
              <h2>
                Bienvenido, <span>{nombre}</span>
              </h2>

              <p>
                Administra las operaciones comerciales de QR PIEDRAS desde un
                solo lugar.
              </p>
            </section>

            <section className="qr-summary">
              <div className="qr-summary-card">
                <p>Módulos del sistema</p>
                <strong>{MODULOS.length}</strong>
              </div>

              <div className="qr-summary-card">
                <p>Módulos disponibles</p>
                <strong>{MODULOS.filter((m) => m.disponible).length}</strong>
              </div>

              <div className="qr-summary-card">
                <p>Estado de la sesión</p>
                <strong
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#8cdda5",
                    fontSize: 18,
                  }}
                >
                  <ShieldCheck size={20} />
                  Autenticado
                </strong>
              </div>
            </section>

            <section>
              <h2 className="qr-section-title">Módulos empresariales</h2>

              <div className="qr-grid">
                {MODULOS.map((item) => {
                  const Icono = item.icono;

                  return (
                    <button
                      key={item.id}
                      className="qr-module"
                      onClick={() => navegar(item.id)}
                      disabled={!item.disponible}
                    >
                      <div className="qr-module-icon">
                        <Icono size={24} />
                      </div>

                      <h3>{item.nombre}</h3>
                      <p>{item.descripcion}</p>

                      <div className="qr-module-footer">
                        <span>
                          {item.disponible ? "Disponible" : "Próximamente"}
                        </span>

                        {item.disponible ? (
                          <ArrowRight size={18} />
                        ) : (
                          <Clock3 size={17} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <section className="qr-welcome">
            <h2>{moduloActual?.nombre || "Módulo"}</h2>
            <p>Este módulo estará disponible próximamente.</p>
          </section>
        )}
      </main>
    </div>
  );
}
