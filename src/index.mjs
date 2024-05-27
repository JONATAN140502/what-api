import express from 'express';
import cors from 'cors';
import whatsapp from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import qrImage from 'qr-image';
import axios from 'axios';

const app = express();
const PORT = 3000; // Puerto en el que se ejecutará el servidor HTTP
app.use(cors());
app.use(express.json());
app.use(express.static('tmp'));

app.listen(PORT, () => {
    console.log(`WhatsApp API running on port ${PORT}`);
});

const client = new whatsapp.Client({
    authStrategy: new whatsapp.LocalAuth({ clientId: 'client-one' }),
    puppeteer: {
        headless: true, // Cambiado a false para ver la interfaz del navegador
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    }
});

client.on('qr', (qr) => {
    generateImage(qr);
    qrcode.generate(qr, { small: true });
});

function generateImage(base64) {
    const publicPath = path.join(process.cwd(), 'public');
    const qrPath = path.join(publicPath, 'qr.svg');
    fs.mkdirSync(publicPath, { recursive: true });

    let qr_svg = qrImage.image(base64, { type: 'svg', margin: 4 });
    qr_svg.pipe(fs.createWriteStream(qrPath));
    console.log(`⚡ QR code generated at ${qrPath}`);
    console.log(`⚡ Recuerda que el QR se actualiza cada minuto ⚡`);
    console.log(`⚡ Actualiza F5 el navegador para mantener el mejor QR⚡`);
}

client.on('ready', () => {
    console.log('¡El cliente está listo!');
});

client.on('authenticated', () => {
    console.log('AUTENTICADO');
    const qrPath = path.join(process.cwd(), 'public', 'qr.html');
    fs.writeFileSync(qrPath, 'Authenticated');
});

client.on('auth_failure', (msg) => {
    console.error('FALLO DE AUTENTICACIÓN', msg);
});

client.on('disconnected', (reason) => {
    console.log('El cliente se ha desconectado', reason);
    const qrPath = path.join(process.cwd(), 'public', 'qr.html');
    fs.writeFileSync(qrPath, 'Disconnected');
});

client.initialize().catch(err => {
    console.error('Error al inicializar el cliente:', err);
});

// Endpoint para enviar mensajes de WhatsApp
app.post('/send-message', (req, res) => {
    const { phone, message } = req.body;

    if (!phone) {
        return res.status(400).json({ error: 'Se requiere el número de teléfono' });
    }
    if (!message) {
        return res.status(400).json({ error: 'Se requiere el mensaje' });
    }

    const chatId = `${phone}@c.us`; // Reemplaza con el número de teléfono al que deseas enviar el mensaje

    client.sendMessage(chatId, message)
        .then(() => {
            console.log('Mensaje enviado con éxito!');
            res.json({ success: true, message: 'Mensaje enviado' });
        })
        .catch((error) => {
            console.error('Error al enviar el mensaje:', error);
            res.status(500).json({ error: 'Error al enviar el mensaje' });
        });
});
app.post('/send-file', async (req, res) => {
    const { phone, fileUrl, newName, message } = req.body;

    if (!phone) {
        return res.status(400).json({ error: 'Se requiere el número de teléfono' });
    }
    if (!fileUrl) {
        return res.status(400).json({ error: 'Se requiere el enlace del archivo' });
    }
    if (!newName) {
        return res.status(400).json({ error: 'Se requiere el nuevo nombre del archivo' });
    }
    if (!message) {
        return res.status(400).json({ error: 'Se requiere el mensaje' });
    }

    try {
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const mimeType = response.headers['content-type'];
        const fileData = response.data;

        const media = new whatsapp.MessageMedia(mimeType, Buffer.from(fileData).toString('base64'), newName);

        const chatId = `${phone}@c.us`;

        client.sendMessage(chatId, media, { caption: message })
            .then(() => {
                console.log('Archivo enviado con éxito!');
                res.json({ success: true, message: 'Archivo enviado' });
            })
            .catch((error) => {
                console.error('Error al enviar el archivo:', error);
                res.status(500).json({ error: 'Error al enviar el archivo' });
            });
    } catch (error) {
        console.error('Error al obtener el archivo:', error);
        res.status(500).json({ error: 'Error al obtener el archivo' });
    }
});
//recoger  imagen
app.get('/qr', (req, res) => {
    const qrPath = path.join(process.cwd(), 'public', 'qr.svg');
    if (fs.existsSync(qrPath)) {
        res.sendFile(qrPath);
    } else {
        res.status(404).send('QR code not found');
    }
});
//mostrar en navegador
app.get('/show-qr', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
        <style>
        #qr-code {
            width: 300px; /* Ajusta el tamaño deseado */
            height: 300px; /* Ajusta el tamaño deseado */
            display: flex;
            justify-content: center;
            align-items: center;
            border: 1px solid #000; /* Opcional: añade un borde para mejor visualización */
            margin: 0 auto; /* Centra el QR code en la página */
        }
        #qr-code img {
            width: 100%;
            height: 100%;
        }
        </style>
            <title>WhatsApp QR Code</title>
        </head>
        <body>
            <h1>Escanea el código QR para iniciar sesión en WhatsApp</h1>
            <div id="qr-code">
                <img src="/qr" alt="QR Code">
            </div>
            <p>Recuerda que el QR se actualiza cada minuto. Recarga la página si el QR ha expirado.</p>
        </body>
        </html>
    `);
});
