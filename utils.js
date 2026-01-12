window.STDiary = window.STDiary || {};

window.STDiary.Utils = (function() {
    'use strict';

    const EXTENSION_NAME = 'ST Diary System';
    const STORAGE_KEY_PREFIX = 'st_diary_';
    const GLOBAL_SETTINGS_KEY = 'st_diary_global';

    function log(message, type = 'info') {
        const prefix = `📔 [${EXTENSION_NAME}]`;
        switch(type) {
            case 'error':
                console.error(`${prefix} ❌`, message);
                break;
            case 'warn':
                console.warn(`${prefix} ⚠️`, message);
                break;
            default:
                console.log(`${prefix}`, message);
        }
    }

    // SillyTavern 컨텍스트 가져오기
    function getSTContext() {
        return window.SillyTavern?.getContext?.() || null;
    }

    // 현재 챗방 ID 가져오기
    function getCurrentChatId() {
        try {
            const context = getSTContext();
            if (context && context.getCurrentChatId) {
                return context.getCurrentChatId();
            }
            // 대체 방법
            if (context && context.chatId) {
                return context.chatId;
            }
            // 파일명에서 추출
            const chatFile = $('#chat_file_name_input').val();
            if (chatFile) {
                return chatFile.replace(/\.[^/.]+$/, '');
            }
        } catch (e) {
            log('Failed to get chat ID: ' + e.message, 'warn');
        }
        return 'default';
    }

    // 캐릭터+챗방별 스토리지 키 생성
    function getStorageKey() {
        const charId = getCurrentCharacterId() || 'unknown';
        const chatId = getCurrentChatId() || 'default';
        return `${STORAGE_KEY_PREFIX}${charId}_${chatId}`;
    }

    // 로컬 스토리지에서 데이터 로드 (캐릭터+챗방별)
    function loadData() {
        try {
            const key = getStorageKey();
            const data = localStorage.getItem(key);
            log(`Loading data from: ${key}`);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            log('Failed to load data: ' + e.message, 'error');
        }
        return getDefaultData();
    }

    // 로컬 스토리지에 데이터 저장 (캐릭터+챗방별)
    function saveData(data) {
        try {
            const key = getStorageKey();
            localStorage.setItem(key, JSON.stringify(data));
            log(`Data saved to: ${key}`);
            return true;
        } catch (e) {
            log('Failed to save data: ' + e.message, 'error');
            return false;
        }
    }

    // 글로벌 설정 로드 (캐릭터 외형 태그 등)
    function loadGlobalSettings() {
        try {
            const data = localStorage.getItem(GLOBAL_SETTINGS_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            log('Failed to load global settings: ' + e.message, 'error');
        }
        return getDefaultGlobalSettings();
    }

    // 글로벌 설정 저장
    function saveGlobalSettings(settings) {
        try {
            localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
            return true;
        } catch (e) {
            log('Failed to save global settings: ' + e.message, 'error');
            return false;
        }
    }

    // 기본 글로벌 설정
    function getDefaultGlobalSettings() {
        return {
            characterAppearances: [],  // [{name: 'Alice', tags: 'blonde hair, blue eyes, white dress'}, ...]
            autoWrite: true,
            includePhoto: true,
            contextTokens: 30000  // 컨텍스트 토큰 크기 (기본 30000)
        };
    }

    // 기본 데이터 구조 (챗방별)
    function getDefaultData() {
        return {
            entries: [],           // 일기 항목들
            settings: {
                autoWrite: true,   // 자동 일기 작성
                includePhoto: true // 사진 포함
            },
            lastDate: null,        // 마지막 날짜 (날짜 변경 감지용)
            characterId: null,     // 현재 캐릭터 ID
            chatId: null           // 현재 챗방 ID
        };
    }

    // 캐릭터 외형 태그 가져오기
    function getCharacterAppearance(characterName) {
        const global = loadGlobalSettings();
        const found = global.characterAppearances.find(
            c => c.name.toLowerCase() === characterName.toLowerCase()
        );
        return found ? found.tags : '';
    }

    // 캐릭터 외형 태그 설정
    function setCharacterAppearance(characterName, tags) {
        const global = loadGlobalSettings();
        const existingIndex = global.characterAppearances.findIndex(
            c => c.name.toLowerCase() === characterName.toLowerCase()
        );
        
        if (existingIndex >= 0) {
            global.characterAppearances[existingIndex].tags = tags;
        } else {
            global.characterAppearances.push({ name: characterName, tags });
        }
        
        saveGlobalSettings(global);
        log(`Character appearance saved: ${characterName}`);
    }

    // 캐릭터 외형 삭제
    function removeCharacterAppearance(characterName) {
        const global = loadGlobalSettings();
        global.characterAppearances = global.characterAppearances.filter(
            c => c.name.toLowerCase() !== characterName.toLowerCase()
        );
        saveGlobalSettings(global);
    }

    // 모든 캐릭터 외형 목록 가져오기
    function getAllCharacterAppearances() {
        const global = loadGlobalSettings();
        return global.characterAppearances || [];
    }

    // 날짜 포맷팅
    function formatDate(dateObj) {
        if (!dateObj) return '날짜 없음';
        
        const year = dateObj.year || new Date().getFullYear();
        const month = dateObj.month || 1;
        const day = dateObj.day || 1;
        
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const date = new Date(year, month - 1, day);
        const weekday = weekdays[date.getDay()];
        
        return `${year}년 ${month}월 ${day}일 ${weekday}요일`;
    }

    // 날짜 비교 (같은 날인지)
    function isSameDate(date1, date2) {
        if (!date1 || !date2) return false;
        return date1.year === date2.year && 
               date1.month === date2.month && 
               date1.day === date2.day;
    }

    // 고유 ID 생성
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 현재 캐릭터 ID 가져오기
    function getCurrentCharacterId() {
        try {
            if (window.SillyTavern) {
                const ctx = typeof window.SillyTavern.getContext === 'function' 
                    ? window.SillyTavern.getContext() 
                    : window.SillyTavern;
                
                if (ctx && ctx.characterId) {
                    return ctx.characterId;
                }
                if (ctx && ctx.characters && ctx.characters.length > 0) {
                    return ctx.characters[0]?.avatar || null;
                }
            }
            
            // 대체 방법
            const characterId = $('#character_popup').attr('chid');
            if (characterId) return characterId;

        } catch (e) {
            log('Failed to get character ID: ' + e.message, 'warn');
        }
        return null;
    }

    // 현재 캐릭터 이름 가져오기
    function getCurrentCharacterName() {
        try {
            if (window.SillyTavern) {
                const ctx = typeof window.SillyTavern.getContext === 'function' 
                    ? window.SillyTavern.getContext() 
                    : window.SillyTavern;
                
                if (ctx && ctx.name2) {
                    return ctx.name2;
                }
            }
            
            const name = $('#character_name_pole').text().trim();
            if (name) return name;

        } catch (e) {
            log('Failed to get character name: ' + e.message, 'warn');
        }
        return '캐릭터';
    }

    // 현재 캐릭터 카드 필드 가져오기 (SillyTavern 공식 API 사용)
    function getCurrentCharacterDescription() {
        try {
            const ctx = getSTContext();
            
            // 방법 1: getCharacterCardFields API 사용 (가장 정확)
            if (ctx && typeof ctx.getCharacterCardFields === 'function') {
                const fields = ctx.getCharacterCardFields();
                const parts = [];
                if (fields.description) parts.push(fields.description);
                if (fields.personality) parts.push(`Personality: ${fields.personality}`);
                if (fields.scenario) parts.push(`Scenario: ${fields.scenario}`);
                
                const result = parts.join('\n\n');
                if (result) {
                    log('Character description loaded via getCharacterCardFields');
                    return result;
                }
            }
            
            // 방법 2: characters 배열에서 직접 가져오기
            if (ctx && ctx.characters && ctx.characterId !== undefined) {
                const char = ctx.characters[ctx.characterId];
                if (char) {
                    const parts = [];
                    if (char.description) parts.push(char.description);
                    if (char.personality) parts.push(`Personality: ${char.personality}`);
                    if (char.scenario) parts.push(`Scenario: ${char.scenario}`);
                    return parts.join('\n\n');
                }
            }
        } catch (e) {
            log('Failed to get character description: ' + e.message, 'warn');
        }
        return '';
    }

    // 유저 페르소나 가져오기 (SillyTavern 공식 API 사용)
    function getUserPersona() {
        try {
            const ctx = getSTContext();
            
            // 방법 1: getCharacterCardFields API 사용 (persona 필드)
            if (ctx && typeof ctx.getCharacterCardFields === 'function') {
                const fields = ctx.getCharacterCardFields();
                if (fields.persona) {
                    log('User persona loaded via getCharacterCardFields');
                    return fields.persona;
                }
            }
            
            // 방법 2: powerUserSettings에서 직접 가져오기
            if (ctx && ctx.powerUserSettings) {
                const powerUser = ctx.powerUserSettings;
                
                // persona_description (현재 활성화된 페르소나 설명)
                if (powerUser.persona_description) {
                    log('User persona loaded via powerUserSettings.persona_description');
                    return powerUser.persona_description;
                }
            }
        } catch (e) {
            log('Failed to get user persona: ' + e.message, 'warn');
        }
        return '';
    }

    // 유저 이름 가져오기
    function getUserName() {
        try {
            if (window.SillyTavern) {
                const ctx = typeof window.SillyTavern.getContext === 'function' 
                    ? window.SillyTavern.getContext() 
                    : window.SillyTavern;
                
                if (ctx && ctx.name1) {
                    return ctx.name1;
                }
            }
        } catch (e) {
            log('Failed to get user name: ' + e.message, 'warn');
        }
        return 'User';
    }

    // 컨텍스트 토큰 크기 가져오기
    function getContextTokens() {
        const global = loadGlobalSettings();
        return global.contextTokens || 30000;
    }

    // 컨텍스트 토큰 크기 설정
    function setContextTokens(tokens) {
        const global = loadGlobalSettings();
        global.contextTokens = parseInt(tokens) || 30000;
        saveGlobalSettings(global);
    }

    // 대략적인 토큰 수 계산 (한글 기준 약 2-3자당 1토큰, 영어 약 4자당 1토큰)
    function estimateTokens(text) {
        if (!text) return 0;
        // 한글은 약 1.5자당 1토큰, 영어는 약 4자당 1토큰으로 추정
        const koreanChars = (text.match(/[\u3131-\uD79D]/g) || []).length;
        const otherChars = text.length - koreanChars;
        return Math.ceil(koreanChars / 1.5 + otherChars / 4);
    }

    // 최근 채팅 내용 가져오기 (토큰 기반)
    function getRecentChatHistory(maxTokens = null) {
        try {
            const targetTokens = maxTokens || getContextTokens();
            const messages = [];
            const $chatMessages = $('#chat .mes');
            let currentTokens = 0;
            
            // 최신 메시지부터 역순으로 가져오기
            for (let i = $chatMessages.length - 1; i >= 0; i--) {
                const $mes = $($chatMessages[i]);
                const isUser = $mes.attr('is_user') === 'true';
                const text = $mes.find('.mes_text').text().trim();
                const name = isUser ? 'User' : getCurrentCharacterName();
                
                if (text) {
                    const msgTokens = estimateTokens(`${name}: ${text}`);
                    
                    // 토큰 한도 체크
                    if (currentTokens + msgTokens > targetTokens) {
                        break;
                    }
                    
                    currentTokens += msgTokens;
                    messages.unshift({ name, text, isUser }); // 앞에 추가 (순서 유지)
                }
            }
            
            log(`Chat history loaded: ${messages.length} messages, ~${currentTokens} tokens (target: ${targetTokens})`);
            return messages;
        } catch (e) {
            log('Failed to get chat history: ' + e.message, 'error');
            return [];
        }
    }

    return {
        log,
        loadData,
        saveData,
        getDefaultData,
        loadGlobalSettings,
        saveGlobalSettings,
        getDefaultGlobalSettings,
        formatDate,
        isSameDate,
        generateId,
        getCurrentCharacterId,
        getCurrentCharacterName,
        getCurrentCharacterDescription,
        getUserPersona,
        getUserName,
        getCurrentChatId,
        getStorageKey,
        getRecentChatHistory,
        estimateTokens,
        getContextTokens,
        setContextTokens,
        // 캐릭터 외형 관리
        getCharacterAppearance,
        setCharacterAppearance,
        removeCharacterAppearance,
        getAllCharacterAppearances
    };

})();
