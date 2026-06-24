const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ success: false, message: "Thiếu tham số liên kết ?url=" });

    try {
        // Sử dụng cổng luồng ngầm công khai liên thông để bypass hộ dải IP bị xích của Vercel
        const bypassProviderUrl = `https://vercel.app{encodeURIComponent(targetUrl)}`;
        const response = await axios.get(bypassProviderUrl, { timeout: 20000 });
        
        if (response.data && response.data.success) {
            return res.status(200).json({ success: true, key: response.data.key });
        } else {
            return res.status(400).json({ success: false, message: response.data.message || "Luồng dự phòng không trả về Key" });
        }
    } catch (error) {
        try {
            // Cổng dự phòng số 2 nếu cổng 1 quá tải
            const backupUrl = `https://vunghongoc.com{encodeURIComponent(targetUrl)}`;
            const backupRes = await axios.get(backupUrl, { timeout: 15000 });
            if (backupRes.data && backupRes.data.key) {
                return res.status(200).json({ success: true, key: backupRes.data.key });
            }
        } catch (e) {}
        
        return res.status(500).json({ success: false, message: `Hệ thống Plato chặn IP Vercel của bạn: ${error.message}` });
    }
};
