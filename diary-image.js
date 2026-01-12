window.STDiary = window.STDiary || {};

window.STDiary.Image = (function() {
    'use strict';

    function getSlashCommandParser() {
        if (window.SlashCommandParser && window.SlashCommandParser.commands) {
            return window.SlashCommandParser;
        }
        
        if (window.SillyTavern) {
            const ctx = typeof window.SillyTavern.getContext === 'function' 
                ? window.SillyTavern.getContext() 
                : window.SillyTavern;
            
            if (ctx && ctx.SlashCommandParser && ctx.SlashCommandParser.commands) {
                return ctx.SlashCommandParser;
            }
        }

        if (typeof SlashCommandParser !== 'undefined' && SlashCommandParser.commands) {
            return SlashCommandParser;
        }

        return null;
    }

    function getExecuteSlashCommand() {
        if (window.SillyTavern) {
            const ctx = typeof window.SillyTavern.getContext === 'function' 
                ? window.SillyTavern.getContext() 
                : window.SillyTavern;
            
            if (ctx && typeof ctx.executeSlashCommands === 'function') {
                return ctx.executeSlashCommands;
            }
            if (ctx && typeof ctx.executeSlashCommand === 'function') {
                return ctx.executeSlashCommand;
            }
        }

        if (typeof executeSlashCommands === 'function') {
            return executeSlashCommands;
        }
        if (typeof executeSlashCommand === 'function') {
            return executeSlashCommand;
        }

        return null;
    }

    // 이미지 생성
    async function generateImage(prompt) {
        const parser = getSlashCommandParser();
        
        // SD 명령어 찾기
        if (parser && parser.commands) {
            const sdCmd = parser.commands['sd'] || parser.commands['draw'] || parser.commands['imagine'];
            if (sdCmd && typeof sdCmd.callback === 'function') {
                try {
                    // 일기 이미지용 프롬프트 강화
                    const enhancedPrompt = enhancePromptForDiary(prompt);
                    const result = await sdCmd.callback({ quiet: 'true' }, enhancedPrompt);
                    if (result && typeof result === 'string') {
                        return result;
                    }
                } catch (e) {
                    window.STDiary.Utils.log('SD callback failed: ' + e.message, 'warn');
                }
            }
        }

        // executeSlashCommands 시도
        const executeCmd = getExecuteSlashCommand();
        if (executeCmd) {
            try {
                const enhancedPrompt = enhancePromptForDiary(prompt);
                const result = await executeCmd(`/sd quiet=true ${enhancedPrompt}`);
                if (result && result.pipe) {
                    return result.pipe;
                }
                if (typeof result === 'string') {
                    return result;
                }
            } catch (e) {
                window.STDiary.Utils.log('executeSlashCommands failed: ' + e.message, 'warn');
            }
        }

        // 이미지 생성 실패
        window.STDiary.Utils.log('Image generation not available', 'warn');
        return null;
    }

    // 일기 이미지용 프롬프트 강화 (Danbooru 스타일)
    function enhancePromptForDiary(basePrompt) {
        // 기본 품질 태그 (Danbooru 스타일)
        const qualityTags = 'masterpiece, best quality, absurdres, highres';
        
        // 일기/메모리 느낌 태그
        const diaryTags = 'soft lighting, warm colors, slice of life';
        
        // basePrompt가 이미 Danbooru 태그 형식인지 확인
        // (1girl, 1boy 등으로 시작하면 이미 태그 형식)
        const isDanbooruStyle = /^(1girl|1boy|2girls|2boys|1girl 1boy|multiple)/i.test(basePrompt.trim());
        
        if (isDanbooruStyle) {
            // 이미 Danbooru 형식이면 품질 태그만 앞에 추가
            return `${qualityTags}, ${basePrompt}`;
        } else {
            // 아니면 기존 방식 + 품질 태그
            return `${qualityTags}, ${diaryTags}, ${basePrompt}`;
        }
    }

    // ST Phone의 카메라 앱 연동 시도 (있으면 활용, 없으면 기본 방식)
    async function generateImageWithPhoneCamera(prompt) {
        // ST Phone 카메라 앱이 있으면 그것을 활용 (선택적)
        if (window.STPhone && window.STPhone.Apps && window.STPhone.Apps.Camera) {
            try {
                // 카메라 앱의 AI 프롬프트 생성 기능 사용
                const camera = window.STPhone.Apps.Camera;
                if (typeof camera.generateDetailedPrompt === 'function') {
                    const detailedPrompt = await camera.generateDetailedPrompt(prompt);
                    return await generateImage(detailedPrompt);
                }
            } catch (e) {
                window.STDiary.Utils.log('Phone camera integration failed, using default: ' + e.message, 'warn');
            }
        }
        
        // STPhone이 없거나 실패하면 기본 이미지 생성
        return await generateImage(prompt);
    }

    // 캐릭터 태그 가져오기 (저장된 외형 태그 사용)
    function getCharacterTags(characterName) {
        // 1. 먼저 저장된 외형 태그 확인
        const savedTags = window.STDiary.Utils.getCharacterAppearance(characterName);
        if (savedTags) {
            window.STDiary.Utils.log(`Using saved appearance for ${characterName}: ${savedTags}`);
            return savedTags;
        }
        
        // 2. STPhone 연락처 앱이 있으면 활용 (백업)
        if (window.STPhone && window.STPhone.Apps && window.STPhone.Apps.Contacts) {
            const contacts = window.STPhone.Apps.Contacts;
            if (typeof contacts.getAllContacts === 'function') {
                const allContacts = contacts.getAllContacts();
                const contact = allContacts.find(c => c.name === characterName);
                if (contact && contact.tags) {
                    return contact.tags;
                }
            }
        }
        
        return '';
    }

    // 모든 등장 캐릭터의 태그 가져오기 (AI 판단용)
    function getAllRelevantCharacterTags(mentionedCharacters = []) {
        const allAppearances = window.STDiary.Utils.getAllCharacterAppearances();
        const relevantTags = [];
        
        // 언급된 캐릭터들의 태그만 수집
        for (const charName of mentionedCharacters) {
            const appearance = allAppearances.find(
                a => a.name.toLowerCase() === charName.toLowerCase()
            );
            if (appearance && appearance.tags) {
                relevantTags.push({
                    name: appearance.name,
                    tags: appearance.tags
                });
            }
        }
        
        return relevantTags;
    }

    // 프롬프트에서 캐릭터 이름을 찾아 태그로 대체
    function injectCharacterTags(prompt, characterName) {
        const allAppearances = window.STDiary.Utils.getAllCharacterAppearances();
        let result = prompt;
        
        // 각 등록된 캐릭터 이름이 프롬프트에 있으면 태그로 대체/추가
        for (const char of allAppearances) {
            const nameRegex = new RegExp(`\\b${char.name}\\b`, 'gi');
            if (nameRegex.test(result)) {
                // 캐릭터 이름을 태그로 대체 (| 구분자 사용)
                result = result.replace(nameRegex, `|${char.tags}`);
                window.STDiary.Utils.log(`Injected tags for ${char.name}`);
            }
        }
        
        return result;
    }

    // Danbooru 프롬프트 정규화
    function normalizeDanbooruPrompt(prompt) {
        // 이미 Danbooru 형식인지 확인
        const isDanbooruStyle = /^(1girl|1boy|2girls|2boys|1girl 1boy|multiple|solo)/i.test(prompt.trim());
        
        if (isDanbooruStyle) {
            // 중복 태그 제거, 공백 정리
            const tags = prompt.split(',').map(t => t.trim()).filter(t => t);
            const uniqueTags = [...new Set(tags)];
            return uniqueTags.join(', ');
        }
        
        return prompt;
    }

    // 일기에 맞는 이미지 생성 (Danbooru 스타일)
    async function generateDiaryImage(diaryContent, characterName, date) {
        // 메인 캐릭터 태그 가져오기
        const mainCharacterTags = getCharacterTags(characterName);
        
        // AI에게 이미지 프롬프트 요청 (일기 내용 기반)
        let imagePrompt = '';
        
        // diaryContent에 이미 imagePrompt가 있으면 사용 (AI가 생성한 Danbooru 태그)
        if (diaryContent && diaryContent.imagePrompt) {
            imagePrompt = diaryContent.imagePrompt;
            window.STDiary.Utils.log(`Using AI-generated prompt: ${imagePrompt}`);
        } else if (diaryContent && diaryContent.content) {
            // 폴백: 내용에서 기본 장면 추출
            imagePrompt = extractSceneFromContent(diaryContent.content);
        }
        
        // 프롬프트가 Danbooru 스타일인지 확인
        const isDanbooruStyle = /^(1girl|1boy|2girls|2boys|1girl 1boy|multiple|solo)/i.test(imagePrompt.trim());
        
        if (isDanbooruStyle) {
            // AI가 이미 Danbooru 형식으로 생성했으면 캐릭터 태그가 이미 포함되어 있을 것
            // 캐릭터 이름이 포함되어 있으면 태그로 대체
            imagePrompt = injectCharacterTags(imagePrompt, characterName);
            imagePrompt = normalizeDanbooruPrompt(imagePrompt);
        } else {
            // 기존 방식: 캐릭터 태그를 앞에 추가
            if (mainCharacterTags) {
                const characterKeywords = ['character', 'person', 'girl', 'boy', 'woman', 'man', 'she', 'he', '1girl', '1boy', characterName.toLowerCase()];
                const shouldIncludeCharacter = characterKeywords.some(kw => imagePrompt.toLowerCase().includes(kw));
                
                if (shouldIncludeCharacter || imagePrompt.length < 30) {
                    imagePrompt = `1girl, ${mainCharacterTags}, ${imagePrompt}`;
                    window.STDiary.Utils.log(`Added character tags for ${characterName}`);
                }
            }
        }
        
        // 이미지 생성
        if (imagePrompt) {
            try {
                window.STDiary.Utils.log(`Final image prompt: ${imagePrompt}`);
                return await generateImageWithPhoneCamera(imagePrompt);
            } catch (e) {
                window.STDiary.Utils.log('Diary image generation failed: ' + e.message, 'error');
            }
        }
        
        return null;
    }

    // 일기 내용에서 장면 추출 (Danbooru 스타일 폴백)
    function extractSceneFromContent(content) {
        // 기본적인 장면 설명 생성 (Danbooru 태그)
        const scenes = [
            '1girl, indoors, sitting, relaxed, casual clothes, window, natural lighting',
            '1girl, outdoors, standing, looking up, sky, peaceful',
            '1girl, bedroom, lying on bed, reading, cozy, warm lighting',
            '1girl, cafe, sitting, drinking coffee, relaxed, smile',
            '1girl, park, walking, sunny day, happy, casual outfit'
        ];
        
        // 랜덤 선택 (실제로는 내용 분석이 필요)
        return scenes[Math.floor(Math.random() * scenes.length)];
    }

    return {
        generateImage,
        generateImageWithPhoneCamera,
        generateDiaryImage,
        enhancePromptForDiary,
        getCharacterTags
    };

})();
