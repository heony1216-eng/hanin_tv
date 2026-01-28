# 세계시간 TV - 설정 가이드

## 1. Supabase 설정

### 1-1. Supabase 프로젝트 생성
1. [supabase.com](https://supabase.com)에 접속
2. 새 프로젝트 생성
3. 프로젝트 대시보드에서 **Settings > API** 메뉴로 이동
4. 다음 정보를 복사:
   - **Project URL** (예: `https://xxxxx.supabase.co`)
   - **anon public** 키

### 1-2. 데이터베이스 테이블 생성
Supabase 대시보드에서 **SQL Editor**로 이동 후 아래 SQL 실행:

```sql
-- tv_settings 테이블 생성
CREATE TABLE tv_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    interval_seconds INTEGER DEFAULT 15,
    photos JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- 초기 데이터 삽입
INSERT INTO tv_settings (id, interval_seconds, photos)
VALUES (1, 15, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- RLS (Row Level Security) 비활성화 (공개 접근용)
ALTER TABLE tv_settings DISABLE ROW LEVEL SECURITY;

-- 실시간 업데이트 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE tv_settings;
```

### 1-3. Storage 버킷 생성 (사진 업로드용)

1. Supabase 대시보드에서 **Storage** 메뉴로 이동
2. **New bucket** 클릭
3. 버킷 이름: `tv-photos`
4. **Public bucket** 체크 (중요!)
5. Create 클릭

또는 SQL Editor에서:
```sql
-- Storage 버킷 생성 (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tv-photos', 'tv-photos', true);

-- Storage 정책 설정 (모든 사용자 업로드/삭제 허용)
CREATE POLICY "Allow public uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'tv-photos');

CREATE POLICY "Allow public updates" ON storage.objects
FOR UPDATE USING (bucket_id = 'tv-photos');

CREATE POLICY "Allow public deletes" ON storage.objects
FOR DELETE USING (bucket_id = 'tv-photos');

CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT USING (bucket_id = 'tv-photos');
```

### 1-4. supabase-config.js 수정
`supabase-config.js` 파일을 열고 아래 값을 본인 프로젝트 정보로 변경:

```javascript
const SUPABASE_URL = 'https://your-project-id.supabase.co';  // 여기 수정
const SUPABASE_ANON_KEY = 'your-anon-key-here';  // 여기 수정
```

---

## 2. GitHub Pages 배포

### 2-1. GitHub 저장소 생성
1. GitHub에서 새 저장소 생성
2. 이 폴더의 모든 파일을 저장소에 업로드

### 2-2. GitHub Pages 활성화
1. 저장소 **Settings > Pages** 메뉴
2. Source: **Deploy from a branch**
3. Branch: **main** (또는 master), 폴더: **/ (root)**
4. Save 클릭

### 2-3. 배포 확인
몇 분 후 아래 URL에서 접속 가능:
```
https://your-username.github.io/your-repo-name/
```

---

## 3. 사용 방법

### PC/모바일에서 (설정용)
1. `https://your-site.github.io/your-repo/settings.html` 접속
2. **파일로 추가**: 이미지 파일 선택해서 Supabase Storage에 업로드
3. **URL로 추가**: 외부 이미지 URL 입력
4. 전환 시간(초) 설정

### TV에서 (표시용)
1. TV 브라우저에서 `https://your-site.github.io/your-repo/tv.html` 접속
2. 5초 후 자동 전체화면
3. 설정 변경 시 실시간 반영

---

## 파일 구조

```
반응형 TV/
├── index.html          # 메인 페이지 (안내)
├── tv.html             # TV 전용 화면
├── settings.html       # 설정 페이지
├── styles.css          # 스타일
├── settings.js         # 설정 페이지 로직
├── supabase-config.js  # Supabase 연결 설정
└── SETUP.md            # 이 문서
```

---

## 문제 해결

### "연결 실패" 메시지가 나오는 경우
- `supabase-config.js`의 URL과 키가 올바른지 확인
- Supabase 대시보드에서 테이블이 생성되었는지 확인

### 파일 업로드가 안 되는 경우
- Storage 버킷 `tv-photos`가 **Public**으로 설정되어 있는지 확인
- Storage 정책(Policy)이 올바르게 설정되어 있는지 확인

### TV에서 사진이 안 보이는 경우
- 이미지 URL이 HTTPS인지 확인
- Supabase Storage URL이 올바른지 확인

### 실시간 업데이트가 안 되는 경우
- SQL에서 `ALTER PUBLICATION supabase_realtime ADD TABLE tv_settings;` 실행했는지 확인
- Supabase 대시보드 > Database > Replication에서 tv_settings 테이블이 활성화되었는지 확인
