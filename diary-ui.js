window.STDiary = window.STDiary || {};

window.STDiary.UI = (function() {
    'use strict';

    let isOpen = false;
    let currentPage = 0;
    let isBookOpen = false;

    function init() {
        createDiaryElement();
        window.STDiary.Utils.log('UI Module Initialized.');
    }

    function createDiaryElement() {
        if ($('#st-diary-container').length > 0) return;

        const html = `
            <div class="st-diary-overlay" id="st-diary-overlay"></div>
            <div id="st-diary-container">
                <div class="st-diary-book" id="st-diary-book">
                    <!-- 표지 -->
                    <div class="st-diary-cover" id="st-diary-cover">
                        <div class="st-diary-cover-decoration">
                            <div class="st-diary-cover-title">DIARY</div>
                            <div class="st-diary-cover-line"></div>
                            <div class="st-diary-cover-subtitle">click to open</div>
                        </div>
                    </div>
                    
                    <!-- 페이지 영역 -->
                    <div class="st-diary-pages" id="st-diary-pages">
                        <div class="st-diary-page-left" id="st-diary-page-left"></div>
                        <div class="st-diary-page-right" id="st-diary-page-right"></div>
                    </div>
                    
                    <!-- 페이지 넘김 영역 (투명 클릭존) -->
                    <div class="st-diary-page-turn left" id="st-diary-turn-left"></div>
                    <div class="st-diary-page-turn right" id="st-diary-turn-right"></div>
                    
                    <!-- 페이지 인디케이터 -->
                    <div class="st-diary-page-dots" id="st-diary-page-dots"></div>
                    
                    <!-- 닫기 버튼 -->
                    <button class="st-diary-close-btn" id="st-diary-close">
                        <i class="fa-solid fa-times"></i>
                    </button>
                    
                    <!-- 설정 버튼 -->
                    <button class="st-diary-settings-btn" id="st-diary-settings-btn">
                        <i class="fa-solid fa-cog"></i>
                    </button>
                </div>
            </div>
        `;

        $('body').append(html);
        attachListeners();
    }

    function attachListeners() {
        $('#st-diary-overlay').on('click', closeDiary);
        $('#st-diary-close').on('click', closeDiary);
        $('#st-diary-cover').on('click', toggleBook);
        
        // 페이지 넘김 (클릭 영역)
        $('#st-diary-turn-left').on('click', () => navigatePage(-1));
        $('#st-diary-turn-right').on('click', () => navigatePage(1));
        
        // 설정 버튼
        $('#st-diary-settings-btn').on('click', showSettingsModal);
    }

    function toggleDiary() {
        if (isOpen) {
            closeDiary();
        } else {
            openDiary();
        }
    }

    function openDiary() {
        isOpen = true;
        $('#st-diary-overlay').addClass('active');
        $('#st-diary-container').addClass('active');
        
        if (window.STDiary && window.STDiary.Main) {
            window.STDiary.Main.refreshDiary();
        }
    }

    function closeDiary() {
        isOpen = false;
        isBookOpen = false;
        $('#st-diary-overlay').removeClass('active');
        $('#st-diary-container').removeClass('active');
        $('#st-diary-book').removeClass('open');
    }

    function toggleBook() {
        isBookOpen = !isBookOpen;
        
        if (isBookOpen) {
            $('#st-diary-book').addClass('open');
            setTimeout(() => {
                renderCurrentPage();
                updatePageDots();
            }, 300);
        } else {
            $('#st-diary-book').removeClass('open');
        }
    }

    function navigatePage(direction) {
        const entries = getEntries();
        const maxPage = Math.max(0, entries.length - 1);
        
        currentPage = Math.max(0, Math.min(maxPage, currentPage + direction));
        renderCurrentPage();
        updatePageDots();
    }

    function getEntries() {
        if (window.STDiary && window.STDiary.Main) {
            return window.STDiary.Main.getEntries();
        }
        return [];
    }

    function updatePageDots() {
        const entries = getEntries();
        const totalPages = entries.length;
        
        if (totalPages <= 1) {
            $('#st-diary-page-dots').html('');
            return;
        }
        
        let dotsHtml = '';
        for (let i = 0; i < totalPages; i++) {
            dotsHtml += `<span class="st-diary-dot ${i === currentPage ? 'active' : ''}" data-page="${i}"></span>`;
        }
        
        $('#st-diary-page-dots').html(dotsHtml);
        
        // 점 클릭으로 페이지 이동
        $('.st-diary-dot').on('click', function() {
            currentPage = $(this).data('page');
            renderCurrentPage();
            updatePageDots();
        });
    }

    function renderCurrentPage() {
        const entries = getEntries();
        const totalPages = entries.length;
        
        // 페이지 넘김 영역 활성화/비활성화
        $('#st-diary-turn-left').toggleClass('disabled', currentPage <= 0);
        $('#st-diary-turn-right').toggleClass('disabled', currentPage >= totalPages - 1);
        
        if (totalPages === 0) {
            renderEmptyPage();
            return;
        }
        
        const entry = entries[currentPage];
        renderEntry(entry);
    }

    function renderEmptyPage() {
        const leftPage = `
            <div class="st-diary-empty">
                <div class="st-diary-empty-icon">📝</div>
                <div class="st-diary-empty-text">아직 일기가 없어요</div>
                <div class="st-diary-empty-hint">RP 속 날짜가 바뀌면<br>AI가 자동으로 일기를 써줄 거예요</div>
            </div>
        `;
        
        const rightPage = `
            <div class="st-diary-empty">
                <div class="st-diary-empty-icon">✨</div>
                <div class="st-diary-empty-text">새로운 이야기를 시작해보세요</div>
            </div>
        `;
        
        $('#st-diary-page-left').html(leftPage);
        $('#st-diary-page-right').html(rightPage);
    }

    function renderEntry(entry) {
        if (!entry) {
            renderEmptyPage();
            return;
        }

        // 왼쪽 페이지 (사진)
        let photoContent;
        if (entry.imageUrl) {
            photoContent = `
                <div class="st-diary-photo-area">
                    <img src="${entry.imageUrl}" alt="diary photo">
                </div>
                <div class="st-diary-photo-caption">${entry.imageCaption || ''}</div>
            `;
        } else {
            photoContent = `
                <div class="st-diary-photo-area">
                    <div class="st-diary-photo-placeholder">
                        <i class="fa-solid fa-image"></i>
                        <div>No Photo</div>
                    </div>
                </div>
            `;
        }

        const leftPage = `
            <div class="st-diary-date">${window.STDiary.Utils.formatDate(entry.date)}</div>
            ${photoContent}
        `;

        // 오른쪽 페이지 (글)
        const fontClass = getFontClass(entry.fontStyle || 'elegant');
        const rightPage = `
            <div class="st-diary-date">${entry.weather || '☀️'} ${entry.mood || ''}</div>
            <div class="st-diary-content ${fontClass}">${entry.content || '내용 없음'}</div>
        `;

        $('#st-diary-page-left').html(leftPage);
        $('#st-diary-page-right').html(rightPage);
    }

    function getFontClass(style) {
        const fontMap = {
            'elegant': 'st-diary-font-elegant',
            'vintage': 'st-diary-font-vintage',
            'dreamy': 'st-diary-font-dreamy',
            'passionate': 'st-diary-font-passionate',
            'whisper': 'st-diary-font-whisper',
            'artistic': 'st-diary-font-artistic',
            'melancholy': 'st-diary-font-melancholy',
            'playful': 'st-diary-font-playful'
        };
        return fontMap[style] || 'st-diary-font-elegant';
    }

    function showLoading(message = '일기를 쓰는 중...') {
        const loadingHtml = `
            <div class="st-diary-loading">
                <div class="st-diary-loading-spinner"></div>
                <div class="st-diary-loading-text">${message}</div>
            </div>
        `;
        
        $('#st-diary-page-left').html(loadingHtml);
        $('#st-diary-page-right').html(loadingHtml);
    }

    function showSettingsModal() {
        const globalSettings = window.STDiary.Utils.loadGlobalSettings();
        const characterAppearances = globalSettings.characterAppearances || [];
        const contextTokens = globalSettings.contextTokens || 30000;

        // 캐릭터 목록 HTML 생성
        const characterListHtml = characterAppearances.map((char, index) => `
            <div class="st-diary-char-item" data-index="${index}">
                <div class="st-diary-char-info">
                    <div class="st-diary-char-name">${char.name}</div>
                    <div class="st-diary-char-tags">${char.tags.substring(0, 50)}${char.tags.length > 50 ? '...' : ''}</div>
                </div>
                <div class="st-diary-char-actions">
                    <button class="st-diary-char-edit" data-index="${index}"><i class="fa-solid fa-pen"></i></button>
                    <button class="st-diary-char-delete" data-index="${index}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `).join('');

        const modalHtml = `
            <div class="st-diary-modal-overlay" id="st-diary-modal-overlay"></div>
            <div class="st-diary-settings-modal" id="st-diary-settings-modal">
                <div class="st-diary-settings-title">⚙️ 일기장 설정</div>
                
                <div class="st-diary-settings-section">
                    <div class="st-diary-settings-section-title">기본 설정</div>
                    
                    <div class="st-diary-settings-option">
                        <span class="st-diary-settings-label">자동 일기 작성</span>
                        <div class="st-diary-settings-toggle ${globalSettings.autoWrite !== false ? 'active' : ''}" 
                             data-setting="autoWrite"></div>
                    </div>
                    
                    <div class="st-diary-settings-option">
                        <span class="st-diary-settings-label">이미지 자동 생성</span>
                        <div class="st-diary-settings-toggle ${globalSettings.includePhoto !== false ? 'active' : ''}" 
                             data-setting="includePhoto"></div>
                    </div>
                </div>
                
                <div class="st-diary-settings-section">
                    <div class="st-diary-settings-section-title">컨텍스트 설정</div>
                    <div class="st-diary-settings-hint">일기 작성 시 AI에게 보낼 채팅 기록의 최대 토큰 수</div>
                    
                    <div class="st-diary-settings-option">
                        <span class="st-diary-settings-label">컨텍스트 크기 (토큰)</span>
                        <input type="number" id="st-diary-context-tokens" class="st-diary-token-input" 
                               value="${contextTokens}" min="1000" max="200000" step="1000">
                    </div>
                </div>
                
                <div class="st-diary-settings-section">
                    <div class="st-diary-settings-section-title">
                        캐릭터 외형 태그
                        <button id="st-diary-add-char" class="st-diary-add-btn"><i class="fa-solid fa-plus"></i> 추가</button>
                    </div>
                    <div class="st-diary-settings-hint">이미지 생성 시 캐릭터 외형 태그가 자동으로 포함됩니다</div>
                    
                    <div class="st-diary-char-list" id="st-diary-char-list">
                        ${characterListHtml || '<div class="st-diary-char-empty">등록된 캐릭터가 없습니다</div>'}
                    </div>
                </div>
                
                <div class="st-diary-settings-close-wrap">
                    <button id="st-diary-settings-close">닫기</button>
                </div>
            </div>
        `;

        $('#st-diary-settings-modal, #st-diary-modal-overlay').remove();
        $('body').append(modalHtml);

        // 컨텍스트 토큰 변경 이벤트
        $('#st-diary-context-tokens').on('change', function() {
            const value = parseInt($(this).val()) || 30000;
            window.STDiary.Utils.setContextTokens(value);
            toastr.info(`컨텍스트 크기가 ${value.toLocaleString()} 토큰으로 설정되었습니다.`);
        });

        // 토글 클릭 이벤트
        $('.st-diary-settings-toggle').on('click', function() {
            $(this).toggleClass('active');
            const setting = $(this).data('setting');
            const value = $(this).hasClass('active');
            
            const global = window.STDiary.Utils.loadGlobalSettings();
            global[setting] = value;
            window.STDiary.Utils.saveGlobalSettings(global);
            
            toastr.info('설정이 변경되었습니다.');
        });

        // 캐릭터 추가 버튼
        $('#st-diary-add-char').on('click', function() {
            showCharacterEditModal();
        });

        // 캐릭터 편집 버튼
        $('.st-diary-char-edit').on('click', function() {
            const index = $(this).data('index');
            showCharacterEditModal(index);
        });

        // 캐릭터 삭제 버튼
        $('.st-diary-char-delete').on('click', function() {
            const index = $(this).data('index');
            const global = window.STDiary.Utils.loadGlobalSettings();
            const charName = global.characterAppearances[index]?.name;
            
            if (confirm(`'${charName}' 캐릭터를 삭제하시겠습니까?`)) {
                window.STDiary.Utils.removeCharacterAppearance(charName);
                toastr.success('캐릭터가 삭제되었습니다.');
                showSettingsModal(); // 새로고침
            }
        });

        // 닫기
        $('#st-diary-settings-close, #st-diary-modal-overlay').on('click', function() {
            $('#st-diary-settings-modal, #st-diary-modal-overlay').remove();
        });
    }

    // 캐릭터 외형 편집 모달
    function showCharacterEditModal(editIndex = null) {
        const global = window.STDiary.Utils.loadGlobalSettings();
        const isEdit = editIndex !== null;
        const charData = isEdit ? global.characterAppearances[editIndex] : { name: '', tags: '' };
        
        // 현재 캐릭터 이름 자동 입력
        const currentCharName = window.STDiary.Utils.getCurrentCharacterName();
        const defaultName = isEdit ? charData.name : currentCharName;

        const editModalHtml = `
            <div class="st-diary-char-edit-modal" id="st-diary-char-edit-modal">
                <div class="st-diary-char-edit-title">${isEdit ? '캐릭터 수정' : '캐릭터 추가'}</div>
                
                <div class="st-diary-char-edit-field">
                    <label>캐릭터 이름</label>
                    <input type="text" id="st-diary-char-name-input" value="${defaultName}" 
                           placeholder="예: Alice">
                </div>
                
                <div class="st-diary-char-edit-field">
                    <label>외형 태그 (영문, 쉼표로 구분)</label>
                    <textarea id="st-diary-char-tags-input" rows="4" 
                              placeholder="예: blonde hair, blue eyes, white dress, young woman, beautiful">${charData.tags}</textarea>
                </div>
                
                <div class="st-diary-char-edit-hint">
                    💡 팁: 머리색, 눈색, 옷차림, 나이대, 특징 등을 영어로 입력하세요
                </div>
                
                <div class="st-diary-char-edit-buttons">
                    <button id="st-diary-char-cancel">취소</button>
                    <button id="st-diary-char-save" class="primary">${isEdit ? '수정' : '추가'}</button>
                </div>
            </div>
        `;

        $('#st-diary-char-edit-modal').remove();
        $('body').append(editModalHtml);

        // 저장
        $('#st-diary-char-save').on('click', function() {
            const name = $('#st-diary-char-name-input').val().trim();
            const tags = $('#st-diary-char-tags-input').val().trim();
            
            if (!name) {
                toastr.warning('캐릭터 이름을 입력해주세요.');
                return;
            }
            if (!tags) {
                toastr.warning('외형 태그를 입력해주세요.');
                return;
            }

            window.STDiary.Utils.setCharacterAppearance(name, tags);
            toastr.success(`'${name}' 캐릭터가 ${isEdit ? '수정' : '추가'}되었습니다.`);
            
            $('#st-diary-char-edit-modal').remove();
            showSettingsModal(); // 메인 설정창 새로고침
        });

        // 취소
        $('#st-diary-char-cancel').on('click', function() {
            $('#st-diary-char-edit-modal').remove();
        });
    }

    function setCurrentPage(index) {
        const entries = getEntries();
        currentPage = Math.max(0, Math.min(entries.length - 1, index));
    }

    function goToLatestEntry() {
        const entries = getEntries();
        if (entries.length > 0) {
            currentPage = entries.length - 1;
            if (isBookOpen) {
                renderCurrentPage();
                updatePageDots();
            }
        }
    }

    return {
        init,
        toggleDiary,
        openDiary,
        closeDiary,
        toggleBook,
        renderCurrentPage,
        showLoading,
        setCurrentPage,
        goToLatestEntry,
        isOpen: () => isOpen,
        isBookOpen: () => isBookOpen
    };

})();

$(document).ready(function() {
    setTimeout(() => {
        if (window.STDiary && window.STDiary.UI) {
            window.STDiary.UI.init();
        }
    }, 100);
});
