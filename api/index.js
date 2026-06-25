// api/index.js - Bản Ép Luồng Đa Năng Nâng Cấp Vòng Lặp Lọc Proxy Free Cực Mạnh
const axios = require('axios');
const cheerio = require('cheerio');
const CryptoJS = require('crypto-js');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Hàm cào proxy free từ các kho GitHub cập nhật liên tục từng phút
async function fetchFreeProxies() {
    const sources = [
        'https://proxyscrape.com',
        'https://githubusercontent.com',
        'https://githubusercontent.com', // Nguồn proxy mới siêu sạch
        'https://githubusercontent.com'
    ];
    
    const randomSource = sources[Math.floor(Math.random() * sources.length)];
    try {
        const res = await axios.get(randomSource, { timeout: 4000 });
        if (typeof res.data === 'string') {
            return res.data.split('\n').map(p => p.trim()).filter(p => p && p.includes(':'));
        }
    } catch (e) {
        console.error("Lỗi cào nguồn proxy:", e.message);
    }
    // Dải proxy dự phòng cứng nếu server github nghẽn
    return ['103.152.118.234:80', '185.242.107.135:80', '43.200.77.12:80', '117.250.3.34:8080'];
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ success: false, message: "Thiếu tham số url." });

    const proxyList = await fetchFreeProxies();
    
    // ĐÃ NÂNG CẤP: Tăng số lần thử lại từ 5 lên 10 để bao quát dải proxy sống nhiều hơn
    let maxRetries = 10; 
    let attempt = 0;
    let lastError = "Không tìm thấy proxy free nào hoạt động.";

    // LUỒNG XỬ LÝ 1: DÀNH CHO LINK IOS (LOOTLABS)
    if (targetUrl.includes('lootlabs.gg')) {
        while (attempt < maxRetries) {
            attempt++;
            const rawProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
            const proxyAgent = new HttpsProxyAgent(`http://${rawProxy}`);

            try {
                const urlObj = new URL(targetUrl);
                const clientKey = urlObj.searchParams.get('s');
                if (!clientKey) return res.status(400).json({ success: false, message: "Link LootLabs thiếu tham see 's' hợp lệ." });

                const lootApi = await axios.get(`https://lootlabs.gg{clientKey}/redirect`, {
                    httpsAgent: proxyAgent,
                    httpAgent: proxyAgent,
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36',
                        'Origin': 'https://lootlabs.gg',
                        'Referer': 'https://lootlabs.gg'
                    }
                });

                if (lootApi.data && lootApi.data.redirect_url) {
                    return res.status(200).json({ success: true, key: lootApi.data.redirect_url });
                }
            } catch (err) {
                lastError = err.message;
            }
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
            timeout: 5000, // Đặt timeout 5 giây để bỏ qua nhanh proxy chết
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        try {
            let formattedUrl = targetUrl;
            if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
                formattedUrl = 'https://' + formattedUrl;
            }

            const responseStep1 = await botAgent.get(formattedUrl);
            const $ = cheerio.load(responseStep1.data);
            
            let targetToken = "";
            try {
                const urlParams = new URLSearchParams(new URL(formattedUrl).search);
                targetToken = urlParams.get('id') || urlParams.get('token') || "";
            } catch (e) {}
            
            if (!targetToken) targetToken = $('input[name="token"]').val() || $('input[id="token"]').val() || "";

            // Nếu proxy này cào trang bị trống (Cloudflare chặn) hoặc không ra token, tiếp tục đổi proxy khác ngay
            if (!targetToken) continue;

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
            }
        } catch (error) {
            lastError = error.message;
        }
    }

    return res.status(502).json({ 
        success: false, 
        message: `Đã tự động lặp đổi liên tiếp ${maxRetries} proxy free nhưng đều gặp lỗi mạng (${lastError}).` 
    });
};
