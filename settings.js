// 세계시간 TV - 설정 페이지 (Supabase 연동 + Storage + YouTube)

(function() {
    // DOM 요소
    const intervalInput = document.getElementById('interval-input');
    const saveIntervalBtn = document.getElementById('save-interval-btn');
    const photoUrlInput = document.getElementById('photo-url-input');
    const addUrlBtn = document.getElementById('add-url-btn');
    const photoFileInput = document.getElementById('photo-file-input');
    const addFileBtn = document.getElementById('add-file-btn');
    const photoList = document.getElementById('photo-list');
    const noPhotosMsg = document.getElementById('no-photos-msg');
    const previewBox = document.getElementById('preview-box');
    const syncStatus = document.getElementById('sync-status');
    const photoCount = document.getElementById('photo-count');
    const tvUrlEl = document.getElementById('tv-url');
    const copyUrlBtn = document.getElementById('copy-url-btn');

    // YouTube DOM 요소
    const youtubeUrlInput = document.getElementById('youtube-url-input');
    const addYoutubeBtn = document.getElementById('add-youtube-btn');
    const youtubeList = document.getElementById('youtube-list');
    const noYoutubeMsg = document.getElementById('no-youtube-msg');
    const youtubeCount = document.getElementById('youtube-count');

    // BGM DOM 요소
    const bgmUrlInput = document.getElementById('bgm-url-input');
    const setBgmBtn = document.getElementById('set-bgm-btn');
    const removeBgmBtn = document.getElementById('remove-bgm-btn');
    const bgmCurrent = document.getElementById('bgm-current');

    // 상태
    let photos = [];
    let youtubeVideos = [];
    let bgmUrl = '';
    let intervalSeconds = 15;

    // 초기화
    async function init() {
        updateTvUrl();
        await loadSettings();
        setupEventListeners();
    }

    // TV URL 표시 (GitHub Pages 대응)
    function updateTvUrl() {
        const currentUrl = window.location.href;
        const baseUrl = currentUrl.replace(/\/[^\/]*$/, '/');
        tvUrlEl.textContent = baseUrl + 'tv.html';
    }

    // 설정 불러오기
    async function loadSettings() {
        updateSyncStatus('로딩 중...', 'loading');

        const data = await loadSettingsFromDB();

        if (data) {
            intervalSeconds = data.interval_seconds || 15;
            photos = data.photos || [];
            youtubeVideos = data.youtube_videos || [];
            bgmUrl = data.bgm_url || '';
            intervalInput.value = intervalSeconds;
            renderPhotoList();
            renderYoutubeList();
            updateBgmStatus();
            updateSyncStatus('연결됨', 'connected');
        } else {
            // 첫 실행 - 기본값으로 DB에 저장
            await saveAllSettings();
            updateSyncStatus('연결됨 (새로 생성)', 'connected');
        }
    }

    // 모든 설정 저장
    async function saveAllSettings() {
        updateSyncStatus('저장 중...', 'loading');

        const success = await saveSettingsToDB({
            intervalSeconds: intervalSeconds,
            photos: photos,
            youtubeVideos: youtubeVideos,
            bgmUrl: bgmUrl
        });

        if (success) {
            updateSyncStatus('저장됨!', 'connected');
            setTimeout(() => updateSyncStatus('연결됨', 'connected'), 2000);
        } else {
            updateSyncStatus('저장 실패', 'error');
        }

        return success;
    }

    // 전환 간격 저장
    async function saveInterval() {
        const value = parseInt(intervalInput.value, 10);

        if (value < 3 || value > 300 || isNaN(value)) {
            alert('3초에서 300초 사이의 값을 입력해주세요.');
            return;
        }

        intervalSeconds = value;
        const success = await saveAllSettings();

        if (success) {
            alert(`전환 간격이 ${value}초로 저장되었습니다.\nTV에 실시간 반영됩니다.`);
        } else {
            alert('저장에 실패했습니다. 다시 시도해주세요.');
        }
    }

    // 파일로 사진 업로드
    async function addPhotosByFile() {
        const files = photoFileInput.files;

        if (!files || files.length === 0) {
            alert('이미지 파일을 선택해주세요.');
            return;
        }

        updateSyncStatus(`업로드 중... (0/${files.length})`, 'loading');

        let successCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (!file.type.startsWith('image/')) {
                continue;
            }

            updateSyncStatus(`업로드 중... (${i + 1}/${files.length})`, 'loading');

            const result = await uploadImageToStorage(file);

            if (result) {
                photos.push({
                    id: Date.now() + i,
                    url: result.url,
                    path: result.path,  // Storage 경로 저장 (삭제용)
                    type: 'storage'
                });
                successCount++;
            }
        }

        if (successCount > 0) {
            const success = await saveAllSettings();
            if (success) {
                renderPhotoList();
                photoFileInput.value = '';
                alert(`${successCount}장 업로드 완료!`);
            }
        } else {
            alert('업로드에 실패했습니다.');
            updateSyncStatus('연결됨', 'connected');
        }
    }

    // URL로 사진 추가
    async function addPhotoByUrl() {
        const url = photoUrlInput.value.trim();

        if (!url) {
            alert('이미지 URL을 입력해주세요.');
            return;
        }

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            alert('올바른 URL 형식이 아닙니다.\n(http:// 또는 https://로 시작해야 합니다)');
            return;
        }

        updateSyncStatus('이미지 확인 중...', 'loading');

        const isValid = await checkImageUrl(url);
        if (!isValid) {
            alert('이미지를 불러올 수 없습니다.\nURL을 확인해주세요.');
            updateSyncStatus('연결됨', 'connected');
            return;
        }

        photos.push({
            id: Date.now(),
            url: url,
            type: 'url'  // 외부 URL
        });

        const success = await saveAllSettings();

        if (success) {
            renderPhotoList();
            photoUrlInput.value = '';
            showPreview(url);
        } else {
            photos.pop();
            alert('저장에 실패했습니다.');
        }
    }

    // 이미지 URL 유효성 확인
    function checkImageUrl(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
            setTimeout(() => resolve(false), 5000);
        });
    }

    // 사진 삭제
    async function deletePhoto(id) {
        if (!confirm('이 사진을 삭제하시겠습니까?')) return;

        const index = photos.findIndex(p => p.id === id);
        if (index === -1) return;

        const photo = photos[index];
        updateSyncStatus('삭제 중...', 'loading');

        // Storage에 저장된 이미지면 Storage에서도 삭제
        if (photo.type === 'storage' && photo.path) {
            await deleteImageFromStorage(photo.path);
        }

        photos.splice(index, 1);
        const success = await saveAllSettings();

        if (success) {
            renderPhotoList();
            previewBox.innerHTML = '<p>사진을 클릭하면 미리보기가 표시됩니다</p>';
        } else {
            photos.splice(index, 0, photo);
            alert('삭제에 실패했습니다.');
        }
    }

    // 사진 목록 렌더링
    function renderPhotoList() {
        photoList.innerHTML = '';
        photoCount.textContent = photos.length;

        if (photos.length === 0) {
            noPhotosMsg.style.display = 'block';
            return;
        }

        noPhotosMsg.style.display = 'none';

        photos.forEach((photo, index) => {
            const item = document.createElement('div');
            item.className = 'photo-item';

            const img = document.createElement('img');
            img.src = photo.url;
            img.alt = `사진 ${index + 1}`;
            img.onerror = function() {
                this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><rect fill="%23333" width="100" height="60"/><text y="35" x="50" text-anchor="middle" fill="%23888" font-size="10">Error</text></svg>';
            };

            // 타입 표시 (Storage or URL)
            const badge = document.createElement('span');
            badge.className = 'photo-badge ' + (photo.type === 'storage' ? 'badge-storage' : 'badge-url');
            badge.textContent = photo.type === 'storage' ? 'Storage' : 'URL';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deletePhoto(photo.id);
            };

            item.appendChild(img);
            item.appendChild(badge);
            item.appendChild(deleteBtn);
            item.addEventListener('click', () => showPreview(photo.url));
            photoList.appendChild(item);
        });
    }

    // 미리보기 표시
    function showPreview(url) {
        previewBox.innerHTML = '';
        const img = document.createElement('img');
        img.src = url;
        img.alt = '미리보기';
        img.onerror = function() {
            previewBox.innerHTML = '<p>이미지를 불러올 수 없습니다</p>';
        };
        previewBox.appendChild(img);
    }

    // 동기화 상태 업데이트
    function updateSyncStatus(text, status) {
        syncStatus.textContent = text;
        syncStatus.className = 'sync-status ' + status;
    }

    // URL 복사
    function copyTvUrl() {
        const url = tvUrlEl.textContent;
        navigator.clipboard.writeText(url).then(() => {
            const originalText = copyUrlBtn.textContent;
            copyUrlBtn.textContent = '복사됨!';
            setTimeout(() => {
                copyUrlBtn.textContent = originalText;
            }, 2000);
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = url;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('복사되었습니다: ' + url);
        });
    }

    // ===== YouTube 관련 함수 =====

    // YouTube URL에서 비디오 ID 추출
    function extractYoutubeId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
            /youtube\.com\/shorts\/([^&\?\/]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    // YouTube 동영상 추가
    async function addYoutubeVideo() {
        const url = youtubeUrlInput.value.trim();

        if (!url) {
            alert('YouTube URL을 입력해주세요.');
            return;
        }

        const videoId = extractYoutubeId(url);
        if (!videoId) {
            alert('올바른 YouTube URL이 아닙니다.\n(youtube.com 또는 youtu.be 링크를 입력해주세요)');
            return;
        }

        // 중복 체크
        if (youtubeVideos.some(v => v.videoId === videoId)) {
            alert('이미 추가된 동영상입니다.');
            return;
        }

        updateSyncStatus('추가 중...', 'loading');

        youtubeVideos.push({
            id: Date.now(),
            videoId: videoId,
            url: url
        });

        const success = await saveAllSettings();

        if (success) {
            renderYoutubeList();
            youtubeUrlInput.value = '';
            alert('YouTube 동영상이 추가되었습니다!');
        } else {
            youtubeVideos.pop();
            alert('저장에 실패했습니다.');
        }
    }

    // YouTube 동영상 삭제
    async function deleteYoutubeVideo(id) {
        if (!confirm('이 YouTube 동영상을 삭제하시겠습니까?')) return;

        const index = youtubeVideos.findIndex(v => v.id === id);
        if (index === -1) return;

        const video = youtubeVideos[index];
        updateSyncStatus('삭제 중...', 'loading');

        youtubeVideos.splice(index, 1);
        const success = await saveAllSettings();

        if (success) {
            renderYoutubeList();
        } else {
            youtubeVideos.splice(index, 0, video);
            alert('삭제에 실패했습니다.');
        }
    }

    // YouTube 목록 렌더링
    function renderYoutubeList() {
        youtubeList.innerHTML = '';
        youtubeCount.textContent = youtubeVideos.length;

        if (youtubeVideos.length === 0) {
            noYoutubeMsg.style.display = 'block';
            return;
        }

        noYoutubeMsg.style.display = 'none';

        youtubeVideos.forEach((video, index) => {
            const item = document.createElement('div');
            item.className = 'photo-item youtube-item';

            const thumbnail = document.createElement('img');
            thumbnail.src = `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;
            thumbnail.alt = `YouTube ${index + 1}`;

            const badge = document.createElement('span');
            badge.className = 'photo-badge badge-youtube';
            badge.textContent = 'YouTube';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteYoutubeVideo(video.id);
            };

            item.appendChild(thumbnail);
            item.appendChild(badge);
            item.appendChild(deleteBtn);

            // 클릭 시 새 탭에서 YouTube 열기
            item.addEventListener('click', () => {
                window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank');
            });

            youtubeList.appendChild(item);
        });
    }

    // ===== BGM 관련 함수 =====

    // BGM 설정
    async function setBgm() {
        const url = bgmUrlInput.value.trim();

        if (!url) {
            alert('YouTube URL을 입력해주세요.');
            return;
        }

        const videoId = extractYoutubeId(url);
        if (!videoId) {
            alert('올바른 YouTube URL이 아닙니다.');
            return;
        }

        updateSyncStatus('저장 중...', 'loading');
        bgmUrl = url;

        const success = await saveAllSettings();

        if (success) {
            updateBgmStatus();
            bgmUrlInput.value = '';
            alert('배경음악이 설정되었습니다!\nTV에서 재생됩니다.');
        } else {
            bgmUrl = '';
            alert('저장에 실패했습니다.');
        }
    }

    // BGM 삭제
    async function removeBgm() {
        if (!bgmUrl) {
            alert('설정된 배경음악이 없습니다.');
            return;
        }

        if (!confirm('배경음악을 삭제하시겠습니까?')) return;

        updateSyncStatus('삭제 중...', 'loading');
        const oldBgm = bgmUrl;
        bgmUrl = '';

        const success = await saveAllSettings();

        if (success) {
            updateBgmStatus();
            alert('배경음악이 삭제되었습니다.');
        } else {
            bgmUrl = oldBgm;
            alert('삭제에 실패했습니다.');
        }
    }

    // BGM 상태 업데이트
    function updateBgmStatus() {
        if (bgmUrl) {
            const videoId = extractYoutubeId(bgmUrl);
            bgmCurrent.innerHTML = `<a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">재생 중인 BGM 보기</a>`;
        } else {
            bgmCurrent.textContent = '없음';
        }
    }

    // 이벤트 리스너
    function setupEventListeners() {
        saveIntervalBtn.addEventListener('click', saveInterval);
        intervalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveInterval();
        });

        addFileBtn.addEventListener('click', addPhotosByFile);
        photoFileInput.addEventListener('change', () => {
            if (photoFileInput.files.length > 0) {
                addPhotosByFile();
            }
        });

        addUrlBtn.addEventListener('click', addPhotoByUrl);
        photoUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addPhotoByUrl();
        });

        copyUrlBtn.addEventListener('click', copyTvUrl);

        // YouTube 이벤트
        addYoutubeBtn.addEventListener('click', addYoutubeVideo);
        youtubeUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addYoutubeVideo();
        });

        // BGM 이벤트
        setBgmBtn.addEventListener('click', setBgm);
        removeBgmBtn.addEventListener('click', removeBgm);
        bgmUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') setBgm();
        });
    }

    // 시작
    init();
})();
