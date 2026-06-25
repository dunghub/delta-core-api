const axios = require('axios');
const cheerio = require('cheerio'); // Thư viện bóc tách thẻ script động được khai báo trong package.json

module.exports = async (req, res) => {
    // 1. Cấu hình các Header CORS bắt buộc để Bot nhận được dữ liệu JSON
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

    try {
        // LUỒNG 1: Trích xuất mã ID (HWID) từ chuỗi URL Delta người dùng nhập vào
        const parsedUrl = new URL(targetUrl);
        const deltaId = parsedUrl.searchParams.get('d') || parsedUrl.searchParams.get('id');
        
        if (!deltaId) {
            return res.status(400).json({ success: false, message: "Định dạng link Delta không hợp lệ (Thiếu tham số mã hóa id hoặc d)" });
        }

        // LUỒNG 2: Giả lập gửi gói tin POST xác thực thẳng đến cổng API nội bộ của Platoboost
        // Thay vì xem quảng cáo, code sẽ dùng chính tham số d để "Claim" Key trực tiếp từ hệ thống của họ
        const bypassHeaders = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, Gecko) Chrome/124.0.0.0 Mobile Safari/537.36', // Ép vân tay trình duyệt điện thoại Android
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
            'Content-Type': 'application/json',
            'Origin': 'https://auth.platorelay.com',
            'Referer': targetUrl, // Gán link gốc làm trang chuyển hướng hợp lệ để vượt kiểm tra tường lửa
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'X-Requested-With': 'XMLHttpRequest'
        };

        let foundKey = "";

        try {
            // Gửi lệnh POST nạp dữ liệu phiên trực tiếp để yêu cầu cấp mã Token của Delta
            const authResponse = await axios.post('https://platorelay.com', {
                data: deltaId
            }, { 
                headers: bypassHeaders,
                timeout: 7000 // Chờ tối đa 7 giây để tránh quá tải bộ nhớ Vercel
            });

            if (authResponse.data && authResponse.data.key) {
                foundKey = authResponse.data.key;
            } else if (authResponse.data && authResponse.data.token) {
                foundKey = authResponse.data.token;
            }
        } catch (postError) {
            console.log("Cổng POST bị thắt chặt, chuyển hướng sang luồng bóc tách Token script...");
        }

        // LUỒNG 3 (Dự phòng độc lập): Nếu cổng POST Claim bị chặn, cào thẳng HTML của trang xác thực
        // Sử dụng Cheerio để tìm kiếm các hàm sinh mã Key chạy ẩn dưới nền JavaScript của Client
        if (!foundKey) {
            const htmlResponse = await axios.get(targetUrl, { 
                headers: { 'User-Agent': bypassHeaders['User-Agent'] },
                timeout: 5000 
            });
            
            const $ = cheerio.load(htmlResponse.data);
            const htmlContent = htmlResponse.data;

            // Tìm trong tất cả các thẻ Script xem có biến lưu trữ key động không
            $('script').each((index, element) => {
                const scriptText = $(element).html();
                if (scriptText && (scriptText.includes('key') || scriptText.includes('token'))) {
                    const match = scriptText.match(/"key"\s*:\s*"([A-Za-z0-9_\-]+)"/) || scriptText.match(/token\s*=\s*'([A-Za-z0-9_\-]+)'/);
                    if (match && match[1]) {
                        foundKey = match[1];
                    }
                }
            });

            // Nếu quét thẻ con không ra, dùng Regex bốc tách chuỗi ký tự thô trên toàn bộ HTML toàn văn
            if (!foundKey) {
                const globalMatch = htmlContent.match(/🔑\s*Key\s*:\s*([A-Za-z0-9_\-]+)/) || 
                                    htmlContent.match(/Your\s*Key\s*:\s*([A-Za-z0-9_\-]+)/) ||
                                    htmlContent.match(/"key"\s*:\s*"([A-Za-z0-9_\-]+)"/);
                if (globalMatch && globalMatch[1]) foundKey = globalMatch[1];
            }
        }

        // 4. Kiểm tra dữ liệu thu được cuối cùng và trả kết quả sạch về cho bot.js
        if (foundKey && foundKey.length > 5 && !foundKey.includes("{")) {
            return res.status(200).json({ 
                success: true, 
                key: foundKey.trim(),
                method: "Bypass Private Cloud Clean"
            });
        }

        return res.status(400).json({ 
            success: false, 
            message: "Tường lửa Platoboost đã làm mới Token bảo mật. Vui lòng lấy liên kết mới tinh từ Roblox để bot chạy lại!" 
        });

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: `Lỗi luồng xử lý dữ liệu API độc lập: ${error.message}` 
        });
    }
};
