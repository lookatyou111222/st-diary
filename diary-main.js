window.STDiary = window.STDiary || {};

window.STDiary.Main = (function() {
    'use strict';

    let lastCheckedDate = null;
    let isWriting = false;

    // 일기 데이터 로드
    function loadEntries() {
        const data = window.STDiary.Utils.loadData();
        return data.entries || [];
    }

    // 일기 데이터 저장
    function saveEntries(entries) {
        const data = window.STDiary.Utils.loadData();
        data.entries = entries;
        window.STDiary.Utils.saveData(data);
    }

    // 새 일기 항목 추가
    function addEntry(entry) {
        const entries = loadEntries();
        
        // 같은 날짜의 일기가 있는지 확인
        const existingIndex = entries.findIndex(e => 
            window.STDiary.Utils.isSameDate(e.date, entry.date)
        );
        
        if (existingIndex >= 0) {
            // 기존 항목 업데이트
            entries[existingIndex] = { ...entries[existingIndex], ...entry };
        } else {
            // 새 항목 추가
            entry.id = window.STDiary.Utils.generateId();
            entry.createdAt = Date.now();
            entries.push(entry);
        }
        
        // 날짜순 정렬
        entries.sort((a, b) => {
            const dateA = new Date(a.date.year, a.date.month - 1, a.date.day);
            const dateB = new Date(b.date.year, b.date.month - 1, b.date.day);
            return dateA - dateB;
        });
        
        saveEntries(entries);
        return entry;
    }

    // 일기 항목들 가져오기
    function getEntries() {
        return loadEntries();
    }

    // 날짜 문자열을 객체로 변환
    function parseDateString(dateStr) {
        // "2024-03-15" 형식 처리
        if (typeof dateStr === 'string' && dateStr.includes('-')) {
            const parts = dateStr.split('-');
            return {
                year: parseInt(parts[0]),
                month: parseInt(parts[1]),
                day: parseInt(parts[2])
            };
        }
        // 이미 객체면 그대로 반환
        if (dateStr && typeof dateStr === 'object' && dateStr.year) {
            return dateStr;
        }
        return null;
    }

    // 날짜 변경 확인 (프롬프트 주입 방식 - AI 응답에서 추출된 날짜 사용)
    function checkDateChange(newDateInput) {
        if (!newDateInput) {
            window.STDiary.Utils.log('checkDateChange called with empty input', 'warn');
            return;
        }
        
        // 날짜 형식 정규화
        const newDate = parseDateString(newDateInput) || newDateInput;
        if (!newDate || !newDate.year) {
            window.STDiary.Utils.log('Invalid date format: ' + JSON.stringify(newDateInput), 'warn');
            return;
        }
        
        const data = window.STDiary.Utils.loadData();
        const lastDate = data.lastDate;
        
        window.STDiary.Utils.log(`Checking date change: last=${JSON.stringify(lastDate)}, new=${JSON.stringify(newDate)}`);
        
        // 날짜가 변경되었는지 확인
        if (!window.STDiary.Utils.isSameDate(lastDate, newDate)) {
            window.STDiary.Utils.log(`✅ Date changed! From ${JSON.stringify(lastDate)} to ${JSON.stringify(newDate)}`);
            
            // 설정 확인
            const settings = data.settings || {};
            
            // 이전 날짜가 있으면 그 날짜에 대한 일기 작성
            if (settings.autoWrite !== false && lastDate && lastDate.year) {
                window.STDiary.Utils.log(`🖊️ Triggering auto diary write for ${JSON.stringify(lastDate)}`);
                autoWriteDiary(lastDate);
            } else {
                window.STDiary.Utils.log(`Skipping auto write: autoWrite=${settings.autoWrite}, lastDate=${JSON.stringify(lastDate)}`);
            }
            
            // 마지막 날짜 업데이트
            data.lastDate = newDate;
            window.STDiary.Utils.saveData(data);
            window.STDiary.Utils.log(`📅 Last date updated to ${JSON.stringify(newDate)}`);
        } else {
            window.STDiary.Utils.log('Date unchanged, skipping diary write');
        }
    }

    // 새 AI 메시지 처리 (RP_DATE 태그가 없을 때 백업용)
    function onNewAiMessage($messageElement) {
        const messageText = $messageElement.find('.mes_text').text();
        
        // 일반적인 날짜 패턴으로 추출 시도
        const extractedDate = extractDateFromMessage(messageText);
        if (extractedDate) {
            checkDateChange(extractedDate);
        }
    }

    // 메시지에서 날짜 추출 (백업용 - RP_DATE 태그 없을 때)
    function extractDateFromMessage(text) {
        if (!text) return null;
        
        // 다양한 날짜 패턴 매칭
        const patterns = [
            // <date year="2026" month="1" day="15">
            /<date[^>]*year="(\d+)"[^>]*month="(\d+)"[^>]*day="(\d+)"[^>]*>/i,
            // [2026년 1월 15일]
            /\[?(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\]?/,
            // 2026/1/15 or 2026-01-15
            /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return {
                    year: parseInt(match[1]),
                    month: parseInt(match[2]),
                    day: parseInt(match[3])
                };
            }
        }
        
        return null;
    }

    // 현재 RP 날짜 가져오기
    function getCurrentRpDate() {
        // 저장된 마지막 날짜 확인
        const data = window.STDiary.Utils.loadData();
        if (data.lastDate && data.lastDate.year) {
            return data.lastDate;
        }
        
        // 기본값: 현재 실제 날짜
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate()
        };
    }

    // 자동 일기 작성
    async function autoWriteDiary(date) {
        window.STDiary.Utils.log(`autoWriteDiary called for date: ${JSON.stringify(date)}`);
        
        if (isWriting) {
            window.STDiary.Utils.log('Already writing diary, skipping...', 'warn');
            return;
        }
        
        // 이미 해당 날짜의 일기가 있는지 확인
        const entries = loadEntries();
        const existing = entries.find(e => window.STDiary.Utils.isSameDate(e.date, date));
        if (existing) {
            window.STDiary.Utils.log('Diary already exists for this date', 'info');
            return;
        }
        
        isWriting = true;
        window.STDiary.Utils.log(`🖊️ Starting auto diary write for ${JSON.stringify(date)}`);
        
        // 토스트 알림 표시
        if (typeof toastr !== 'undefined') {
            toastr.info('📝 일기 쓰는 중...', '', { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false, closeButton: false, progressBar: true, toastClass: 'toast st-diary-writing-toast' });
        }
        
        try {
            // AI 모듈 확인
            if (!window.STDiary.AI || !window.STDiary.AI.generateDiaryEntry) {
                throw new Error('AI module not available');
            }
            
            const entry = await writeDiaryEntry(date);
            
            // 작성중 토스트 닫기
            $('.st-diary-writing-toast').remove();
            
            if (entry) {
                window.STDiary.Utils.log(`✅ Diary entry created successfully`);
                if (typeof toastr !== 'undefined') {
                    toastr.success('📔 새 일기가 자동으로 작성되었습니다!');
                }
                
                // UI 업데이트
                if (window.STDiary.UI && window.STDiary.UI.isOpen()) {
                    window.STDiary.UI.goToLatestEntry();
                    window.STDiary.UI.renderCurrentPage();
                }
            }
        } catch (e) {
            $('.st-diary-writing-toast').remove();
            window.STDiary.Utils.log('Auto diary write failed: ' + e.message, 'error');
            if (typeof toastr !== 'undefined') {
                toastr.error('일기 자동 작성 실패: ' + e.message);
            }
        } finally {
            isWriting = false;
        }
    }

    // 일기 작성 (실제 작업)
    async function writeDiaryEntry(date) {
        const characterName = window.STDiary.Utils.getCurrentCharacterName();
        // 설정된 토큰 크기만큼 채팅 기록 가져오기
        const chatHistory = window.STDiary.Utils.getRecentChatHistory();
        
        if (chatHistory.length === 0) {
            window.STDiary.Utils.log('No chat history to write diary', 'warn');
            return null;
        }
        
        window.STDiary.Utils.log(`Writing diary with ${chatHistory.length} messages`);
        
        // AI에게 일기 작성 요청
        const aiResponse = await window.STDiary.AI.generateDiaryEntry(date, chatHistory, characterName);
        
        // 새 일기 항목 생성
        const entry = {
            date: date,
            content: aiResponse.content,
            fontStyle: aiResponse.fontStyle,
            weather: aiResponse.weather,
            mood: aiResponse.mood,
            characterName: characterName,
            imageUrl: null,
            imageCaption: ''
        };
        
        // 이미지 생성 (설정에서 활성화된 경우)
        const data = window.STDiary.Utils.loadData();
        const settings = data.settings || {};
        
        if (settings.includePhoto !== false && aiResponse.imagePrompt) {
            try {
                const imageUrl = await window.STDiary.Image.generateDiaryImage(
                    aiResponse, 
                    characterName, 
                    date
                );
                if (imageUrl) {
                    entry.imageUrl = imageUrl;
                    entry.imageCaption = aiResponse.imagePrompt;
                }
            } catch (e) {
                window.STDiary.Utils.log('Image generation failed: ' + e.message, 'warn');
            }
        }
        
        // 저장
        addEntry(entry);
        
        return entry;
    }

    // 일기장 새로고침
    function refreshDiary() {
        if (window.STDiary.UI && window.STDiary.UI.isBookOpen()) {
            window.STDiary.UI.renderCurrentPage();
        }
    }

    // 특정 날짜의 일기 가져오기
    function getEntryByDate(date) {
        const entries = loadEntries();
        return entries.find(e => window.STDiary.Utils.isSameDate(e.date, date));
    }

    // 일기 삭제
    function deleteEntry(entryId) {
        let entries = loadEntries();
        entries = entries.filter(e => e.id !== entryId);
        saveEntries(entries);
    }

    // 초기화
    function init() {
        window.STDiary.Utils.log('Main Module Initialized.');
        
        // 저장된 마지막 날짜 확인
        const data = window.STDiary.Utils.loadData();
        lastCheckedDate = data.lastDate;
        window.STDiary.Utils.log(`Last stored date: ${JSON.stringify(lastCheckedDate)}`);
    }
    
    // 수동 일기 작성 트리거 (디버그/테스트용)
    function triggerManualDiaryWrite(dateObj) {
        const date = dateObj || getCurrentRpDate();
        window.STDiary.Utils.log(`Manual diary write triggered for: ${JSON.stringify(date)}`);
        return autoWriteDiary(date);
    }
    
    // 날짜 변경 시뮬레이션 (디버그용)
    function simulateDateChange(newDateStr) {
        window.STDiary.Utils.log(`Simulating date change to: ${newDateStr}`);
        checkDateChange(newDateStr);
    }

    return {
        init,
        getEntries,
        addEntry,
        deleteEntry,
        checkDateChange,
        onNewAiMessage,
        refreshDiary,
        getEntryByDate,
        getCurrentRpDate,
        isWriting: () => isWriting,
        // 디버그용 함수들
        triggerManualDiaryWrite,
        simulateDateChange
    };

})();

// Main 모듈 자동 초기화
$(document).ready(function() {
    setTimeout(() => {
        if (window.STDiary && window.STDiary.Main) {
            window.STDiary.Main.init();
        }
    }, 200);
});
