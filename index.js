import express from "express";
import bodyParser from "body-parser";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));


// Variables de entorno
const {
  SUPABASE_URL,
  SUPABASE_KEY,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  EMPLEADO_WHATSAPP
} = process.env;

// Inicializa Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Inicializa Twilio
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

app.post("/webhook", async (req, res) => {
  const from = req.body.From;
  const body = req.body.Body?.trim();
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();

  // Mensaje inicial
  if (!body.toLowerCase().includes("día") && !body.toLowerCase().includes("hora")) {
    twiml.message(
      `☕ ¡Hola! Bienvenido a Jevole Coffee\nPara hacer una reserva, por favor responde con estos tres datos:\n📅 Día\n⏰ Hora\n👥 Número de personas`
    );
    res.writeHead(200, { "Content-Type": "text/xml" });
    return res.end(twiml.toString());
  }

  // Cliente envía solicitud de reserva
  if (body.toLowerCase().includes("día") && body.toLowerCase().includes("hora")) {
    await twilioClient.messages.create({
      from: "whatsapp:+14155238886", // Sandbox de Twilio
      to: EMPLEADO_WHATSAPP,
      body: `📥 Nueva solicitud de reserva:\nCliente: ${from}\nMensaje: "${body}"\n\nResponde "Sí" o "No" seguido del número del cliente.`
    });

    twiml.message("Apuntado. Espera confirmación.");
    res.writeHead(200, { "Content-Type": "text/xml" });
    return res.end(twiml.toString());
  }

  // Empleado responde con Sí o No
  if (from === EMPLEADO_WHATSAPP) {
    const lower = body.toLowerCase();
    const esSi = lower.startsWith("sí") || lower.startsWith("si");
    const esNo = lower.startsWith("no");
    const telefonoCliente = lower.match(/\+34\d{9}/)?.[0]; // busca número +34xxxxxxxxx

    if (!telefonoCliente) {
      twiml.message("❌ No encontré el número del cliente en tu mensaje. Inclúyelo.");
      res.writeHead(200, { "Content-Type": "text/xml" });
      return res.end(twiml.toString());
    }

    if (esSi) {
      // 🚧 Aquí puedes mejorar con parser real
      const { error } = await supabase.from("reservas").insert({
        fecha: "2025-08-22",
        hora: "20:00",
        personas: 5,
        telefono_cliente: telefonoCliente,
        estado: "aceptada",
      });
      if (error) console.error("Error Supabase:", error);
      twiml.message("✅ Reserva confirmada y guardada.");
    } else if (esNo) {
      twiml.message("❌ Reserva rechazada.");
    } else {
      twiml.message("Responde con 'Sí' o 'No' seguido del número del cliente.");
    }

    res.writeHead(200, { "Content-Type": "text/xml" });
    return res.end(twiml.toString());
  }

  twiml.message("No te entendí. Por favor, intenta de nuevo.");
  res.writeHead(200, { "Content-Type": "text/xml" });
  return res.end(twiml.toString());
});

app.get("/", (req, res) => res.send("Jevole bot activo ✅"));

app.listen(3000, () => console.log("Servidor corriendo en puerto 3000"));
