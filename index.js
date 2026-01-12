(function() {
    'use strict';

    const EXTENSION_NAME = 'ST Diary System';
    const EXTENSION_FOLDER = 'st-diary';
    const BASE_PATH = `/scripts/extensions/third-party/${EXTENSION_FOLDER}`;
    const MODULE_ID = 'st-diary-date-prompt';

    // 전역 네임스페이스
    window.STDiary = window.STDiary || {};

    // 프롬프트 주입 텍스트 (간결한 날짜 추적용)
    const DATE_PROMPT_INJECTION = `[System: Write the current in-story date at the start of your response: {{RP_DATE: YYYY년 MM월 DD일}}]`;

    // SillyTavern 컨텍스트 가져오기
    function getSTContext() {
        return window.SillyTavern?.getContext?.() || null;
    }

    function loadModule(fileName) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `${BASE_PATH}/${fileName}`;
            script.onload = () => {
                console.log(`[${EXTENSION_NAME}] Loaded: ${fileName}`);
                resolve();
            };
            script.onerror = (e) => reject(e);
            document.head.appendChild(script);
        });
    }

    async function initialize() {
        console.log(`[${EXTENSION_NAME}] Starting initialization...`);

        try {
            await loadModule('utils.js');
            await loadModule('diary-ui.js');
            await loadModule('diary-ai.js');
            await loadModule('diary-image.js');
            await loadModule('diary-main.js');

            setupKeyboardShortcut();
            addDiaryToggleButton();
            setupAiResponseObserver();
            
            // 프롬프트 주입 설정 (SillyTavern API 사용)
            setupPromptInjection();
            
            // 이벤트 리스너 설정 (채팅 변경 등)
            setupEventListeners();

            console.log(`[${EXTENSION_NAME}] Initialized! Press 'Z' to toggle diary.`);

        } catch (error) {
            console.error(`[${EXTENSION_NAME}] Initialization failed:`, error);
        }
    }
    
    // 현재 챗방 ID 추적
    let currentTrackedChatId = null;

    // SillyTavern 이벤트 리스너 설정
    function setupEventListeners() {
        const context = getSTContext();
        if (context && context.eventSource) {
            // 메시지가 생성될 때
            context.eventSource.on('message_received', () => {
                console.log(`[${EXTENSION_NAME}] Message received event`);
                // 약간의 딜레이 후 최신 메시지 확인
                setTimeout(() => {
                    const $lastMessage = $('#chat .mes[is_user="false"]').last();
                    if ($lastMessage.length) {
                        processAiMessage($lastMessage);
                    }
                }, 300);
            });
            
            // 채팅이 로드될 때 (챗방 변경 감지)
            context.eventSource.on('chatLoaded', () => {
                const newChatId = window.STDiary.Utils.getCurrentChatId();
                console.log(`[${EXTENSION_NAME}] Chat loaded: ${newChatId} (was: ${currentTrackedChatId})`);
                
                // 챗방이 변경되었으면 일기장 데이터 새로 로드
                if (newChatId !== currentTrackedChatId) {
                    currentTrackedChatId = newChatId;
                    console.log(`[${EXTENSION_NAME}] 📔 Chat changed! Loading diary for: ${newChatId}`);
                    
                    // Main 모듈 재초기화 (새 챗방의 일기 로드)
                    if (window.STDiary.Main && window.STDiary.Main.init) {
                        window.STDiary.Main.init();
                    }
                    
                    // UI가 열려있으면 새로고침
                    if (window.STDiary.UI && window.STDiary.UI.isOpen()) {
                        window.STDiary.UI.renderCurrentPage();
                    }
                    
                    // 알림
                    if (typeof toastr !== 'undefined') {
                        const entries = window.STDiary.Main ? window.STDiary.Main.getEntries() : [];
                        if (entries.length > 0) {
                            toastr.info(`📔 이전 일기 ${entries.length}개 로드됨`);
                        }
                    }
                }
                
                setupPromptInjection();
            });
            
            // 캐릭터 변경 시
            context.eventSource.on('characterSelected', () => {
                console.log(`[${EXTENSION_NAME}] Character selected`);
                // 캐릭터 변경 시에도 챗방 ID 체크
                setTimeout(() => {
                    const newChatId = window.STDiary.Utils.getCurrentChatId();
                    if (newChatId !== currentTrackedChatId) {
                        currentTrackedChatId = newChatId;
                        if (window.STDiary.Main && window.STDiary.Main.init) {
                            window.STDiary.Main.init();
                        }
                    }
                }, 500);
            });
            
            console.log(`[${EXTENSION_NAME}] ✅ Event listeners registered via context.eventSource`);
        } else {
            console.warn(`[${EXTENSION_NAME}] ⚠️ Could not access eventSource from context`);
        }
        
        // 초기 챗방 ID 저장
        currentTrackedChatId = window.STDiary.Utils?.getCurrentChatId?.() || null;
    }

    // Z키로 일기장 토글
    function setupKeyboardShortcut() {
        $(document).on('keydown', function(e) {
            if ($(e.target).is('input, textarea, [contenteditable="true"]')) {
                return;
            }
            if (e.key.toLowerCase() === 'z' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
                e.preventDefault();
                if (window.STDiary && window.STDiary.UI) {
                    window.STDiary.UI.toggleDiary();
                }
            }
        });
    }

    // 옵션 메뉴에 버튼 추가
    function addDiaryToggleButton() {
        if ($('#option_toggle_diary').length > 0) return;

        const $optionsContent = $('#options .options-content');
        if ($optionsContent.length > 0) {
            const diaryOption = `
                <a id="option_toggle_diary">
                    <i class="fa-lg fa-solid fa-book"></i>
                    <span>Diary</span>
                </a>
            `;
            const $anOption = $('#option_toggle_AN');
            if ($anOption.length > 0) {
                $anOption.after(diaryOption);
            } else {
                $optionsContent.prepend(diaryOption);
            }
            $('#option_toggle_diary').on('click', function() {
                $('#options').hide();
                if (window.STDiary && window.STDiary.UI) {
                    window.STDiary.UI.toggleDiary();
                }
            });
        }
    }

    // SillyTavern의 setExtensionPrompt API를 사용하여 프롬프트 주입
    function setupPromptInjection() {
        const context = getSTContext();
        
        // 방법 1: SillyTavern 컨텍스트의 setExtensionPrompt 사용 (공식 방법)
        if (context && typeof context.setExtensionPrompt === 'function') {
            // extension_prompt_types: 0 = IN_PROMPT, 1 = IN_CHAT, 2 = BEFORE_PROMPT
            // position (depth): 0 = 끝에서부터의 위치
            context.setExtensionPrompt(MODULE_ID, DATE_PROMPT_INJECTION, 1, 0);
            console.log(`[${EXTENSION_NAME}] ✅ Prompt injection via context.setExtensionPrompt`);
            return true;
        }
        
        // 방법 2: 글로벌 setExtensionPrompt 함수 시도
        if (typeof setExtensionPrompt === 'function') {
            setExtensionPrompt(MODULE_ID, DATE_PROMPT_INJECTION, 1, 0);
            console.log(`[${EXTENSION_NAME}] ✅ Prompt injection via global setExtensionPrompt`);
            return true;
        }

        // 방법 3: extension_prompts 전역 변수 직접 수정
        if (typeof extension_prompts !== 'undefined') {
            extension_prompts[MODULE_ID] = {
                value: DATE_PROMPT_INJECTION,
                position: 1, // IN_CHAT
                depth: 0
            };
            console.log(`[${EXTENSION_NAME}] ✅ Prompt injection via extension_prompts object`);
            return true;
        }
        
        // 방법 4: Author's Note 수정 시도
        const $authorNote = $('#extension_floating_prompt');
        if ($authorNote.length > 0) {
            const currentNote = $authorNote.val() || '';
            if (!currentNote.includes('RP_DATE:')) {
                $authorNote.val(currentNote + '\n\n' + DATE_PROMPT_INJECTION);
                $authorNote.trigger('change');
                console.log(`[${EXTENSION_NAME}] ✅ Prompt added to Author's Note`);
                return true;
            }
        }

        // 재시도 예약
        console.warn(`[${EXTENSION_NAME}] ⚠️ Could not inject prompt, will retry in 3 seconds...`);
        setTimeout(() => {
            if (!setupPromptInjection()) {
                console.error(`[${EXTENSION_NAME}] ❌ Failed to inject prompt after retry.`);
                if (typeof toastr !== 'undefined') {
                    toastr.warning('ST Diary: 날짜 프롬프트 주입에 실패했습니다. Author\'s Note에 수동으로 추가해주세요.', '', { timeOut: 5000 });
                }
            }
        }, 3000);
        
        return false;
    }

    // AI 응답 감시
    function setupAiResponseObserver() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const $node = $(node);
                        if ($node.hasClass('mes') && $node.attr('is_user') === 'false') {
                            setTimeout(() => processAiMessage($node), 500);
                        }
                    }
                }
            }
        });

        const chatContainer = document.getElementById('chat');
        if (chatContainer) {
            observer.observe(chatContainer, { childList: true, subtree: true });
            console.log(`[${EXTENSION_NAME}] ✅ AI response observer set up`);
        } else {
            console.warn(`[${EXTENSION_NAME}] ⚠️ Chat container not found, will retry...`);
            setTimeout(setupAiResponseObserver, 2000);
        }
    }

    // AI 메시지 처리
    function processAiMessage($messageElement) {
        const messageText = $messageElement.find('.mes_text').text();
        console.log(`[${EXTENSION_NAME}] Processing AI message (length: ${messageText.length})`);
        
        // RP_DATE 태그 파싱 - 다양한 형식 지원
        const datePatterns = [
            // {{RP_DATE: 2024년 3월 15일}}
            /\{\{RP_DATE:\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*\}\}/,
            // {{RP_DATE: 2024-03-15}}
            /\{\{RP_DATE:\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*\}\}/,
            // [RP_DATE: 2024년 3월 15일]
            /\[RP_DATE:\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*\]/,
            // 단순 날짜 형식 (응답 시작 부분에서만)
            /^[^\n]*?(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/
        ];
        
        let dateMatch = null;
        for (const pattern of datePatterns) {
            dateMatch = messageText.match(pattern);
            if (dateMatch) break;
        }
        
        if (dateMatch) {
            const year = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]);
            const day = parseInt(dateMatch[3]);
            const extractedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            console.log(`[${EXTENSION_NAME}] ✅ Extracted RP date: ${extractedDate}`);
            hideRpDateTag($messageElement);
            
            if (window.STDiary && window.STDiary.Main) {
                window.STDiary.Main.checkDateChange(extractedDate);
            }
        } else {
            console.log(`[${EXTENSION_NAME}] ⚠️ No RP_DATE tag found in message, trying backup extraction`);
            if (window.STDiary && window.STDiary.Main) {
                window.STDiary.Main.onNewAiMessage($messageElement);
            }
        }
    }

    // 날짜 태그 숨기기
    function hideRpDateTag($messageElement) {
        const $mesText = $messageElement.find('.mes_text');
        let html = $mesText.html();
        if (html) {
            // 다양한 형식의 날짜 태그 숨기기
            html = html.replace(
                /\{\{RP_DATE:[^}]+\}\}/g,
                '<span class="st-diary-date-tag" style="display:none;"></span>'
            );
            html = html.replace(
                /\[RP_DATE:[^\]]+\]/g,
                '<span class="st-diary-date-tag" style="display:none;"></span>'
            );
            $mesText.html(html);
        }
    }

    // 프롬프트 텍스트 외부 접근용
    window.STDiary.getDatePrompt = function() {
        return DATE_PROMPT_INJECTION;
    };
    
    // 수동 프롬프트 재주입 (디버그용)
    window.STDiary.reinjectPrompt = function() {
        return setupPromptInjection();
    };
    
    // 현재 상태 확인 (디버그용)
    window.STDiary.getStatus = function() {
        const context = getSTContext();
        return {
            contextAvailable: !!context,
            setExtensionPromptAvailable: !!(context?.setExtensionPrompt),
            eventSourceAvailable: !!(context?.eventSource),
            slashCommandsAvailable: !!(context?.SlashCommandParser?.commands),
            generateRawAvailable: !!(context?.generateRaw)
        };
    };

    $(document).ready(function() {
        setTimeout(initialize, 1000);
    });

})();
