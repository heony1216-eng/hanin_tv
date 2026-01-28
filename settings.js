// 세계시간 TV - 설정 페이지 (Supabase 연동 + Storage)

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

    // 상태
    let photos = [];
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
            intervalInput.value = intervalSeconds;
            renderPhotoList();
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
            photos: photos
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
    }

    // 시작
    init();
})();
