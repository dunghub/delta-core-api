const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ success: false, message: "Thiếu tham số liên kết ?url=" });

    try {
        const urlObj = new URL(targetUrl);
        const dParam = urlObj.searchParams.get('d');
        if (!dParam) return res.status(400).json({ success: false, message: "Cấu trúc link không chứa tham số xác thực d" });

        // Tạo danh sách gọi API bẻ khóa thích ứng với cả domain cũ và domain ://platorelay.com mới
        const apiEndpoints = [
            `https://snoopy.ovh{encodeURIComponent(targetUrl)}`,
            `https://vunghongoc.com{encodeURIComponent(targetUrl)}`,
            `https://tony9.dev{encodeURIComponent(targetUrl)}`,
            `https://vercel.app{encodeURIComponent(targetUrl)}`
        ];

        let finalKey = null;
        let lastError = "Các cổng giải mã từ chối chuỗi mã hóa";

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
            return res.status(400).json({ success: false, message: `Thuật toán Platorelay mới chặn giải mã. Chi tiết: ${lastError}` });
        }

    } catch (globalError) {
        return res.status(500).json({ success: false, message: `Lỗi xử lý URL: ${globalError.message}` });
    }
};
