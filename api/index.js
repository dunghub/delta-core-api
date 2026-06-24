const axios = require('axios');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ success: false, message: "Thiếu tham số liên kết ?url=" });

    let browser = null;
    try {
        // Cấu hình khởi động trình duyệt Chrome ngầm trên máy chủ đám mây Vercel
        browser = await puppeteer.launch({
            args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        
        // Cài đặt User-Agent sạch để PlatoRelay không phát hiện ra là Bot đám mây
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/122.0.0.0 Safari/537.36');

        // Bước 1: Trình duyệt ảo tự động truy cập thẳng vào link auth.platorelay của bạn
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // Bước 2: Treo máy ngầm 3 giây giả lập người dùng đang đọc báo làm nhiệm vụ
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Bước 3: Tự động chạy đoạn mã bóc tách (Inject Script) để ép trang web nhả Key Delta gốc ra
        const extractedData = await page.evaluate(() => {
            // Quét tìm tất cả các biến chứa Key hoặc Token trong bộ nhớ hệ thống của trang web
            if (window.localStorage) {
                const localKey = window.localStorage.getItem('key') || window.localStorage.getItem('delta_key');
                if (localKey) return { success: true, key: localKey };
            }
            
            // Tìm kiếm chuỗi văn bản chứa key hiển thị trên giao diện màn hình
            const bodyText = document.body.innerText;
            const keyMatch = bodyText.match(/🔑\s*Key\s*:\s*([A-Za-z0-9_\-]+)/) || bodyText.match(/Your\s*Key\s*:\s*([A-Za-z0-9_\-]+)/);
            if (keyMatch) return { success: true, key: keyMatch[1] };

            return null;
        });

        await browser.close();

        if (extractedData && extractedData.key) {
            return res.status(200).json({ success: true, key: extractedData.key.trim() });
        } else {
            // Luồng dự phòng tự động chuyển sang cổng API mượn nếu trình duyệt ảo bị kẹt Captcha hình ảnh
            const backupUrl = `https://vunghongoc.com{encodeURIComponent(targetUrl)}`;
            const response = await axios.get(backupUrl, { timeout: 10000 });
            if (response.data && response.data.key) {
                return res.status(200).json({ success: true, key: response.data.key.trim() });
            }
            return res.status(400).json({ success: false, message: "Trình duyệt riêng tư bị chặn bởi lớp Captcha hình ảnh của Plato." });
        }

    } catch (error) {
        if (browser !== null) await browser.close();
        return res.status(500).json({ success: false, message: `Lỗi khởi động trình duyệt ảo: ${error.message}` });
    }
};
