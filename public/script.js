const socket = io();

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const qrCodeEl = document.getElementById('qr-code');
  const filePathEl = document.getElementById('file-path');
  const imagePathEl = document.getElementById('image-path');
  const countdownEl = document.getElementById('countdown');

  socket.on('qr', (qrImageUrl) => {
    qrCodeEl.innerHTML = `<img src="${qrImageUrl}" alt="رمز QR">`;
  });

  socket.on('status', (status) => {
    statusEl.innerText = status;
    if (status.includes('انتظار')) {
      let seconds = parseInt(status.match(/\d+/)[0]);
      countdownEl.style.display = 'block';
      let interval = setInterval(() => {
        if (seconds > 0) {
          countdownEl.innerText = `⏳ سيتم إرسال الرسالة بعد ${seconds} ثانية...`;
          seconds--;
        } else {
          clearInterval(interval);
          countdownEl.style.display = 'none';
        }
      }, 1000);
    }
  });

  document.getElementById('login').addEventListener('click', () => {
    socket.emit('login');
  });

  document.getElementById('logout').addEventListener('click', () => {
    socket.emit('logout');
  });

  document.getElementById('excelFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      filePathEl.innerText = file.name;
    }
  });

  document.getElementById('imageFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      imagePathEl.innerText = file.name;
    }
  });

  document.getElementById('sendMessages').addEventListener('click', () => {
    const excelFile = document.getElementById('excelFile').files[0];
    const message = document.getElementById('message').value;
    const imageFile = document.getElementById('imageFile').files[0];

    if (!excelFile) {
      alert('⚠️ يرجى اختيار ملف Excel أولاً!');
      return;
    }

    if (!message.trim() && !imageFile) {
      alert('⚠️ يجب إدخال رسالة أو تحديد صورة على الأقل!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const numbers = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      if (imageFile) {
        const imageReader = new FileReader();
        imageReader.onload = (e) => {
          const imageBase64 = e.target.result;
          socket.emit('send-messages', { numbers, message, imageBase64 });
        };
        imageReader.readAsDataURL(imageFile);
      } else {
        socket.emit('send-messages', { numbers, message });
      }
    };
    reader.readAsArrayBuffer(excelFile);
  });
});