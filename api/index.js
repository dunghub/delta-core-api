// api/index.js - Bản Ép Luồng Phân Giải Cấp Cao Chống Block IP Proxy
const axios = require('axios');
const cheerio = require('cheerio');
const CryptoJS = require('crypto-js');

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

        // TỰ ĐỘNG ĐIỀU HƯỚNG SANG CỔNG ĐÁM MÂY GIẢI MÃ SẠCH (Ép Chữ Ký Trình Duyệt Ngầm)
        // Cổng này sẽ lo phần vượt Cloudflare Turnstile ẩn của Platoboost/LootLabs thay cho proxy của bạn
        const bypassGatewayUrl = `https://bypass.vip{encodeURIComponent(formattedUrl)}`;
        
        const response = await axios.get(bypassGatewayUrl, { 
            timeout: 25000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
            }
        });

        // Xử lý dữ liệu trả về từ cổng bẻ khóa thông minh
        if (response.data && response.data.status === "success") {
            const extractedKey = response.data.result || response.data.destination || response.data.key || "";
            
            if (extractedKey && extractedKey.length > 5 && !extractedKey.includes("{")) {
                return res.status(200).json({ 
                    success: true, 
                    key: extractedKey.trim() 
                });
            }
        }

        // Bẫy thông báo lỗi chi tiết từ hệ thống phân giải
        const serverMsg = response.data && response.data.message ? response.data.message : "Liên kết đã hết hạn hoặc phiên làm việc bị sập.";
        return res.status(200).json({ success: false, message: serverMsg });

    } catch (error) {
        console.error(`[Lỗi API Luồng] ${error.message}`);
        
        // Đoạn code cứu cánh cuối cùng nếu cổng đám mây chính bị nghẽn (Gửi sang cổng dự phòng phụ)
        try {
            const backupUrl = `https://uneti-bot.xyz{encodeURIComponent(targetUrl)}`;
            const backupRes = await axios.get(backupUrl, { timeout: 10000 });
            
            if (backupRes.data && (backupRes.data.success === true || backupRes.data.status === "success")) {
                const backupKey = backupRes.data.key || backupRes.data.result || backupRes.data.destination || "";
                if (backupKey) {
                    return res.status(200).json({ success: true, key: backupKey.trim() });
                }
            }
        } catch (backupErr) {
            // Chấp nhận lỗi nếu cả hai cổng mạng cùng sập
        }

        return res.status(200).json({ 
            success: false, 
            message: `Tường lửa chặn kết nối: ${error.message}. Hãy gõ lại lệnh sau vài giây!` 
        });
    }
};
