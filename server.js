const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const http = require('http');
const { Server } = require('socket.io');
const XLSX = require('xlsx');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let whatsappClient;

io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('login', () => {
    if (!whatsappClient) {
      whatsappClient = new Client({
        authStrategy: new LocalAuth(),
      });

      whatsappClient.on('qr', async (qr) => {
        try {
          const qrImageUrl = await qrcode.toDataURL(qr);
          socket.emit('qr', qrImageUrl);
        } catch (err) {
          console.error('Error generating QR:', err);
          socket.emit('status', '❌ خطأ في توليد رمز QR');
        }
      });

      whatsappClient.on('ready', () => {
        socket.emit('status', '✅ واتساب متصل وجاهز للإرسال!');
      });

      whatsappClient.on('disconnected', (reason) => {
        socket.emit('status', '⚠️ تم فصل الاتصال: ' + reason);
        whatsappClient = null;
      });

      whatsappClient.initialize().catch((err) => {
        console.error('Error initializing WhatsApp:', err);
        socket.emit('status', '❌ فشل في تهيئة واتساب: ' + err.message);
      });
    }
  });

  socket.on('logout', async () => {
    if (whatsappClient) {
      await whatsappClient.logout().catch(err => console.error('Error logging out:', err));
      socket.emit('status', 'ℹ️ تم تسجيل الخروج من واتساب');
      whatsappClient = null;
    }
  });

  socket.on('send-messages', async ({ numbers, message, imageBase64 }) => {
    if (!whatsappClient || !whatsappClient.info) {
      socket.emit('status', '⚠️ واتساب غير متصل. يرجى تسجيل الدخول أولاً.');
      return;
    }

    try {
      socket.emit('status', '🚀 جاري إرسال الرسائل...');
      for (const contact of numbers) {
        let phoneNumber = String(contact.Number).replace(/\D/g, '').trim();
        if (!phoneNumber.startsWith('20')) continue;
        phoneNumber = `${phoneNumber}@c.us`;

        try {
          if (imageBase64) {
            // استخراج نوع MIME والبيانات من Base64
            const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
              throw new Error('Invalid Base64 data');
            }
            const mime = matches[1]; // مثل image/png
            const data = matches[2]; // البيانات المشفرة
            const media = new MessageMedia(mime, data);
            await whatsappClient.sendMessage(phoneNumber, media, { caption: message });
          } else {
            await whatsappClient.sendMessage(phoneNumber, message);
          }
        } catch (error) {
          console.error(`Failed to send to ${phoneNumber}:`, error);
        }

        let delay = Math.floor(Math.random() * (50000 - 10000 + 1)) + 10000;
        for (let i = delay / 1000; i > 0; i--) {
          socket.emit('status', `⏳ انتظار ${i} ثانية قبل الرسالة التالية...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      socket.emit('status', '✅ تم إرسال الرسائل بنجاح!');
    } catch (error) {
      console.error('Error sending messages:', error);
      socket.emit('status', '❌ فشل في إرسال الرسائل: ' + error.message);
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
});