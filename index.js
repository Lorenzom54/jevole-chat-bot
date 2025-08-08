import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Conexión a Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.post('/webhook', async (req, res) => {
  const messageBody = req.body.Body?.trim();
  const from = req.body.From;

  console.log('📩 Mensaje recibido:', messageBody);
  console.log('📞 Desde:', from);

  if (!messageBody) {
    return res.send('<Response><Message>No se recibió ningún mensaje válido.</Message></Response>');
  }

  // Verificar si el mensaje contiene una reserva: fecha, hora y número de personas
  const regex = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+(\d+)\s+personas?/i;
  const match = messageBody.match(regex);

  if (match) {
    const [, fecha, hora, personas] = match;
    const telefono_cliente = from;

    try {
      const { data, error } = await supabase.from('reservas').insert([
        {
          fecha,
          hora,
          personas: parseInt(personas),
          telefono_cliente,
          estado: 'pendiente',
        },
      ]);

      if (error) throw error;

      console.log('✅ Reserva registrada:', data);

      return res.send(`
        <Response>
          <Message>Reserva recibida para el ${fecha} a las ${hora} para ${personas} personas. Un empleado la confirmará pronto.</Message>
        </Response>
      `);
    } catch (err) {
      console.error('❌ Error al guardar la reserva:', err.message);
      return res.send('<Response><Message>Ocurrió un error al registrar la reserva. Inténtalo más tarde.</Message></Response>');
    }
  } else {
    // Si el mensaje no tiene formato válido
    return res.send('<Response><Message>No te entendí. Por favor, escribe el mensaje así: 23/08/2025 20:00 5 personas</Message></Response>');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
