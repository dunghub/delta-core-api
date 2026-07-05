const express = require('express');
const { chromium } = require('playwright-extra');
const stealth = require('stealth-plugin')();

// Kích hoạt tính năng ẩn danh nâng cao chống bị phát hiện bot
chromium.use(stealth);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Endpoint xử lý bypass nhận tham số qua query: /api/bypass?url=...
app.get('/api/bypass', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ 
            success: false, 
            error: "Thiếu tham số 'url' cần vượt link." 
        });
    }

    let browser;
    try {
        // Khởi chạy trình duyệt ẩn danh (Headless) tối ưu cho Render (Linux)
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        // Cấu hình môi trường giả lập chuẩn thiết bị dân cư tại Việt Nam
        const context = await browser.newContext({
            locale: 'vi-VN',
            timezoneId: 'Asia/Ho_Chi_Minh',
            viewport: { width: 1366, height: 768 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });

        const page = await context.newPage();
        console.log(`[PROCESS] Đang tiến hành bẻ khóa liên kết: ${targetUrl}`);

        // 1. TRUY CẬP ĐƯỜNG DẪN BAN ĐẦU
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });

        // Tự động tắt các pop-up quảng cáo che khuất màn hình nếu xuất hiện
        const closePopup = await page.$('.modal-header button, .close, text="×", [class*="close"]');
        if (closePopup) await closePopup.click({ force: true }).catch(() => {});

        // 2. XỬ LÝ LỚP NÚT BẤM ĐẦU TIÊN (Ví dụ nút Get Link của vuotlink.net)
        const getLinkBtn = await page.$('text="Get Link", text="Nhấn Để Vượt Link", [class*="btn-success"], .btn-getlink');
        if (getLinkBtn) {
            console.log(`[STEP 1] Phát hiện nút chuyển hướng ban đầu, đang kích hoạt...`);
            
            // Đón đầu sự kiện nếu trang web tự động mở ra một Tab mới để làm nhiệm vụ
            const [newPage] = await Promise.all([
                context.waitForEvent('page', { timeout: 15000 }).catch(() => {}),
                getLinkBtn.click({ force: true })
            ]);

            // Nếu hệ thống chuyển hướng sang Tab nhiệm vụ mới, ta dời luồng bot sang Tab đó
            if (newPage) {
                await newPage.waitForLoadState('networkidle').catch(() => {});
                console.log(`[STEP 2] Hệ thống đã chuyển tab thành công sang miền nhiệm vụ mới.`);
            }
        }

        // Đợi thêm vài giây để mã JavaScript của trang nhiệm vụ tải hoàn chỉnh cấu hình
        await page.waitForTimeout(4000);

        // 3. GIẢ LẬP HÀNH VI CUỘN TRANG (Vượt bẫy kiểm tra người dùng thật)
        console.log(`[STEP 3] Đang cuộn trang tự động để kích hoạt đồng hồ đếm ngược...`);
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let currentHeight = 0;
                const step = 90;
                const scroller = setInterval(() => {
                    window.scrollBy(0, step);
                    currentHeight += step;
                    // Cuộn đến khi hết trang
                    if (currentHeight >= document.body.scrollHeight) {
                        clearInterval(scroller);
                        // Cuộn ngược lên một chút giả lập hành vi kéo chuột đọc bài
                        window.scrollBy(0, -350);
                        resolve();
                    }
                }, 70);
            });
        });

        // 4. TỰ ĐỘNG BẤM ĐÁNH GIÁ 5 SAO (Kích hoạt bộ đếm giây ẩn nếu trang yêu cầu)
        console.log(`[STEP 4] Quét và kích hoạt hệ thống đánh giá sao nếu có...`);
        const stars = await page.$$('.stars i, [class*="star"], .vote-stars span, .stars, #rating');
        if (stars.length > 0) {
            // Ép click vào phần tử cuối cùng của mảng (tương ứng mức 5 sao cao nhất)
            await stars[stars.length - 1].click({ force: true }).catch(() => {});
        }

        // 5. CHỜ ĐỒNG HỒ ĐẾM NGƯỢC CHẠY HẾT (Thời gian chờ chuẩn cho các web VN: 65 giây)
        console.log(`[WAIT] Đang treo luồng ngầm giữ kết nối sạch trong 65 giây...`);
        await page.waitForTimeout(65000);

        // 6. QUÉT VÀ TRÍCH XUẤT CHUỖI MÃ CODE KẾT QUẢ ĐẦU RA (Đa mục tiêu cho mọi loại trang)
        console.log(`[STEP 5] Tiến hành bóc tách mã code hiển thị...`);
        const codeSelectors = [
            '#code-output', '.id-bai-viet', 'div.maloai', 
            '#outputCode', '[id*="code"]', 'input[name="code"]',
            '[class*="code"]', '.result-code', 'textarea[id*="code"]'
        ];

        let extractedKey = "";
        for (const selector of codeSelectors) {
            const element = await page.$(selector);
            if (element) {
                const isInput = await element.evaluate(el => el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea');
                extractedKey = isInput ? await element.inputValue() : await element.innerText();
                
                // Điều kiện lọc chuỗi sạch (Loại bỏ các văn bản hướng dẫn rác đi kèm)
                if (extractedKey && extractedKey.trim().length > 2 && !extractedKey.includes('Bài Viết') && !extractedKey.includes('ID')) {
                    extractedKey = extractedKey.trim();
                    break;
                }
            }
        }

        await browser.close();

        if (extractedKey) {
            console.log(`[SUCCESS] Bẻ khóa thành công! Kết quả: ${extractedKey}`);
            return res.json({
                success: true,
                key: extractedKey // Trả về biến 'key' cho khớp với cấu trúc bot.js mới của bạn
            });
        } else {
            return res.json({
                success: false,
                error: "Hệ thống đã đợi hết thời gian nhưng trang web không sinh mã code mới."
            });
        }

    } catch (error) {
        if (browser) await browser.close();
        console.error(`[CRITICAL ERROR]: ${error.message}`);
        return res.status(500).json({
            success: false,
            error: "Vượt link thất bại",
            details: error.message
        });
    }
});

// Khởi chạy máy chủ
app.listen(PORT, () => {
    console.log(`[OK] Server Bypass Core của bạn đang chạy mượt mà tại cổng ${PORT}`);
});
