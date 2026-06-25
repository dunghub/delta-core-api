// api/index.js - Bản Ép Luồng Cộng Đồng Dùng Proxy Free Tự Động
const axios = require('axios');
const cheerio = require('cheerio');
const CryptoJS = require('crypto-js');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Hàm tự động đi cào proxy free từ các nguồn uy tín công khai
async function fetchFreeProxies() {
    const sources = [
        'https://proxyscrape.com',
        'https://githubusercontent.com',
        'https://githubusercontent.com'
    ];
    
    // Chọn ngẫu nhiên 1 nguồn để cào tránh bị trùng lặp
    const randomSource = sources[Math.floor(Math.random() * sources.length)];
    try {
        const res = await axios.get(randomSource, { timeout: 5000 });
        if (typeof res.data === 'string') {
            // Tách các proxy thành mảng dòng sạch
            return res.data.split('\n').map(p => p.trim()).filter(p => p && p.includes(':'));
        }
    } catch (e) {
        console.error("Lỗi cào proxy free:", e.message);
    }
    // Danh sách proxy free dự phòng cứng nếu cả 3 nguồn trên bị nghẽn
    return ['103.152.118.234:80', '185.242.107.135:80', '43.200.77.12:80'];
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ success: false, message: "Thiếu tham số url." });

    // 1. Lấy danh sách proxy free mới nhất về bộ nhớ tạm
    const proxyList = await fetchFreeProxies();
    
    let maxRetries = 5; // Số lần tự động thử lại với proxy khác nếu bị lỗi
    let attempt = 0;
    let errorMsg = "Tường lửa chặn kết nối";

    // 2. VÒNG LẶP TUẦN HOÀN: Thử liên tục cho đến khi tìm được proxy free hoạt động
    while (attempt < maxRetries) {
        attempt++;
        // Bốc ngẫu nhiên 1 con proxy free từ danh sách cào được
        const rawProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
        const [proxyHost, proxyPort] = rawProxy.split(':');
        
        // Cấu hình Proxy Agent đi xuyên tường lửa
        const proxyAgent = new HttpsProxyAgent(`http://${proxyHost}:${proxyPort}`);

        const botAgent = axios.create({
            httpsAgent: proxyAgent,
            httpAgent: proxyAgent,
            timeout: 6000, // Đặt timeout thấp (6s) để nếu proxy free chậm thì đổi ngay con khác
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        try {
            // Chuẩn hóa định dạng URL tránh lỗi parse
            let formattedUrl = targetUrl;
            if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
                formattedUrl = 'https://' + formattedUrl;
            }

            // BƯỚC 1: Gọi link Platoboost để bóc Token
            const responseStep1 = await botAgent.get(formattedUrl);
            const $ = cheerio.load(responseStep1.data);
            
            let targetToken = "";
            try {
                const urlParams = new URLSearchParams(new URL(formattedUrl).search);
                targetToken = urlParams.get('id') || urlParams.get('token') || "";
            } catch (e) {}

            if (!targetToken) targetToken = $('input[name="token"]').val() || $('input[id="token"]').val() || "";

            if (!targetToken) {
                // Nếu không có token, bỏ qua proxy này và nhảy sang con proxy khác thử lại
                continue; 
            }

            // BƯỚC 2: Xác thực mở khóa bằng CHÍNH con proxy free đang sống này
            const responseStep2 = await botAgent.post('https://platoboost.com', {
                token: targetToken,
                type: "delta"
            });

            if (responseStep2.data && responseStep2.data.success) {
                // BƯỚC 3: Giải mã Key
                let finalKey = "";
                if (responseStep2.data.encryptedData) {
                    const bytes = CryptoJS.AES.decrypt(responseStep2.data.encryptedData, 'PlatoboostSecretKey123');
                    finalKey = bytes.toString(CryptoJS.enc.Utf8);
                } else {
                    finalKey = responseStep2.data.key || responseStep2.data.decryptedKey || "";
                }

                if (finalKey) {
                    // TRẢ KẾT QUẢ VỀ NGAY nếu thành công, thoát khỏi vòng lặp
                    return res.status(200).json({ success: true, key: finalKey.trim() });
                }
            }
        } catch (error) {
            // Nếu proxy này bị lỗi kết nối hoặc bị chặn, lưu lại thông báo lỗi và tiếp tục vòng lặp
            errorMsg = `Proxy [${proxyHost}] lỗi: ${error.message}`;
            console.log(`[Thử lại lượt ${attempt}/${maxRetries}] Đang đổi proxy free khác...`);
        }
    }

    // Nếu đã thử hết 5 lần mà vẫn thất bại do proxy free chết sạch hoặc bị chặn loạt
    return res.status(502).json({ 
        success: false, 
        message: `Đã thử liên tục ${maxRetries} dải proxy free cộng đồng nhưng đều bị tường lửa nghẽn mạch.` 
    });
};
