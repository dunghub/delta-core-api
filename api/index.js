const axios = require('axios');

module.exports = async (req, res) => {
    // Cấu hình Header chống lỗi chặn dải mạng chéo (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ success: false, message: "Thiếu tham số url đầu vào." });

    try {
        let formattedUrl = targetUrl;
        if (!formattedUrl.startsWith('http')) formattedUrl = 'https://' + formattedUrl;

        const encodedUrl = encodeURIComponent(formattedUrl);

        // Danh sách các cổng bẻ khóa Platoboost/Delta tối tân nhất
        const serverEndpoints = [
            `https://stickx.top{encodedUrl}`,
            `https://siryx.net{encodedUrl}`,
            `https://bypass.vip{encodedUrl}`
        ];

        let finalKey = "";
        let lastServerLog = "Toàn bộ cổng phân giải từ chối xác thực hoặc liên kết đã hết hạn.";

        // Vòng lặp quét tìm cổng hoạt động ổn định
        for (const serverUrl of serverEndpoints) {
            try {
                const response = await axios.get(serverUrl, { 
                    timeout: 10000, // Đặt timeout 10 giây cho các link mã hóa cao
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' 
                    }
                });

                if (response.data) {
                    // Tự động bóc tách tất cả các dạng cấu trúc dữ liệu JSON trả về
                    const potentialKey = response.data.key || 
                                         response.data.result || 
                                         response.data.destination || 
                                         response.data.bypassed || 
                                         (response.data.data && response.data.data.result);

                    if (potentialKey && potentialKey.length > 5 && !potentialKey.includes("{")) {
                        finalKey = potentialKey;
                        break; 
                    }
                }
            } catch (err) {
                // Rút gọn tên domain lỗi để hiển thị log sạch
                const domain = new URL(serverUrl).hostname;
                lastServerLog = `Trục trặc tại cổng ${domain}: ${err.message}`;
            }
        }

        // Trả kết quả cuối cùng về cho bot Discord
        if (finalKey) {
            return res.status(200).json({ 
                success: true, 
                key: finalKey.trim() 
            });
        }

        return res.status(200).json({ success: false, message: lastServerLog });

    } catch (error) {
        return res.status(200).json({ success: false, message: `Lỗi luồng phân giải cục bộ: ${error.message}` });
    }
};
