// Vercel Serverless Function: cập nhật số liệu kênh từ YouTube API vào bảng `channels` trên Supabase
// Cập nhật: subscribers, subscribers_formatted, videos_count, view_count (+ updated_at)
//
// Biến môi trường (đặt trong Vercel > Settings > Environment Variables, KHÔNG ghi vào code):
//   YOUTUBE_API_KEY            - API key YouTube Data API v3
//   SUPABASE_URL               - https://yxcuzeielhdmsqlydiak.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  - khóa ghi dữ liệu (khuyên dùng). Nếu không có sẽ dùng SUPABASE_KEY
//   SUPABASE_KEY               - publishable key (chỉ ghi được khi RLS còn mở)
//   CRON_SECRET                - chuỗi bí mật; Vercel Cron tự gửi "Authorization: Bearer <CRON_SECRET>"

const YT_URL = 'https://www.googleapis.com/youtube/v3/channels';

// 375000000 -> "375M", 3800000 -> "3.8M", 3000000 -> "3.0M", 500000 -> "500K"
function formatCount(n) {
  const fmt = (v, unit) => `${v >= 100 ? v.toFixed(0) : v.toFixed(1)}${unit}`;
  if (n >= 1e9) return fmt(n / 1e9, 'B');
  if (n >= 1e6) return fmt(n / 1e6, 'M');
  if (n >= 1e3) return fmt(n / 1e3, 'K');
  return String(n);
}

module.exports = async (req, res) => {
  const { YOUTUBE_API_KEY, SUPABASE_URL, CRON_SECRET } = process.env;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (!CRON_SECRET) return res.status(500).json({ error: 'Thiếu CRON_SECRET' });
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!YOUTUBE_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Thiếu YOUTUBE_API_KEY / SUPABASE_URL / SUPABASE_KEY' });
  }

  const sb = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };

  // 1. Lấy danh sách id kênh
  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/channels?select=id`, { headers: sb });
  if (!listRes.ok) {
    return res.status(500).json({ error: `Supabase đọc lỗi ${listRes.status}: ${await listRes.text()}` });
  }
  const ids = (await listRes.json()).map((r) => r.id);
  const result = { total: ids.length, updated: 0, skipped: [], errors: [] };

  // 2. YouTube cho phép tối đa 50 id mỗi lần gọi
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const ytRes = await fetch(`${YT_URL}?part=statistics&id=${batch.join(',')}&key=${YOUTUBE_API_KEY}`);
    if (!ytRes.ok) {
      result.errors.push(`YouTube API ${ytRes.status}: ${(await ytRes.text()).slice(0, 200)}`);
      continue;
    }
    const json = await ytRes.json();
    const found = new Set();

    for (const item of json.items || []) {
      found.add(item.id);
      const s = item.statistics || {};
      const update = {
        videos_count: Number(s.videoCount || 0),
        view_count: Number(s.viewCount || 0),
        updated_at: new Date().toISOString(),
      };
      // Kênh ẩn số subscriber thì giữ nguyên giá trị cũ
      if (!s.hiddenSubscriberCount && s.subscriberCount !== undefined) {
        const subs = Number(s.subscriberCount);
        update.subscribers = subs;
        update.subscribers_formatted = formatCount(subs);
      }
      const up = await fetch(`${SUPABASE_URL}/rest/v1/channels?id=eq.${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { ...sb, Prefer: 'return=minimal' },
        body: JSON.stringify(update),
      });
      if (up.ok) result.updated++;
      else result.errors.push(`${item.id}: ${up.status} ${(await up.text()).slice(0, 150)}`);
    }
    for (const id of batch) if (!found.has(id)) result.skipped.push(id);
  }

  return res.status(result.errors.length ? 207 : 200).json(result);
};
