# YouTuber Ranking

Website xếp hạng kênh YouTube (HTML + Supabase), có API tự động cập nhật số liệu từ YouTube.

- `index.html`, `profile.html`: giao diện (đọc dữ liệu từ bảng `channels` trên Supabase)
- `api/update-youtube-stats.js`: Vercel Serverless Function cập nhật `subscribers`, `subscribers_formatted`, `videos_count`, `view_count`
- `vercel.json`: Vercel Cron gọi API mỗi ngày lúc 02:00 UTC (09:00 giờ Việt Nam)

## Biến môi trường (đặt trên Vercel, không commit)
`YOUTUBE_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY` (hoặc `SUPABASE_SERVICE_ROLE_KEY`), `CRON_SECRET`
