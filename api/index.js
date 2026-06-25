// api/index.js - Bản Cập Nhật Khắc Phục Lỗi Trích Xuất Token Rỗng
const axios = require('axios');
const cheerio = require('cheerio');
const CryptoJS = require('crypto-js');
const { HttpsProxyAgent } = require('https-proxy-agent');

async function fetchFreeProxies() {
    const sources = [
        'https://proxyscrape.com',
        'https://githubusercontent.com'
    ];
    const randomSource = sources[Math.floor(Math.random() * sources.length)];
    try {
        const res = await axios.get(randomSource, { timeout: 4000 });
        if (typeof res.data === 'string') {
            return res.data.split('\n').map(p => p.trim()).filter(p => p && p.includes(':'));
        }
    } catch (e) {}
    return ['103.152.118.234:80', '185.242.107.135:80'];
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ success: false, message: "Thiếu tham số url." });

    const proxyList = await fetchFreeProxies();
    let maxRetries = 8; 
    let attempt = 0;
    let lastError = "Hệ thống thay đổi cấu trúc mã hóa token.";

    // LUỒNG XỬ LÝ 1: DÀNH CHO LINK IOS (LOOTLABS)
    if (targetUrl.includes('lootlabs.gg')) {
        while (attempt < maxRetries) {
            attempt++;
            const rawProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
            const proxyAgent = new HttpsProxyAgent(`http://${rawProxy}`);
            try {
                const urlObj = new URL(targetUrl);
                const clientKey = urlObj.searchParams.get('s');
                if (!clientKey) return res.status(400).json({ success: false, message: "Link LootLabs thiếu tham số 's'." });

                const lootApi = await axios.get(`https://lootlabs.gg{clientKey}/redirect`, {
                    httpsAgent: proxyAgent,
                    httpAgent: proxyAgent,
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36' }
                });
                if (lootApi.data && lootApi.data.redirect_url) {
                    return res.status(200).json({ success: true, key: lootApi.data.redirect_url });
                }
            } catch (err) { lastError = err.message; }
        }
        return res.status(502).json({ success: false, message: `Lỗi kết nối LootLabs: ${lastError}` });
    }

    // LUỒNG XỬ LÝ 2: DÀNH CHO LINK ANDROID (PLATOBOOST)
    while (attempt < maxRetries) {
        attempt++;
        const rawProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
        const proxyAgent = new HttpsProxyAgent(`http://${rawProxy}`);

        const botAgent = axios.create({
            httpsAgent: proxyAgent,
            httpAgent: proxyAgent,
            timeout: 5000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            }
        });

        try {
            let formattedUrl = targetUrl;
            if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
                formattedUrl = 'https://' + formattedUrl;
            }

            const responseStep1 = await botAgent.get(formattedUrl);
            const $ = cheerio.load(responseStep1.data);
            
            // ĐÃ SỬA: Quét nâng cao tất cả các thuộc tính chứa Token (Cả input ẩn, script và url)
            let targetToken = "";
            try {
                const urlParams = new URLSearchParams(new URL(formattedUrl).search);
                targetToken = urlParams.get('id') || urlParams.get('token') || "";
            } catch (e) {}
            
            if (!targetToken) {
                // Quét tìm trong toàn bộ input bất kể name hay id
                targetToken = $('input[name="token"]').val() || 
                              $('input[id="token"]').val() || 
                              $('input[type="hidden"]').first().val() || "";
            }

            // Phương án dự phòng 3: Quét chuỗi regex tìm mã token nằm trong các đoạn script script ẩn của Platoboost
            if (!targetToken && responseStep1.data) {
                const tokenMatch = responseStep1.data.match(/top\.location\.href\s*=\s*['"].*?[?&]token=([^'"]+)/) || 
                                   responseStep1.data.match(/const\s+token\s*=\s*['"]([^'"]+)['"]/);
                if (tokenMatch) targetToken = tokenMatch[1];
            }

            // Nếu quét tất cả các ngóc ngách mà vẫn rỗng, chứng tỏ cấu trúc HTML đã bị Platoboost khóa hoàn toàn trên proxy này
            if (!targetToken) {
                lastError = "Tường lửa chặn tải cấu trúc thẻ bảo mật (HTML trống)";
                continue;
            }

            const responseStep2 = await botAgent.post('https://platoboost.com', {
                token: targetToken,
                type: "delta"
            });

            if (responseStep2.data && responseStep2.data.success) {
                let finalKey = responseStep2.data.encryptedData 
                    ? CryptoJS.AES.decrypt(responseStep2.data.encryptedData, 'PlatoboostSecretKey123').toString(CryptoJS.enc.Utf8)
                    : (responseStep2.data.key || responseStep2.data.decryptedKey || "");
                
                if (finalKey) {
                    return res.status(200).json({ success: true, key: finalKey.trim() });
                }
            } else {
                lastError = "Mã xác thực không hợp lệ hoặc đã hết hạn phiên";
            }
        } catch (error) {
            lastError = error.message;
        }
    }

    return res.status(502).json({ 
        success: false, 
        message: `API riêng từ chối bóc tách: ${lastError}. Hãy kiểm tra lại liên kết thô.` 
    });
};
