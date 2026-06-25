// api/index.js - Cổng Phân Giải API Thay Đổi Thuật Toán Bóc Tách
const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ success: false, message: "Thiếu tham số url đầu vào." });

    try {
        let formattedUrl = targetUrl;
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
            formattedUrl = 'https://' + formattedUrl;
        }

        // Gọi thẳng sang luồng bọc API phân giải hệ thống đã được mã hóa sẵn chữ ký thiết bị sạch
        // Nó sẽ tự động giải quyết lớp chặn hành vi của cả Platoboost lẫn LootLabs
        const response = await axios.get(`https://bypass.vip{encodeURIComponent(formattedUrl)}`, { 
            timeout: 22000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' }
        });

        if (response.data && response.data.status === "success") {
            const keyResult = response.data.result || response.data.destination || response.data.key || "";
            if (keyResult && keyResult.length > 5 && !keyResult.includes("{")) {
                return res.status(200).json({ success: true, key: keyResult.trim() });
            }
        }

        // Kế hoạch dự phòng ngầm bẫy lỗi sang cổng phụ Uneti Core nếu cổng chính trả về lỗi
        try {
            const backupRes = await axios.get(`https://uneti-bot.xyz{encodeURIComponent(formattedUrl)}`, { timeout: 8000 });
            if (backupRes.data && (backupRes.data.success === true || backupRes.data.status === "success")) {
                const backupKey = backupRes.data.key || backupRes.data.result || backupRes.data.destination || "";
                if (backupKey) {
                    return res.status(200).json({ success: true, key: backupKey.trim() });
                }
            }
        } catch (e) {}

        const errorText = response.data && response.data.message ? response.data.message : "Liên kết đã quá hạn hoặc không đúng phiên.";
        return res.status(200).json({ success: false, message: errorText });

    } catch (error) {
        return res.status(200).json({ success: false, message: `Hệ thống phân giải từ chối bóc tách: ${error.message}` });
    }
};
