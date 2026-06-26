# 🏡 Smart Home Dashboard

Hệ thống nhà thông minh sử dụng **ESP32 + Node.js + Socket.IO**, có thể điều khiển từ xa qua internet.

## 📁 Cấu trúc

```
├── server.js       # Backend Node.js + Socket.IO
├── index.html      # Giao diện web dashboard
├── package.json    # Cấu hình npm
└── SmartHome_ESP32/
    └── SmartHome_ESP32.ino   # Firmware ESP32 (Arduino)
```

## 🚀 Chạy local

```bash
npm install
npm start
```

Mở trình duyệt tại `http://localhost:3000`

## ☁️ Deploy lên Render

1. Đẩy code lên GitHub
2. Tạo Web Service trên [render.com](https://render.com)
3. Build Command: `npm install`
4. Start Command: `npm start`

## 📡 Cấu hình ESP32

Sau khi deploy Render xong, cập nhật trong file `.ino`:

```cpp
const char* SERVER_HOST = "ten-app-cua-ban.onrender.com";
const int   SERVER_PORT = 443;  // HTTPS/WSS
```

Và thêm dòng này vào `socketIO.begin(...)`:

```cpp
socketIO.beginSSL(SERVER_HOST, SERVER_PORT, "/socket.io/?EIO=4");
```

## 🔧 Các thiết bị hỗ trợ

- **Relay/Công tắc**: Đèn, quạt, điều hòa, máy bơm
- **Cảm biến**: DHT22 (nhiệt độ/độ ẩm), MQ-2 (khí gas)
- **RFID RC522**: Khóa cửa tự động
- **Servo**: Điều khiển cửa
