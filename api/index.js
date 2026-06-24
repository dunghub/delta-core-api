const axios = require('axios');

module.exports = async (req, res) => {
    // Cấu hình Header cho phép gọi từ mọi nơi công khai
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Kiểm tra tham số đầu vào từ bot gửi sang
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ success: false, message: "Thiếu tham số liên kết ?url=" });
    }

    try {
        const urlObj = new URL(targetUrl);
        
        // Trích xuất tham số bảo mật 'd' từ link gốc của người dùng
        const dParam = urlObj.searchParams.get('d');
        if (!dParam) {
            return res.status(400).json({ success: false, message: "Cấu trúc link không chứa tham số xác thực d" });
        }

        // Tạo giả lập trình duyệt sạch vượt Cloudflare cơ bản
        const browserHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://platoboost.com',
            'Referer': targetUrl,
            'X-Requested-With': 'XMLHttpRequest'
        };

        // 🔥 ĐÃ VÁ LỖI CÚ PHÁP: Sử dụng đúng dấu huyền và cấu trúc gọi API PlatoBoost công khai mới nhất
        const startUrl = `https://platoboost.com{dParam}`;
        
        const startRes = await axios.get(startUrl, { headers: browserHeaders, timeout: 15000 });
        const startData = startRes.data;

        if (!startData) {
            return res.status(400).json({ success: false, message: "Máy chủ gốc Delta không phản hồi dữ liệu" });
        }

        // Trường hợp hệ thống thả Key luôn mà không bắt xác minh captcha ngầm
        if (startData.key || (startData.data && startData.data.key)) {
            return res.status(200).json({ success: true, key: startData.key || startData.data.key });
        }

        // Trích xuất mã Token phiên làm việc ngầm từ hệ thống dữ liệu trả về
        const sessionToken = startData.token || (startData.data ? startData.data.token : null);
        if (!sessionToken) {
            return res.status(400).json({ success: false, message: "Tường lửa bảo mật nâng cao chặn tạo Session Token" });
        }

        // Trì hoãn một chút giả lập thời gian người dùng tương tác thật (Chống quét luồng)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Tiến hành xác thực gói tin thông qua API chéo của Plato
        const verifyUrl = `https://platoboost.com{dParam}`;
        const verifyRes = await axios.post(verifyUrl, { token: sessionToken }, { headers: browserHeaders, timeout: 15000 });
        const verifyData = verifyRes.data;

        // Nếu hệ thống trả về cấu trúc chứa Key thành công
        if (verifyData && (verifyData.key || (verifyData.data && verifyData.data.key))) {
            const keyResult = verifyData.key || verifyData.data.key;
            return res.status(200).json({ success: true, key: keyResult });
        }

        return res.status(400).json({ success: false, message: "Phiên làm việc đã hết hạn hoặc Delta bắt xác minh thủ công lại" });

    } catch (error) {
        // Trích xuất thông báo chi tiết nhất từ Axios nếu bị chặn dải IP server đám mây
        let detailError = error.message;
        if (error.response && error.response.data) {
            detailError = typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : error.response.data;
        }
        return res.status(500).json({ success: false, message: `Lỗi luồng Vercel: ${detailError}` });
    }
};
