// api/index.js - Chạy trên Vercel (Tự cào token và tự bypass qua Proxy Dân Cư của bạn)
const axios = require('axios');
const cheerio = require('cheerio');
const CryptoJS = require('crypto-js');
const { HttpsProxyAgent } = require('https-proxy-agent');

function generateSessionId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ success: false, message: "Thiếu tham số url." });

    const sessionId = generateSessionId();

    // ==========================================================
    // ⚙️ ĐIỀN THÔNG TIN TÀI KHOẢN PROXY DÂN CƯ THẬT CỦA BẠN TẠI ĐÂY
    // ==========================================================
    const proxyUser = "THAY_USER_PROXY_CUA_BAN";
    const proxyPass = "THAY_PASSWORD_PROXY_CUA_BAN";
    const proxyHost = "THAY_IP_HOAC_HOST_PROXY_CUA_BAN";
    const proxyPort = 8000; // Thay bằng port proxy của bạn

    // Cấu hình Proxy Agent gộp chuỗi -session- giúp cố định IP suốt luồng chạy
    const proxyUrl = `http://${proxyUser}-session-${sessionId}:${proxyPass}@${proxyHost}:${proxyPort}`;
    const agent = new HttpsProxyAgent(proxyUrl);

    const botAgent = axios.create({
        httpsAgent: agent,
        httpAgent: agent,
        timeout: 22000, // Timeout thấp hơn 30s của Discord để kịp trả lỗi
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"'
        }
    });

    try {
        let formattedUrl = targetUrl;
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
            formattedUrl = 'https://' + formattedUrl;
        }

        // LUỒNG XỬ LÝ 1: DÀNH CHO LINK IOS (LOOTLABS)
        if (formattedUrl.includes('lootlabs.gg')) {
            const urlObj = new URL(formattedUrl);
            const clientKey = urlObj.searchParams.get('s');
            if (!clientKey) throw new Error("Link LootLabs thiếu mã định danh phiên.");

            const lootApi = await botAgent.get(`https://lootlabs.gg{clientKey}/redirect`, {
                headers: {
                    'Origin': 'https://lootlabs.gg',
                    'Referer': 'https://lootlabs.gg'
                }
            });

            if (lootApi.data && lootApi.data.redirect_url) {
                return res.status(200).json({ success: true, key: lootApi.data.redirect_url });
            }
            throw new Error("LootLabs từ chối sinh link nhận key.");
        }

        // LUỒNG XỬ LÝ 2: DÀNH CHO LINK ANDROID (PLATOBOOST)
        const responseStep1 = await botAgent.get(formattedUrl);
        const $ = cheerio.load(responseStep1.data);
        
        let targetToken = "";
        try {
            const urlParams = new URLSearchParams(new URL(formattedUrl).search);
            targetToken = urlParams.get('id') || urlParams.get('token') || "";
        } catch (e) {}
        
        if (!targetToken) {
            targetToken = $('input[name="token"]').val() || 
                          $('input[id="token"]').val() || 
                          $('input[type="hidden"]').first().val() || "";
        }

        // Quét dự phòng chuỗi Regex nếu bị ẩn mã token
        if (!targetToken && responseStep1.data) {
            const tokenMatch = responseStep1.data.match(/top\.location\.href\s*=\s*['"].*?[?&]token=([^'"]+)/) || 
                               responseStep1.data.match(/const\s+token\s*=\s*['"]([^'"]+)['"]/);
            if (tokenMatch) targetToken = tokenMatch[1];
        }

        if (!targetToken) {
            throw new Error("Tường lửa đã reset token cấu trúc trang HTML. Hãy dùng link mới tinh!");
        }

        // Bước POST đổi mã token lấy key chính thức (Chạy trên ĐÚNG IP proxy của bước 1)
        const responseStep2 = await botAgent.post('https://platoboost.com', {
            token: targetToken,
            type: "delta"
        });

        if (!responseStep2.data || !responseStep2.data.success) {
            throw new Error("Cổng API gốc từ chối xác thực chuỗi token.");
        }

        let finalKey = "";
        if (responseStep2.data.encryptedData) {
            const bytes = CryptoJS.AES.decrypt(responseStep2.data.encryptedData, 'PlatoboostSecretKey123');
            finalKey = bytes.toString(CryptoJS.enc.Utf8);
        } else {
            finalKey = responseStep2.data.key || responseStep2.data.decryptedKey || "";
        }

        if (!finalKey) throw new Error("Dữ liệu bóc tách hoàn tất nhưng chuỗi mã Key rỗng.");

        return res.status(200).json({ success: true, key: finalKey.trim() });

    } catch (error) {
        return res.status(200).json({ 
            success: false, 
            message: error.message || "Tường lửa chặn request xác thực gói tin." 
        });
    }
};
