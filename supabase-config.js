/**
 * Cấu hình kết nối Supabase cho YouTuber Ranking
 * Thông số trích xuất từ file supabase.txt
 */
const SUPABASE_CONFIG = {
    url: 'https://yxcuzeielhdmsqlydiak.supabase.co',
    anonKey: 'sb_publishable_8wT0tEfiHwHn0l6fefXL5g_QhGhw290'
};

// Khởi tạo Supabase client nếu thư viện @supabase/supabase-js đã được nạp
let supabaseClient = null;
try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('[Supabase] Khởi tạo Supabase Client thành công:', SUPABASE_CONFIG.url);
    } else {
        console.warn('[Supabase] Thư viện @supabase/supabase-js chưa sẵn sàng.');
    }
} catch (e) {
    console.error('[Supabase] Lỗi khi tạo client:', e);
}

/**
 * Tải danh sách kênh từ bảng 'channels' trên Supabase
 * Tự động fallback sang CHANNELS_DATA nếu bảng rỗng, chưa mở RLS hoặc offline
 */
async function getChannelsData() {
    // Nếu chưa có client, dùng tạm dữ liệu local
    if (!supabaseClient) {
        return {
            source: 'local',
            data: window.CHANNELS_DATA || [],
            message: 'Dùng dữ liệu local (Supabase JS CDN chưa sẵn sàng)'
        };
    }

    try {
        const { data, error } = await supabaseClient
            .from('channels')
            .select('*')
            .order('subscribers', { ascending: false });

        if (error) {
            console.warn('[Supabase] Không thể đọc bảng channels:', error.message);
            return {
                source: 'local',
                data: window.CHANNELS_DATA || [],
                error: error.message,
                message: 'Supabase đang bật RLS (cần thêm policy SELECT). Đang hiển thị dữ liệu dự phòng.'
            };
        }

        if (data && data.length > 0) {
            console.log(`[Supabase] Đã lấy thành công ${data.length} kênh từ Supabase!`);
            return {
                source: 'supabase',
                data: data,
                message: `Đang kết nối Supabase trực tiếp (${data.length} kênh)`
            };
        } else {
            console.warn('[Supabase] Bảng channels hiện chưa có dòng nào.');
            return {
                source: 'empty_supabase',
                data: window.CHANNELS_DATA || [],
                message: 'Bảng channels trên Supabase hiện rỗng hoặc RLS chưa cấp quyền. Đang hiển thị 21 kênh mẫu.'
            };
        }
    } catch (err) {
        console.error('[Supabase] Ngoại lệ khi gọi Supabase API:', err);
        return {
            source: 'local',
            data: window.CHANNELS_DATA || [],
            error: err.message,
            message: 'Không thể kết nối Supabase, đang dùng dữ liệu dự phòng.'
        };
    }
}

/**
 * Lấy chi tiết 1 kênh theo ID từ Supabase hoặc fallback local
 */
async function getChannelDetail(id) {
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('channels')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (!error && data) {
                return { source: 'supabase', data: data };
            }
        } catch (e) {
            console.warn('[Supabase] Lỗi truy vấn chi tiết kênh:', e);
        }
    }

    // Fallback
    const local = (window.CHANNELS_DATA || []).find(c => c.id === id);
    return {
        source: 'local',
        data: local || (window.CHANNELS_DATA && window.CHANNELS_DATA[0]) || null
    };
}

/**
 * Đẩy toàn bộ 21 kênh từ dữ liệu mẫu lên Supabase (nếu RLS cho phép INSERT)
 */
async function syncLocalToSupabase() {
    if (!supabaseClient) {
        alert('Supabase client chưa sẵn sàng!');
        return;
    }
    try {
        const { data, error } = await supabaseClient
            .from('channels')
            .upsert(window.CHANNELS_DATA, { onConflict: 'id' });

        if (error) {
            alert('Lỗi đẩy dữ liệu lên Supabase: ' + error.message + '\n\nGợi ý: Hãy chạy SQL tắt RLS hoặc cấp quyền INSERT trên Supabase SQL Editor.');
        } else {
            alert('Đã đẩy thành công 21 kênh lên Supabase!');
            location.reload();
        }
    } catch (e) {
        alert('Lỗi: ' + e.message);
    }
}

window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.getChannelsData = getChannelsData;
window.getChannelDetail = getChannelDetail;
window.syncLocalToSupabase = syncLocalToSupabase;
