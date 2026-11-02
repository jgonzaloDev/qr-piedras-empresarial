import { useState } from "react";
import {
  buscarClientePorRuc,
  guardarClienteConsultado,
} from "../services/clientesRuc";

export default function BuscadorRuc({ onSeleccionar }) {
  const [ruc, setRuc] = useState("");
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  async function consultar() {
    setCargando(true);
    setMensaje("");
    setResultado(null);

    try {
      const encontrado = await buscarClientePorRuc(ruc);
      setResultado(encontrado);

      if (encontrado.existe) {
        setMensaje("Cliente encontrado en Supabase.");
        onSeleccionar?.(encontrado.cliente);
      } else {
        setMensaje("RUC consultado. Revisa los datos y guarda.");
      }
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setCargando(false);
    }
  }

  async function guardar() {
    if (!resultado) return;

    setCargando(true);
    setMensaje("");

    try {
      const cliente = await guardarClienteConsultado(resultado.datos);

      setMensaje("Cliente guardado correctamente.");
      setResultado({
        ...resultado,
        existe: true,
        cliente,
      });

      onSeleccionar?.(cliente);
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label>Consultar cliente por RUC</label>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={ruc}
          maxLength={11}
          placeholder="Ingresa 11 dígitos"
          onChange={(e) => {
            setRuc(e.target.value.replace(/\D/g, "").slice(0, 11));
            setResultado(null);
            setMensaje("");
          }}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
          }}
        />

        <button
          type="button"
          onClick={consultar}
          disabled={cargando || ruc.length !== 11}
        >
          {cargando ? "Consultando..." : "Buscar RUC"}
        </button>
      </div>

      {mensaje && <p>{mensaje}</p>}

      {resultado && (
        <div
          style={{
            border: "1px solid #b89445",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <p>
            <strong>Razón social:</strong> {resultado.datos.razon_social}
          </p>

          <p>
            <strong>RUC:</strong> {resultado.datos.ruc}
          </p>

          <p>
            <strong>Dirección:</strong>{" "}
            {resultado.datos.direccion || "No disponible"}
          </p>

          <p>
            <strong>Origen:</strong>{" "}
            {resultado.origen === "supabase"
              ? "Cliente registrado"
              : "Consulta externa"}
          </p>

          {resultado.datos.estado && (
            <p>
              <strong>Estado:</strong> {resultado.datos.estado}
            </p>
          )}

          {!resultado.existe && (
            <button type="button" onClick={guardar} disabled={cargando}>
              Guardar y seleccionar cliente
            </button>
          )}
        </div>
      )}
    </div>
  );
}
