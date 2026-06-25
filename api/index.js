const axios = require('axios');

module.exports = async (req, res) => {
    // Thiết lập Header CORS và JSON đầy đủ
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ success: false, message: "Thiếu tham số liên kết ?url=" });
    }

    // MẢNG API BYPASS UY TÍN (Nên ưu tiên dùng API chuyên dụng cho Platoboost/Delta)
    // Bạn có thể thay thế bằng link API hoạt động tốt mà bạn tìm được
    const bypassAPIs = [
        `https://vunghongoc.com{encodeURIComponent(targetUrl)}`, // Đã sửa cú pháp truyền tham số chuẩn
        `https://stickx.top{encodeURIComponent(targetUrl)}`  // Thêm API dự phòng chuyên Roblox Exploit
    ];

    try {
        // LUỒNG 1: THỬ GỌI ĐỒNG THỜI HOẶC TUẦN TỰ CÁC API BYPASS CHUYÊN DỤNG
        // Vì Delta hệ thống mới bắt buộc phải giải mã qua API trung gian (không quét HTML thuần được)
        
        for (const apiUrl of bypassAPIs) {
            try {
                const response = await axios.get(apiUrl, { 
                    timeout: 6000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, Gecko) Chrome/122.0.0.0 Mobile Safari/537.36', // Đổi sang User-Agent Mobile để khớp với môi trường chạy Delta Roblox
                        'Accept': 'application/json'
                    }
                });

                // Kiểm tra các định dạng dữ liệu trả về phổ biến của API Bypass
                if (response.data) {
                    const result = response.data;
                    let key = result.key || (result.data && result.data.key) || result.result;
                    
                    if (key) {
                        return res.status(200).json({ 
                            success: true, 
                            key: key.trim(),
                            provider: "Bypass System Successfully"
                        });
                    }
                }
            } catch (apiError) {
                console.log(`API ${apiUrl} lỗi hoặc timeout, thử API tiếp theo...`);
                continue; // Nếu API này lỗi, tự động chuyển sang API tiếp theo trong mảng
            }
        }

        // LUỒNG 2: NẾU CÁC API TRÊN ĐỀU THẤT BẠI, THỬ QUÉT HTML GỐC (DÙ TỶ LỆ THÀNH CÔNG THẤP VỚI CƠ CHẾ MỚI)
        const response = await axios.get(targetUrl, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        const htmlContent = response.data;
        const keyMatch = htmlContent.match(/🔑\s*Key\s*:\s*([A-Za-z0-9_\-]+)/) || 
                         htmlContent.match(/Your\s*Key\s*:\s*([A-Za-z0-9_\-]+)/) ||
                         htmlContent.match(/"key"\s*:\s*"([A-Za-z0-9_\-]+)"/);

        if (keyMatch && keyMatch[1]) {
            return res.status(200).json({ success: true, key: keyMatch[1].trim() });
        }

        return res.status(400).json({ 
            success: false, 
            message: "Hệ thống Platoboost/Delta đã cập nhật thuật toán. Vui lòng thử lại sau hoặc cập nhật API endpoint mới!" 
        });

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: `Lỗi kết nối toàn bộ luồng bypass: ${error.message}` 
        });
    }
};
