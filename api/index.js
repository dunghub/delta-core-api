// api/index.js - Cổng Máy Chủ Chuyển Hướng Đa Tầng (API Pool Dự Phòng 0đ)
const axios = require('axios');

module.exports = async (req, res) => {
    // Cấu hình Header chống lỗi chặn dải mạng
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ success: false, message: "Thiếu tham số url đầu vào." });

    try {
        let formattedUrl = targetUrl;
        if (!formattedUrl.startsWith('http')) formattedUrl = 'https://' + formattedUrl;

        // DANH SÁCH CÁC MÁY CHỦ BẺ KHÓA MẠNH NHẤT - TỰ ĐỘNG CHUYỂN HƯỚNG NẾU CÓ CON BỊ SẬP
        const serverEndpoints = [
            `https://bypass.vip{encodeURIComponent(formattedUrl)}`,
            `https://uneti-bot.xyz{encodeURIComponent(formattedUrl)}`,
            `https://ethone.live{encodeURIComponent(formattedUrl)}`
        ];

        let finalKey = "";
        let lastServerLog = "Tất cả máy chủ bẻ khóa đều đang quá tải.";

        // Vòng lặp quét xuyên qua các server lớn để đòi key
        for (const serverUrl of serverEndpoints) {
            try {
                const response = await axios.get(serverUrl, { 
                    timeout: 8000, // Đặt timeout 8s mỗi server để chuyển con khác ngay nếu bị nghẽn
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' }
                });

                // Đồng bộ bóc tách các định dạng JSON trả về của từng bên
                if (response.data && (response.data.status === "success" || response.data.success === true)) {
                    finalKey = response.data.result || response.data.destination || response.data.key || "";
                    
                    // Nếu trích xuất được chuỗi key sạch, thoát khỏi vòng lặp ngay lập tức
                    if (finalKey && finalKey.length > 5 && !finalKey.includes("{")) {
                        break; 
                    }
                }
            } catch (err) {
                lastServerLog = `Trục trặc cổng kết nối ngầm: ${err.message}`;
            }
        }

        // Trả kết quả sạch 100% về cho bot Dubo hiển thị bảng xanh
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
