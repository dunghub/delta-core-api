const axios = require('axios');

// Hàm giải mã chuỗi mã hóa cực dài từ hệ thống Platorelay mới
function decodePlatoToken(targetUrl) {
    try {
        const urlObj = new URL(targetUrl);
        const rParam = urlObj.searchParams.get('r') || urlObj.searchParams.get('d');
        if (!rParam) return null;

        // Tiến hành bóc tách chuỗi base64 ngầm theo thuật toán Delta
        const decodedBase64 = Buffer.from(rParam, 'base64').toString('utf-8');
        const tokenMatch = decodedBase64.match(/[\?&]tk=([^&#]+)/);
        
        return tokenMatch ? tokenMatch[1] : null;
    } catch (e) {
        return null;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ success: false, message: "Thiếu tham số liên kết ?url=" });

    try {
        // Tự động giải mã token ngầm từ link bạn gửi sang
        const decodedToken = decodePlatoToken(targetUrl);

        // Danh sách các cổng API liên thông (Chữa cháy nếu dải IP Vercel bị chặn)
        const apiEndpoints = [
            `https://snoopy.ovh{encodeURIComponent(targetUrl)}`,
            `https://vunghongoc.com{encodeURIComponent(targetUrl)}`,
            `https://vercel.app{encodeURIComponent(targetUrl)}`
        ];

        // Nếu giải mã thành công mã token thật, chèn cổng ưu tiên số 1
        if (decodedToken) {
            apiEndpoints.unshift(`https://platoboost.com{decodedToken}`);
        }

        let finalKey = null;
        let lastError = "Các cụm API chưa cập nhật luồng mã hóa";

        for (const endpoint of apiEndpoints) {
            try {
                const response = await axios.get(endpoint, { timeout: 12000 });
                if (response.data) {
                    if (response.data.success && response.data.key) {
                        finalKey = response.data.key;
                        break;
                    } else if (response.data.key) {
                        finalKey = response.data.key;
                        break;
                    } else if (response.data.data && response.data.data.key) {
                        finalKey = response.data.data.key;
                        break;
                    }
                }
            } catch (error) {
                lastError = error.message;
            }
        }

        if (finalKey) {
            return res.status(200).json({ success: true, key: finalKey.trim() });
        } else {
            return res.status(400).json({ success: false, message: `Hệ thống từ chối chuỗi xác thực. Chi tiết: ${lastError}` });
        }

    } catch (globalError) {
        return res.status(500).json({ success: false, message: `Lỗi luồng xử lý: ${globalError.message}` });
    }
};
