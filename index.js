import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const EMPLEADO_WHATSAPP = 'whatsapp:+34XXXXXXXXX'; // Número del empleado autorizado

function formatearFecha(fechaStr) {
  const [dd, mm, yyyy] = fechaStr.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

// Estado en memoria para simplificar (puedes usar DB para producción)
const reservasPendientes = new Map();

app.post('/webhook', async (req, res) => {
  const messageRaw = req.body.Body?.trim();
  const message = messageRaw?.toLowerCase() || '';
  const from = req.body.From;

  console.log('Mensaje recibido:', messageRaw, 'Desde:', from);

  // Si el mensaje viene del empleado y es respuesta para aceptar/rechazar
  if (from === EMPLEADO_WHATSAPP) {
    if (message === 'si' || message === 'no') {
      const reserva = reservasPendientes.get('ultima');
      if (!reserva) {
        return res.send('<Response><Message>No hay reservas pendientes para confirmar.</Message></Response>');
      }
      reservasPendientes.delete('ultima');

      if (message === 'si') {
        try {
          const { error } = await supabase.from('reservas').insert([reserva]);
          if (error) throw error;

          await twilioClient.messages.create({
            from: process.env.TWILIO_WHATSAPP_NUMBER,
            to: reserva.telefono_cliente,
            body: `✅ Tu reserva para el ${reserva.fecha} a las ${reserva.hora} para ${reserva.personas} personas ha sido confirmada. ¡Gracias!`,
          });

          return res.send('<Response><Message>Reserva aceptada y cliente notificado.</Message></Response>');
        } catch (e) {
          console.error('Error guardando reserva:', e);
          return res.send('<Response><Message>Error al guardar la reserva.</Message></Response>');
        }
      } else {
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: reserva.telefono_cliente,
          body: `❌ Lo sentimos, tu reserva para el ${reserva.fecha} a las ${reserva.hora} para ${reserva.personas} personas fue rechazada.`,
        });
        return res.send('<Response><Message>Reserva rechazada y cliente notificado.</Message></Response>');
      }
    }
    return res.send('<Response><Message>Responde con "Si" para aceptar o "No" para rechazar la reserva.</Message></Response>');
  }

  // Si el mensaje viene del cliente y tiene formato de reserva
  const regex = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+(\d+)\s+personas?/i;
  const match = messageRaw.match(regex);

  if (match) {
    const [, fecha, hora, personas] = match;
    const reserva = {
      fecha: formatearFecha(fecha),
      hora,
      personas: parseInt(personas),
      telefono_cliente: from,
      estado: 'pendiente',
    };

    reservasPendientes.set('ultima', reserva);

    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: EMPLEADO_WHATSAPP,
      body: `Nueva reserva pendiente:\nFecha: ${fecha}\nHora: ${hora}\nPersonas: ${personas}\nResponde "Si" para aceptar o "No" para rechazar.`,
    });

    return res.send('<Response><Message>Gracias por tu reserva. Un empleado la revisará y te confirmará pronto.</Message></Response>');
  }

  // Mensaje no reconocido o primer contacto - mensaje de bienvenida
  const bienvenida = `☕ ¡Hola! Bienvenido a Jevole Coffee\n
Para hacer una reserva, por favor responde con estos tres datos separados por espacios:\n
📅 Día (DD/MM/YYYY)\n⏰ Hora (HH:mm)\n👥 Número de personas\n
Ejemplo:\n23/08/2025 20:00 5 personas`;

  return res.send(`<Response><Message>${bienvenida}</Message></Response>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
