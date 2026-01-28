// Supabase 설정
// 아래 값들을 본인의 Supabase 프로젝트 정보로 변경하세요

const SUPABASE_URL = 'https://duezqoujpeoooyzucgvy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1ZXpxb3VqcGVvb295enVjZ3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NTk5NDgsImV4cCI6MjA4MzMzNTk0OH0.9cF2qa4HanWIjoNgqSs7PJELSDZny-vrS3n73t2ViDQ';

// Supabase 클라이언트 생성
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 데이터베이스 테이블명
const TABLE_NAME = 'tv_settings';

// ===== 데이터베이스 함수 =====

// 설정 불러오기
async function loadSettingsFromDB() {
    try {
        const { data, error } = await supabaseClient
            .from(TABLE_NAME)
            .select('*')
            .eq('id', 1)
            .single();

        if (error) {
            console.log('설정 로드 실패:', error.message);
            return null;
        }

        return data;
    } catch (e) {
        console.log('DB 연결 실패:', e);
        return null;
    }
}

// 설정 저장하기
async function saveSettingsToDB(settings) {
    try {
        const { data, error } = await supabaseClient
            .from(TABLE_NAME)
            .upsert({
                id: 1,
                interval_seconds: settings.intervalSeconds,
                photos: settings.photos,
                updated_at: new Date().toISOString()
            })
            .select();

        if (error) {
            console.log('설정 저장 실패:', error.message);
            return false;
        }

        return true;
    } catch (e) {
        console.log('DB 저장 실패:', e);
        return false;
    }
}

// 실시간 변경 감지 (TV 페이지용)
function subscribeToChanges(callback) {
    return supabaseClient
        .channel('tv_settings_changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: TABLE_NAME },
            (payload) => {
                console.log('설정 변경 감지:', payload);
                callback(payload.new);
            }
        )
        .subscribe();
}

// ===== Storage 함수 =====

const BUCKET_NAME = 'tv-photos';

// 이미지 업로드
async function uploadImageToStorage(file) {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `photos/${fileName}`;

        const { data, error } = await supabaseClient.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.log('업로드 실패:', error.message);
            return null;
        }

        // 공개 URL 생성
        const { data: urlData } = supabaseClient.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        return {
            path: filePath,
            url: urlData.publicUrl
        };
    } catch (e) {
        console.log('Storage 업로드 실패:', e);
        return null;
    }
}

// 이미지 삭제
async function deleteImageFromStorage(filePath) {
    try {
        // filePath가 없거나 URL만 있는 경우 (외부 URL) 스킵
        if (!filePath || filePath.startsWith('http')) {
            return true;
        }

        const { error } = await supabaseClient.storage
            .from(BUCKET_NAME)
            .remove([filePath]);

        if (error) {
            console.log('삭제 실패:', error.message);
            return false;
        }

        return true;
    } catch (e) {
        console.log('Storage 삭제 실패:', e);
        return false;
    }
}
