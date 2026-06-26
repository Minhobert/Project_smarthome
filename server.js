// =====================================================
// SERVER NHÀ THÔNG MINH - Node.js + Socket.IO
// Hỗ trợ tự động phát hiện và quản lý thiết bị động
// =====================================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000
});

// --- CẤU HÌNH BẮN THÔNG BÁO PUSH (ONESIGNAL) ---
const ONESIGNAL_APP_ID = "69a85641-a471-4e92-bd71-e672eedf95fd";
const ONESIGNAL_API_KEY = "os_v2_app_ngufmqneofhjfplr4zzo5x4v7u3da76rbdvuunvbnvhxhju3ynvl6qeyygy5xzpl6vqly7bws4zmi3jwcz3l5zbuwqtpnyeajugkila";

function sendPushNotification(title, message) {
    if (!ONESIGNAL_APP_ID) return;
    fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": "Basic " + ONESIGNAL_API_KEY
        },
        body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            included_segments: ["Subscribed Users"],
            headings: { "en": title },
            contents: { "en": message }
        })
    }).catch(err => console.log('Lỗi Push:', err));
}

// --- Lưu trữ trạng thái toàn bộ thiết bị ---
let danhSachThietBi = {};
let nhatKySuKien = [];

function ghiLog(loai, noi_dung) {
    const entry = { loai, noi_dung, thoiGian: new Date().toLocaleTimeString('vi-VN') };
    nhatKySuKien.unshift(entry);
    if (nhatKySuKien.length > 50) nhatKySuKien.pop();
    io.emit('log_event', entry);
    console.log(`[${entry.thoiGian}][${loai}] ${noi_dung}`);
}

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/api/devices', (req, res) => { res.json(Object.values(danhSachThietBi)); });
app.get('/health', (req, res) => { res.json({ status: 'ok', devices: Object.keys(danhSachThietBi).length }); });

// =====================================================
// XỬ LÝ KẾT NỐI SOCKET.IO
// =====================================================
io.on('connection', (socket) => {
    const clientIP = socket.handshake.address;
    ghiLog('KẾT NỐI', `Client mới: ${socket.id} từ ${clientIP}`);

    socket.emit('current_devices', Object.values(danhSachThietBi));
    socket.emit('log_history', nhatKySuKien);

    socket.on('register_device', (data) => {
        if (!data || !data.id) return;
        const isNew = !danhSachThietBi[data.id];
        if (!isNew) data = { ...data, ...danhSachThietBi[data.id], ...data };

        danhSachThietBi[data.id] = {
            id: data.id,
            ten_hien_thi: data.ten_hien_thi || 'Chưa xác định',
            loai_thiet_bi: data.loai_thiet_bi || 'cong_tac',
            don_vi: data.don_vi || '',
            trang_thai: data.trang_thai !== undefined ? data.trang_thai : 'OFF',
            trang_thai_cau_hinh: data.trang_thai_cau_hinh || 'unconfigured',
            lan_cuoi_cap_nhat: new Date().toISOString()
        };

        io.emit('device_registered', danhSachThietBi[data.id]);
        if (isNew) ghiLog('THIẾT BỊ', `Phát hiện thiết bị mới: ${data.id}`);
        else ghiLog('THIẾT BỊ', `Thiết bị kết nối lại: ${data.ten_hien_thi || data.id}`);
    });

    socket.on('setup_new_device', (data) => {
        if (!data || !danhSachThietBi[data.id]) return;
        danhSachThietBi[data.id].ten_hien_thi = data.ten;
        danhSachThietBi[data.id].loai_thiet_bi = data.loai || danhSachThietBi[data.id].loai_thiet_bi;
        danhSachThietBi[data.id].trang_thai_cau_hinh = 'configured';
        io.emit('save_config_to_hardware', data);
        io.emit('device_configured_success', danhSachThietBi[data.id]);
        ghiLog('CẤU HÌNH', `Đã đặt tên thiết bị [${data.id}] → "${data.ten}"`);
    });

    socket.on('update_state', (data) => {
        if (!data || !data.id) return;
        if (danhSachThietBi[data.id]) {
            danhSachThietBi[data.id].trang_thai = data.value;
            danhSachThietBi[data.id].lan_cuoi_cap_nhat = new Date().toISOString();
        }
        io.emit('state_changed', data);
    });

    socket.on('control_device', (data) => {
        if (!data || !data.id) return;
        ghiLog('ĐIỀU KHIỂN', `Lệnh [${data.command}] → thiết bị [${data.id}]`);
        io.emit('device_command', data);
    });

    socket.on('delete_device', (data) => {
        if (!data || !danhSachThietBi[data.id]) return;
        const ten = danhSachThietBi[data.id].ten_hien_thi;
        delete danhSachThietBi[data.id];
        io.emit('device_deleted', { id: data.id });
        ghiLog('XÓA', `Đã xóa thiết bị: ${ten} (${data.id})`);
    });

    // -------------------------------------------------------
    // Nhận cảnh báo nguy hiểm từ ESP32
    // -------------------------------------------------------
    socket.on('trigger_alert', (data) => {
        if (!data) return;
        ghiLog('CẢNH BÁO ⚠️', `[${data.type}] ${data.message}`);
        
        // Bắn thông báo rung điện thoại
        sendPushNotification(`🚨 CẢNH BÁO: ${data.type}`, data.message);
        
        // Phát báo động ra các màn hình Web đang mở
        io.emit('alert_broadcast', data);
    });

    socket.on('disconnect', () => { ghiLog('NGẮT KẾT NỐI', `Client: ${socket.id}`); });
});

const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
    setInterval(() => {
        const url = `${RENDER_URL}/health`;
        fetch(url).catch(() => {});
        console.log(`[KEEP-ALIVE] Ping ${url}`);
    }, 14 * 60 * 1000); 
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Máy chủ Nhà Thông Minh đang chạy!`);
});