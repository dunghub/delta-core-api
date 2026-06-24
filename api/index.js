const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ success: false, message: "Thiếu tham số liên kết ?url=" });

    // Danh sách các cổng API bẻ khóa Delta/PlatoBoost mạnh nhất hiện tại
    const apiEndpoints = [
        `https://snoopy.ovh{encodeURIComponent(targetUrl)}`,
        `https://vunghongoc.com{encodeURIComponent(targetUrl)}`,
        `https://tony9.dev{encodeURIComponent(targetUrl)}`
    ];

    let finalKey = null;
    let lastError = "Không thể kết nối đến các cổng giải mã";

    // Vòng lặp tự động chuyển cổng: Nếu cổng 1 lỗi hoặc bị chặn, tự động nhảy sang cổng 2 và cổng 3
    for (const endpoint of apiEndpoints) {
        try {
            const response = await axios.get(endpoint, { timeout: 12000 });
            
            // Hỗ trợ bóc tách nhiều cấu trúc dữ liệu trả về khác nhau của các API
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
            // Tiếp tục thử cổng tiếp theo trong danh sách
        }
    }

    if (finalKey) {
        return res.status(200).json({ success: true, key: finalKey.trim() });
    } else {
        return res.status(400).json({ 
            success: false, 
            message: `Tường lửa Plato chặn luồng đám mây. Chi tiết: ${lastError}` 
        });
    }
};
