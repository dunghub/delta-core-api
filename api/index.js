const puppeteer = require('puppeteer');
const axios = require('axios');

// ĐIỀN THÔNG TIN CỦA BẠN VÀO ĐÂY:
const LINK_DELTA_CUA_BAN = "DÁN_LINK_DELTA_GỐC_LẤY_TỪ_GAME_VÀO_ĐÂY";
const API_KEY_CAPSOLVER = "DÁN_API_KEY_GIẢI_CAPTCHA_CỦA_BẠN_VÀO_ĐÂY"; // Lấy từ capsolver.com hoặc dịch vụ tương đương

/**
 * Hàm gọi AI giải mã lớp bảo mật Cloudflare Turnstile/hCaptcha của Delta
 */
async function thueGiaiCaptcha(websiteUrl, websiteKey) {
    try {
        console.log("🧩 Máy chủ Delta bắt gặp Captcha. Đang gửi sang AI để giải mã...");
        
        // Tạo nhiệm vụ giải mã gửi lên hệ thống CapSolver
        const taskRes = await axios.post('https://capsolver.com', {
            clientKey: API_KEY_CAPSOLVER,
            task: {
                type: "AntiTurnstileTaskProxyLess", // Delta thường dùng Turnstile của Cloudflare
                websiteURL: websiteUrl,
                websiteKey: websiteKey
            }
        });

        if (taskRes.data && taskRes.data.taskId) {
            const taskId = taskRes.data.taskId;
            
            // Vòng lặp chờ AI giải xong và trả về kết quả mã xác thực (Token)
            while (true) {
                await new Promise(resolve => setTimeout(resolve, 3000)); // Đợi 3 giây mỗi lần check
                const resultRes = await axios.post('https://capsolver.com', {
                    clientKey: API_KEY_CAPSOLVER,
                    taskId: taskId
                });

                if (resultRes.data.status === "ready") {
                    console.log("✅ AI đã giải Captcha thành công!");
                    return resultRes.data.solution.token; // Trả về mã xác thực để nộp cho Delta
                }
                if (resultRes.data.status === "failed") {
                    return null;
                }
                console.log("⏳ AI vẫn đang tính toán giải mã...");
            }
        }
    } catch (error) {
        console.error("❌ Lỗi khi gọi hệ thống giải Captcha:", error.message);
        return null;
    }
}

/**
 * Hàm chính điều khiển trình duyệt ngầm thực hiện bypass lấy key
 */
async function botBypassDelta(deltaUrl) {
    console.log("🚀 Bot đang khởi động trình duyệt ngầm để thực hiện bypass...");
    
    // Khởi chạy trình duyệt ẩn danh (Headless Browser) giả lập người dùng thật
    const browser = await puppeteer.launch({
        headless: true, // Đổi thành false nếu bạn muốn tận mắt nhìn thấy trình duyệt tự bật lên bấm click
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Cấu hình User-Agent giống hệt một người dùng lướt web trên Windows bằng Chrome
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        // Bước 1: Bot tự truy cập vào đường link Delta gốc
        console.log(`🌐 Bot đang truy cập vào trang lấy key...`);
        await page.goto(deltaUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Bước 2: Kiểm tra và xử lý nếu trang web bắt giải Captcha
        // Tìm khóa SiteKey của Cloudflare ẩn trên trang web Platoboost
        const cloudflareSiteKey = await page.evaluate(() => {
            const element = document.querySelector('.cf-turnstile') || document.querySelector('[data-sitekey]');
            return element ? element.getAttribute('data-sitekey') : null;
        });

        if (cloudflareSiteKey && API_KEY_CAPSOLVER !== "DÁN_API_KEY_GIẢI_CAPTCHA_CỦA_BẠN_VÀO_ĐÂY") {
            const currentUrl = page.url();
            const captchaToken = await thueGiaiCaptcha(currentUrl, cloudflareSiteKey);
            
            if (captchaToken) {
                // Nhúng mã giải captcha thành công vào ô xử lý ngầm của trang web
                await page.evaluate((token) => {
                    if (typeof cfStartTurnstile === 'function') {
                        cfStartTurnstile(token);
                    } else {
                        // Điền token vào các thẻ input ẩn của Cloudflare
                        const input = document.querySelector('[name="cf-turnstile-response"]');
                        if (input) input.value = token;
                    }
                }, captchaToken);
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Bước 3: Giả lập chờ đợi 5 giây y hệt như code mẫu trong tài liệu gốc của bạn
        console.log("⏳ Đang đợi hệ thống đếm ngược 5 giây quảng cáo theo quy định...");
        await new Promise(resolve => setTimeout(resolve, 5500));

        // Bước 4: Bot tự động quét tìm nút bấm Chuyển hướng hoặc nút Nhận Key trên màn hình để click
        console.log("🎯 Bot đang tìm nút bấm nhận Key...");
        await page.evaluate(() => {
            // Tìm tất cả các nút có chữ liên quan đến nhận key hoặc đi tiếp
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const targetButton = buttons.find(btn => 
                btn.textContent.toLowerCase().includes('get key') || 
                btn.textContent.toLowerCase().includes('continue') ||
                btn.textContent.toLowerCase().includes('submit')
            );
            if (targetButton) targetButton.click(); // Bot tự click bằng máy
        });

        // Chờ trang tải sau khi click
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

        // Bước 5: Bóc tách mã Key xuất hiện trên màn hình kết quả
        console.log("🔍 Đang đọc kết quả mã Key trả về...");
        const ketQuaKey = await page.evaluate(() => {
            // Tìm đoạn chữ hiển thị Key dạng chuỗi trên màn hình
            return document.body.innerText; 
        });

        await browser.close();
        return ketQuaKey;

    } catch (error) {
        await browser.close();
        return `❌ Trình duyệt gặp lỗi khi xử lý: ${error.message}`;
    }
}

// Chạy thực thi bot
botBypassDelta(LINK_DELTA_CUA_BAN).then(result => {
    console.log("\n================ KẾT QUẢ BYPASS ================");
    console.log(result);
    console.log("================================================\n");
});
