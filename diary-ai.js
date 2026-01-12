window.STDiary = window.STDiary || {};

window.STDiary.AI = (function() {
    'use strict';

    // 글씨체 스타일 정의 (멋진 손글씨 스타일들)
    const FONT_STYLES = {
        elegant: {
            name: '우아한 필기체',
            description: '흘려쓴 듯 우아하고 세련된 캘리그라피 느낌',
            prompt: 'Write in an elegant, flowing calligraphy style. Graceful and sophisticated, with beautiful metaphors.',
            css: "font-family: 'Nanum Pen Script', cursive; font-size: 1.2em;"
        },
        vintage: {
            name: '빈티지 일기',
            description: '오래된 일기장에서 발견한 듯한 클래식한 문체',
            prompt: 'Write in a vintage diary style, like an old journal from decades ago. Nostalgic and timeless.',
            css: "font-family: 'Gowun Batang', serif; color: #5c4033;"
        },
        dreamy: {
            name: '몽환적',
            description: '꿈꾸는 듯 흐릿하고 신비로운 분위기',
            prompt: 'Write in a dreamy, ethereal style. Soft, hazy, like thoughts drifting between dreams and reality.',
            css: "font-family: 'Nanum Myeongjo', serif; font-style: italic; opacity: 0.9;"
        },
        passionate: {
            name: '격정적',
            description: '감정이 폭발하는 듯한 강렬하고 진한 표현',
            prompt: 'Write with intense passion and raw emotion. Bold strokes of feeling, dramatic and powerful.',
            css: "font-family: 'Black Han Sans', sans-serif; font-weight: bold;"
        },
        whisper: {
            name: '속삭임',
            description: '비밀을 털어놓듯 조용하고 은밀한 톤',
            prompt: 'Write like sharing secrets in whispers. Intimate, private, soft-spoken confessions.',
            css: "font-family: 'Nanum Gothic', sans-serif; font-size: 0.95em; letter-spacing: 0.5px;"
        },
        artistic: {
            name: '예술가의 노트',
            description: '감각적이고 추상적인 예술가의 메모 스타일',
            prompt: 'Write like an artist\'s personal notes. Abstract, sensory, full of imagery and creative observations.',
            css: "font-family: 'Gaegu', cursive; font-size: 1.1em;"
        },
        melancholy: {
            name: '우수에 젖은',
            description: '쓸쓸하고 아련한 감성, 비 오는 날의 창가 같은',
            prompt: 'Write with gentle melancholy. Bittersweet, wistful, like watching rain on a window.',
            css: "font-family: 'Noto Serif KR', serif; color: #4a5568;"
        },
        playful: {
            name: '장난스러운',
            description: '유쾌하고 재치있는 톤, 웃음이 묻어나는',
            prompt: 'Write playfully with wit and humor. Light-hearted, fun, with clever observations.',
            css: "font-family: 'Hi Melody', cursive; font-size: 1.15em;"
        }
    };

    // SillyTavern 컨텍스트 가져오기
    function getSTContext() {
        return window.SillyTavern?.getContext?.() || null;
    }

    // SlashCommandParser 가져오기
    function getSlashCommandParser() {
        const context = getSTContext();
        if (context?.SlashCommandParser?.commands) {
            return context.SlashCommandParser;
        }
        if (window.SlashCommandParser?.commands) {
            return window.SlashCommandParser;
        }
        return null;
    }

    // AI 응답 정규화
    function normalizeModelOutput(raw) {
        if (raw == null) return '';
        if (typeof raw === 'string') return raw;
        if (typeof raw?.content === 'string') return raw.content;
        if (typeof raw?.text === 'string') return raw.text;
        const choiceContent = raw?.choices?.[0]?.message?.content;
        if (typeof choiceContent === 'string') return choiceContent;
        try {
            return JSON.stringify(raw);
        } catch (e) {
            return String(raw);
        }
    }

    /**
     * AI 생성 함수 - 프로필 설정 사용
     * @param {string} prompt - 프롬프트
     * @param {number} maxTokens - 최대 토큰 수
     * @returns {Promise<string>} - 생성된 텍스트
     */
    async function generateAIResponse(prompt, maxTokens = 1024) {
        const context = getSTContext();
        
        if (!context) {
            throw new Error('SillyTavern context not available');
        }
        
        // 방법 1: generateRaw 사용 (공식 API)
        if (typeof context.generateRaw === 'function') {
            try {
                window.STDiary.Utils.log('Using context.generateRaw');
                const result = await context.generateRaw(prompt, null, '', false);
                return normalizeModelOutput(result);
            } catch (e) {
                window.STDiary.Utils.log('generateRaw failed: ' + e.message, 'warn');
            }
        }
        
        // 방법 2: ConnectionManagerRequestService 사용
        if (context.ConnectionManagerRequestService) {
            try {
                const connectionManager = context.ConnectionManagerRequestService;
                if (typeof connectionManager.sendRequest === 'function') {
                    window.STDiary.Utils.log('Using ConnectionManagerRequestService');
                    const messages = [{ role: 'user', content: prompt }];
                    const result = await connectionManager.sendRequest(null, messages, maxTokens);
                    return normalizeModelOutput(result);
                }
            } catch (e) {
                window.STDiary.Utils.log('ConnectionManager failed: ' + e.message, 'warn');
            }
        }
        
        // 방법 3: SlashCommand genraw 사용
        const parser = getSlashCommandParser();
        if (parser?.commands) {
            const genCmd = parser.commands['genraw'] || parser.commands['gen'];
            if (genCmd && typeof genCmd.callback === 'function') {
                window.STDiary.Utils.log('Using SlashCommand genraw/gen');
                const result = await genCmd.callback({ quiet: 'true' }, prompt);
                return normalizeModelOutput(result);
            }
        }
        
        throw new Error('No AI generation method available');
    }

    // AI에게 일기 작성 요청
    async function generateDiaryEntry(date, chatHistory, characterName) {
        window.STDiary.Utils.log(`Generating diary entry for ${characterName} on ${JSON.stringify(date)}`);
        
        // 캐릭터 디스크립션 가져오기
        const characterDescription = window.STDiary.Utils.getCurrentCharacterDescription();
        window.STDiary.Utils.log(`Character description: ${characterDescription ? characterDescription.substring(0, 100) + '...' : '(none)'}`);
        
        // 유저 정보 가져오기
        const userName = window.STDiary.Utils.getUserName();
        const userPersona = window.STDiary.Utils.getUserPersona();
        window.STDiary.Utils.log(`User persona: ${userPersona ? userPersona.substring(0, 100) + '...' : '(none)'}`);
        
        // 채팅 기록 요약
        const chatSummary = chatHistory.map(msg => 
            `${msg.name}: ${msg.text.substring(0, 200)}${msg.text.length > 200 ? '...' : ''}`
        ).join('\n');

        // 스타일 목록 생성
        const styleList = Object.entries(FONT_STYLES)
            .map(([key, style]) => `   - ${key}: ${style.description}`)
            .join('\n');

        // 저장된 캐릭터 외형 태그 목록 (Danbooru 형식)
        const allAppearances = window.STDiary.Utils.getAllCharacterAppearances();
        let characterAppearanceInfo = '';
        if (allAppearances.length > 0) {
            characterAppearanceInfo = `
## Pre-defined Character Master Prompts (Danbooru tags - DO NOT change order or omit any tags):
${allAppearances.map(c => `- ${c.name}: ${c.tags}`).join('\n')}
`;
        }

        // 캐릭터 정보 섹션
        let characterInfo = '';
        if (characterDescription) {
            characterInfo = `
## Character Profile (${characterName}):
${characterDescription}
`;
        }

        // 유저 정보 섹션
        let userInfo = '';
        if (userPersona) {
            userInfo = `
## User Profile (${userName}):
${userPersona}
`;
        }

        // AI에게 글씨체 선택과 일기 작성 요청
        // 구조: 날짜 → 채팅 히스토리 → 캐릭터 프로필 → 유저 프로필 → 태스크
        const diaryPrompt = `You are writing a personal diary entry for ${characterName}.

## Context
Today's date: ${window.STDiary.Utils.formatDate(date)}

## Recent events (based on conversations):
${chatSummary}
${characterInfo}${userInfo}${characterAppearanceInfo}
## Task
1. Choose a writing style that best fits ${characterName}'s personality and today's mood:
${styleList}

2. Write a diary entry (150-300 characters in Korean) from ${characterName}'s perspective.
   - Match the writing tone to the chosen style
   - Be personal and intimate, as if writing for oneself

3. Include a weather emoji and mood description.

4. Generate an image prompt using Danbooru-style tags for today's memory.

## IMAGE PROMPT RULES (CRITICAL):
* Use ONLY Danbooru tags separated by commas.
* Hair color and eye color tags are MANDATORY for all characters.
* Single Character: Start with 1girl or 1boy.
  - Example: 1girl, brown hair, long hair, green eyes, on bed, sitting, smile
* Multiple Characters: Start with count (e.g., 2girls, 1boy 1girl), then use | to separate each character's description.
  - Example: 1boy 1girl, indoors, |boy, black hair, green eyes, |girl, blonde hair, blue eyes, holding hands
* NEVER change the order of tags or omit any tags from the pre-defined character prompts above.
* Include scene/background tags: indoors, outdoors, bedroom, park, etc.
* Include pose/action tags: sitting, standing, lying, walking, etc.
* Include mood tags: smile, blush, crying, happy, etc.

## Output Format (MUST follow exactly):
<diary>
<style>chosen_style_name</style>
<weather>weather_emoji</weather>
<mood>mood_description</mood>
<content>
diary entry in Korean
</content>
<image>Danbooru tags only, example: 1girl, blonde hair, blue eyes, white dress, sitting, park, sunny, smile</image>
</diary>`;

        try {
            window.STDiary.Utils.log('Calling AI for diary generation...');
            const aiResponse = await generateAIResponse(diaryPrompt, 1024);
            window.STDiary.Utils.log('AI response received: ' + aiResponse.substring(0, 200) + '...');
            return parseAiDiaryResponse(String(aiResponse));
        } catch (e) {
            window.STDiary.Utils.log('AI diary generation failed: ' + e.message, 'error');
            throw e;
        }
    }

    // AI 응답 파싱
    function parseAiDiaryResponse(response) {
        const result = {
            fontStyle: 'elegant',
            weather: '☀️',
            mood: '',
            content: '',
            imagePrompt: ''
        };

        try {
            // 스타일 추출
            const styleMatch = response.match(/<style>(.*?)<\/style>/s);
            if (styleMatch && FONT_STYLES[styleMatch[1].trim()]) {
                result.fontStyle = styleMatch[1].trim();
            }

            // 날씨 추출
            const weatherMatch = response.match(/<weather>(.*?)<\/weather>/s);
            if (weatherMatch) {
                result.weather = weatherMatch[1].trim();
            }

            // 기분 추출
            const moodMatch = response.match(/<mood>(.*?)<\/mood>/s);
            if (moodMatch) {
                result.mood = moodMatch[1].trim();
            }

            // 내용 추출
            const contentMatch = response.match(/<content>(.*?)<\/content>/s);
            if (contentMatch) {
                result.content = contentMatch[1].trim();
            }

            // 이미지 프롬프트 추출
            const imageMatch = response.match(/<image>(.*?)<\/image>/s);
            if (imageMatch) {
                result.imagePrompt = imageMatch[1].trim();
            }

            // 내용이 없으면 전체 응답 사용
            if (!result.content) {
                // diary 태그 전체에서 추출 시도
                const diaryMatch = response.match(/<diary>(.*?)<\/diary>/s);
                if (diaryMatch) {
                    // 태그 제거 후 남은 텍스트
                    let cleanContent = diaryMatch[1]
                        .replace(/<style>.*?<\/style>/gs, '')
                        .replace(/<weather>.*?<\/weather>/gs, '')
                        .replace(/<mood>.*?<\/mood>/gs, '')
                        .replace(/<image>.*?<\/image>/gs, '')
                        .trim();
                    
                    if (cleanContent) {
                        result.content = cleanContent;
                    }
                }
            }

            // 여전히 내용이 없으면 기본값
            if (!result.content) {
                result.content = '오늘 하루도 무사히 지나갔다...';
            }

        } catch (e) {
            window.STDiary.Utils.log('Failed to parse AI response: ' + e.message, 'warn');
            result.content = response.substring(0, 500) || '오늘 하루도 무사히 지나갔다...';
        }

        return result;
    }

    // 사용 가능한 폰트 스타일 목록
    function getFontStyles() {
        return FONT_STYLES;
    }

    // 랜덤 폰트 스타일 선택
    function getRandomFontStyle() {
        const styles = Object.keys(FONT_STYLES);
        return styles[Math.floor(Math.random() * styles.length)];
    }

    return {
        generateDiaryEntry,
        parseAiDiaryResponse,
        getFontStyles,
        getRandomFontStyle,
        FONT_STYLES
    };

})();
