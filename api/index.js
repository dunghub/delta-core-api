// api/index.js - Cổng phân giải API riêng chạy trên Vercel Serverless Function
const axios = require('axios');
const cheerio = require('cheerio');
const CryptoJS = require('crypto-js');

/**
 * Hàm sinh chuỗi ngẫu nhiên giúp ép Proxy dân cư giữ nguyên 1 địa chỉ IP duy nhất suốt luồng chạy
 */
function generateSessionId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Handler chính xử lý Request API theo tiêu chuẩn Vercel Serverless
module.exports = async (req, res) => {
    // Cho phép gọi API từ mọi nguồn (Tránh lỗi CORS nếu gọi từ trình duyệt)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Lấy tham số ?url= từ request bot gửi sang
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ success: false, message: "Thiếu tham số đường dẫn (url)." });
    }

    const sessionId = generateSessionId();

    // ==========================================================
    // ⚙️ CẤU HÌNH TÀI KHOẢN PROXY DÂN CƯ CỦA BẠN TẠI ĐÂY
    // ==========================================================
    const proxyConfig = {
        protocol: 'http',
        host: 'THAY_IP_HOAC_HOST_PROXY_CUA_BAN', // Ví dụ: pr.ox_y_ho_st.com
        port: 8000,                            // Số cổng Port proxy của bạn
        auth: {
            username: `THAY_USER_PROXY_CUA_BAN-session-${sessionId}`, // Ép giữ IP bằng đuôi -session-
            password: 'THAY_PASSWORD_PROXY_CUA_BAN'                  // Mật khẩu proxy của bạn
        }
    };

    // Khởi tạo Client Axios dùng chung để thừa hưởng Cookie và IP cố định trong luồng
    const botAgent = axios.create({
        proxy: proxyConfig,
        timeout: 25000, // Khớp với thời gian chờ tối đa 30s của bot Discord
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Cache-Control': 'max-age=0'
        }
    });

    try {
        // ==========================================================
        // BƯỚC 1: Truy cập link gốc của người dùng gửi để lấy Token phiên chạy
        // ==========================================================
        const responseStep1 = await botAgent.get(targetUrl);
        const $ = cheerio.load(responseStep1.data);
        
        let targetToken = "";
        const urlParams = new URLSearchParams(new URL(targetUrl).search);
        if (urlParams.has('id')) targetToken = urlParams.get('id');
        if (urlParams.has('token')) targetToken = urlParams.get('token');

        if (!targetToken) {
            targetToken = $('input[name="token"]').val() || $('input[id="token"]').val() || "";
        }

        if (!targetToken) {
            return res.status(400).json({ 
                success: false, 
                message: "Tường lửa đã làm mới Token bảo mật. Vui lòng lấy link mới tinh từ game!" 
            });
        }

        // ==========================================================
        // BƯỚC 2: Gửi gói tin POST xác thực mở khóa (Đi tiếp bằng IP của Bước 1)
        // ==========================================================
        const responseStep2 = await botAgent.post('https://platoboost.com', {
            token: targetToken,
            type: "delta"
        });

        if (!responseStep2.data || !responseStep2.data.success) {
            return res.status(403).json({ 
                success: false, 
                message: "Cổng API Platoboost từ chối xác thực gói tin (Sai chữ ký/Hành vi bot)." 
            });
        }

        // ==========================================================
        // BƯỚC 3: Giải mã chuỗi dữ liệu kết quả key cuối cùng
        // ==========================================================
        let finalKey = "";
        
        if (responseStep2.data.encryptedData) {
            const bytes = CryptoJS.AES.decrypt(responseStep2.data.encryptedData, 'PlatoboostSecretKey123');
            finalKey = bytes.toString(CryptoJS.enc.Utf8);
        } else {
            finalKey = responseStep2.data.key || responseStep2.data.decryptedKey || "";
        }

        if (!finalKey) {
            return res.status(500).json({ success: false, message: "Hệ thống bóc tách hoàn tất nhưng chuỗi mã Key rỗng." });
        }

        // Trả kết quả JSON sạch chuẩn định dạng về cho Bot Discord nhận diện
        return res.status(200).json({
            success: true,
            key: finalKey.trim()
        });

    } catch (error) {
        console.error(`[Lỗi Luồng Chạy] ${error.message}`);
        return res.status(500).json({ 
            success: false, 
            message: `Tường lửa chặn kết nối: ${error.message}` 
        });
    }
};
