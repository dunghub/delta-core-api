const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/json');

    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ success: false, message: "Thiếu tham số liên kết ?url=" });
    }

    try {
        const urlObj = new URL(targetUrl);
        const dParam = urlObj.searchParams.get('d');
        if (!dParam) return res.status(400).json({ success: false, message: "Cấu trúc link không chứa tham số xác thực d" });

        const browserHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://platoboost.com',
            'Referer': targetUrl
        };

        const startUrl = `https://platoboost.com{dParam}`;
        const startRes = await axios.get(startUrl, { headers: browserHeaders, timeout: 15000 });
        const startData = startRes.data;

        if (!startData) return res.status(400).json({ success: false, message: "Máy chủ gốc Delta không phản hồi" });

        if (startData.key || (startData.data && startData.data.key)) {
            return res.status(200).json({ success: true, key: startData.key || startData.data.key });
        }

        const sessionToken = startData.token || (startData.data ? startData.data.token : null);
        if (!sessionToken) return res.status(400).json({ success: false, message: "Tường lửa chặn tạo Session Token" });

        const verifyUrl = `https://platoboost.com{dParam}`;
        const verifyRes = await axios.post(verifyUrl, { token: sessionToken }, { headers: browserHeaders, timeout: 15000 });
        const verifyData = verifyRes.data;

        if (verifyData && (verifyData.key || (verifyData.data && verifyData.data.key))) {
            return res.status(200).json({ success: true, key: verifyData.key || verifyData.data.key });
        }

        return res.status(400).json({ success: false, message: "Delta yêu cầu làm mới tiến trình link trong game" });

    } catch (error) {
        return res.status(500).json({ success: false, message: `Lỗi kết nối mạng: ${error.message}` });
    }
};
