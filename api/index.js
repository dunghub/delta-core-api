const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Endpoint xử lý bypass cho hệ thống của bạn
app.get('/api/bypass', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ 
            success: false, 
            error: "Thiếu tham số 'url' cần bypass." 
        });
    }

    try {
        // Mã hóa URL đúng cú pháp JavaScript để truyền vào API xử lý bên dưới
        const encodedUrl = encodeURIComponent(targetUrl);
        
        // Bạn có thể thay đổi endpoint này thành hệ thống giải mã thực tế của bạn
        // Ví dụ: `https://mualink.com{encodedUrl}`
        const response = await axios.get(`https://uneti-bot.xyz{encodedUrl}`, {
            timeout: 10000 // Tự động ngắt sau 10 giây nếu server nghẽn
        });

        return res.json({
            success: true,
            result: response.data.result || "Bypass thành công!"
        });

    } catch (error) {
        // Bắt lỗi hệ thống mạng và trả về log chi tiết thay vì làm sập bot
        return res.status(500).json({
            success: false,
            error: "Bypass thất bại [Platoboost]",
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server của bạn đang chạy mượt mà tại cổng ${PORT}`);
});
