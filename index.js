import express from "express";
import { urlencoded } from "body-parser";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(urlencoded({ extended: false }));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

app.post("/webhook", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const mensaje = req.body.Body;
  const telefono = req.body.From;
  console.log("📥 Mensaje recibido de Twilio:", req.body);

  const responder = (texto) => {
    twiml.message(texto);
    res.writeHead(200, { "Content-Type": "text/xml" });
    res.end(twiml.toString());
  };

  const lineas = mensaje.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  console.log("📄 Líneas detectadas:", lineas);

  // Si aún no se ha recibido suficiente información
  if (lineas.length < 3) {
    return responder(
      "¡Hola! 😊 Para hacer una reserva, por favor responde con:\n\n📅 Fecha (ej: 23/08/2025)\n⏰ Hora (ej: 20:00)\n👥 Número de personas (ej: 5 personas)"
    );
  }

  const [fecha, hora, personasLinea] = lineas;

  // Extraer número de personas desde texto como "5 personas"
  const matchPersonas = personasLinea.match(/\d+/);
  const personas = matchPersonas ? parseInt(matchPersonas[0]) : null;

  if (!fecha || !hora || !personas) {
    return responder(
      "No te entendí. Asegúrate de enviar:\n📅 Fecha\n⏰ Hora\n👥 Número de personas"
    );
  }

  const reserva = {
    fecha,
    hora,
    personas,
    telefono_cliente: telefono,
    estado: "pendiente",
  };

  console.log("➡️ Reserva detectada:");
  console.log(reserva);

  const { error } = await supabase.from("reservas").insert([reserva]);

  if (error) {
    console.error("❌ Error al guardar reserva:", error);
    return responder("Hubo un error al registrar tu reserva. Intenta más tarde.");
  }

  responder(
    `✅ Gracias, hemos registrado tu reserva para el ${fecha} a las ${hora} para ${personas} personas. Te confirmaremos en breve.`
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
