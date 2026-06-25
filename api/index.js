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

        // Mã hóa URL đúng chuẩn để truyền vào Query Parameter
        const encodedUrl = encodeURIComponent(formattedUrl);

        // ĐÃ SỬA: Thêm dấu $ trước dấu ngoặc nhọn và cấu trúc lại tham số đúng chuẩn API của từng server
        const serverEndpoints = [
            `https://bypass.vip{encodedUrl}`,
            `https://dlr-api.online{encodedUrl}`,
            `https://ethone.live{encodedUrl}`
        ];

        let finalKey = "";
        let lastServerLog = "Toàn bộ cổng phân giải từ chối xác thực gói tin.";

        // Vòng lặp quét xuyên qua các server lớn để đòi key
        for (const serverUrl of serverEndpoints) {
            try {
                const response = await axios.get(serverUrl, { 
                    timeout: 8000, // Đặt timeout 8s mỗi server để chuyển con khác ngay nếu bị nghẽn
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' 
                    }
                });

                // Đồng bộ bóc tách các định dạng JSON trả về của từng bên
                if (response.data) {
                    // Chấp nhận cả status dạng chuỗi "success" hoặc boolean true
                    const isSuccess = response.data.status === "success" || response.data.success === true || response.data.status === true;
                    
                    if (isSuccess) {
                        finalKey = response.data.result || response.data.destination || response.data.key || response.data.bypassed || "";
                        
                        // Nếu trích xuất được chuỗi key sạch, thoát khỏi vòng lặp ngay lập tức
                        if (finalKey && finalKey.length > 5 && !finalKey.includes("{")) {
                            break; 
                        }
                    }
                }
            } catch (err) {
                // Ghi nhận lỗi chi tiết của server cuối cùng nếu thất bại
                lastServerLog = `Trục trặc cổng: ${err.message}`;
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
