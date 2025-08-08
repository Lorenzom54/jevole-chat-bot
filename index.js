// index.js
import express from "express";
import 'dotenv/config';
import pkg from "body-parser";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";


// Cargar variables del archivo .env
config();

const { urlencoded } = pkg;
const app = express();
app.use(urlencoded({ extended: false }));

// Inicializar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_KEY en .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Mensaje de bienvenida inicial
const MENSAJE_BIENVENIDA =
  "Hola 👋 Gracias por contactar con Jevole Coffee.\n\nPara reservar una mesa, por favor responde con:\n\n📅 Fecha (dd/mm/aaaa)\n⏰ Hora (hh:mm)\n👥 Nº de personas\n\nEjemplo:\n23/08/2025\n20:00\n4 personas";

app.post("/whatsapp", async (req, res) => {
  const mensaje = req.body.Body || "";
  const telefono = req.body.From || "";
  const lineas = mensaje.split("\n").map((l) => l.trim()).filter(Boolean);

  console.log("📥 Mensaje recibido de Twilio:", req.body);
  console.log("📄 Líneas detectadas:", lineas);

  if (lineas.length === 3) {
    const [fecha, hora, personasRaw] = lineas;
    const personas = personasRaw.match(/\d+/)?.[0]; // Extrae número

    if (personas && fecha.match(/\d{2}\/\d{2}\/\d{4}/) && hora.match(/\d{2}:\d{2}/)) {
      const { error } = await supabase.from("reservas").insert([
        {
          fecha,
          hora,
          personas,
          telefono_cliente: telefono,
          estado: "pendiente",
        },
      ]);

      if (error) {
        console.error("❌ Error al guardar en Supabase:", error);
        return res.send("Hubo un problema al guardar tu reserva. Intenta más tarde.");
      }

      console.log("✅ Reserva guardada correctamente");
      return res.send(
        `✅ Hemos recibido tu solicitud de reserva para el ${fecha} a las ${hora} para ${personas} personas.\n\nUn miembro del equipo te confirmará en breve.`
      );
    }
  }

  // Si no reconoce el formato
  return res.send(MENSAJE_BIENVENIDA);
});

// Puerto dinámico para Render o 3000 local
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
