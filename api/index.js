const axios = require('axios');

module.exports = async (req, res) => {
    // Thiết lập Header CORS và JSON đầy đủ
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    // Hỗ trợ phương thức OPTIONS cho CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ success: false, message: "Thiếu tham số liên kết ?url=" });
    }

    try {
        // LUỒNG CHÍNH: Giả lập HTTP Request siêu tốc để lấy mã HTML của trang web thay vì bật trình duyệt nặng
        const response = await axios.get(targetUrl, {
            timeout: 5000, // Chờ tối đa 5 giây để né lỗi timeout Vercel
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const htmlContent = response.data;
        
        // Quét Regex tìm Key Delta hiển thị trực tiếp trong mã nguồn HTML trang web
        const keyMatch = htmlContent.match(/🔑\s*Key\s*:\s*([A-Za-z0-9_\-]+)/) || 
                         htmlContent.match(/Your\s*Key\s*:\s*([A-Za-z0-9_\-]+)/) ||
                         htmlContent.match(/"key"\s*:\s*"([A-Za-z0-9_\-]+)"/);

        if (keyMatch && keyMatch[1]) {
            return res.status(200).json({ success: true, key: keyMatch[1].trim() });
        }

        // LUỒNG DỰ PHÒNG: Nếu quét HTML gốc không có (do bị kẹt mã hóa/Cloudflare), đẩy qua API bên thứ ba xử lý
        // ĐÃ SỬA LỖI: Cú pháp nối chuỗi bằng dấu nháy ngược chuẩn Javascript
        const backupUrl = `https://vunghongoc.com{encodeURIComponent(targetUrl)}`;
        
        const backupResponse = await axios.get(backupUrl, { timeout: 4000 }); // Chờ tối đa 4 giây
        
        if (backupResponse.data && backupResponse.data.key) {
            return res.status(200).json({ success: true, key: backupResponse.data.key.trim() });
        } else if (backupResponse.data && backupResponse.data.data && backupResponse.data.data.key) {
            // Phòng trường hợp API dự phòng trả về cấu hình kiểu { data: { key: "..." } }
            return res.status(200).json({ success: true, key: backupResponse.data.data.key.trim() });
        }

        return res.status(400).json({ success: false, message: "Hệ thống không bóc tách được Key. Vui lòng làm mới liên kết Delta!" });

    } catch (error) {
        // Nếu luồng chính lỗi mạng, thử gọi ngay luồng dự phòng một lần cuối trước khi sập
        try {
            const backupUrl = `https://vunghongoc.com{encodeURIComponent(targetUrl)}`;
            const backupResponse = await axios.get(backupUrl, { timeout: 4000 });
            if (backupResponse.data && backupResponse.data.key) {
                return res.status(200).json({ success: true, key: backupResponse.data.key.trim() });
            }
        } catch (e) {}

        return res.status(500).json({ 
            success: false, 
            message: `Lỗi kết nối luồng bypass: ${error.message}` 
        });
    }
};
