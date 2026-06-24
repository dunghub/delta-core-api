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

        const browserHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://platoboost.com',
            'Referer': targetUrl,
            'X-Requested-With': 'XMLHttpRequest'
        };

        // Bước 1: Gửi yêu cầu khởi tạo phiên làm việc ngầm lên PlatoBoost
        const startUrl = `https://platoboost.com{dParam}`;
        const startRes = await axios.get(startUrl, { headers: browserHeaders, timeout: 15000 });
        const startData = startRes.data;

        if (!startData) return res.status(400).json({ success: false, message: "Hệ thống Plato không phản hồi dữ liệu ban đầu" });

        // Nếu link đã được bẻ khóa sẵn trước đó, hệ thống trả Key về luôn
        if (startData.key || (startData.data && startData.data.key)) {
            return res.status(200).json({ success: true, key: startData.key || startData.data.key });
        }

        // Trích xuất chuỗi mã hóa Session Token ngầm
        const sessionToken = startData.token || (startData.data ? startData.data.token : null);
        if (!sessionToken) return res.status(400).json({ success: false, message: "Hệ thống chặn tạo Session Token" });

        // Giả lập độ trễ chờ 2.5 giây giống như người dùng thật đang làm nhiệm vụ lướt web (Tránh bị quét bot)
        await new Promise(resolve => setTimeout(resolve, 2500));

        // Bước 2: Gửi gói tin POST chứa Token lên cổng Verify để xác thực nhận Key
        const verifyUrl = `https://platoboost.com{dParam}`;
        const verifyRes = await axios.post(verifyUrl, { token: sessionToken }, { headers: browserHeaders, timeout: 15000 });
        const verifyData = verifyRes.data;

        if (verifyData && (verifyData.key || (verifyData.data && verifyData.data.key))) {
            const finalKey = verifyData.key || verifyData.data.key;
            return res.status(200).json({ success: true, key: finalKey });
        }

        return res.status(400).json({ success: false, message: "Plato bắt xác minh Captcha hình ảnh thủ công" });

    } catch (error) {
        let detailError = error.message;
        if (error.response && error.response.data) {
            detailError = typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : error.response.data;
        }
        return res.status(500).json({ success: false, message: `Lỗi luồng xử lý nội bộ: ${detailError}` });
    }
};
