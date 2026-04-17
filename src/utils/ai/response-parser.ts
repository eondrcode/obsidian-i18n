/**
 * 大模型响应返回解析工具箱
 * 包含强制自愈技术，以应对不规则或被截断的 JSON 格式
 */

export function parseTranslationResponse(content: string): Array<{ i: number; t: string }> {
    if (!content || content.trim() === '') {
        throw new Error('AI 返回内容为空');
    }

    let jsonText = content.trim();
    let parsedData: unknown;
    let isParsedObject = false;

    // 【阶段 1: 规范化清理】
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
        jsonText = codeBlockMatch[1].trim();
    } else {
        // 如果没有包裹代码块，强行找首尾括号
        const firstBracket = Math.min(
            jsonText.indexOf('[') !== -1 ? jsonText.indexOf('[') : Infinity,
            jsonText.indexOf('{') !== -1 ? jsonText.indexOf('{') : Infinity
        );
        const lastBracket = Math.max(jsonText.lastIndexOf(']'), jsonText.lastIndexOf('}'));
        if (firstBracket !== Infinity && lastBracket !== -1 && lastBracket > firstBracket) {
            jsonText = jsonText.substring(firstBracket, lastBracket + 1);
        }
    }

    // 【阶段 2: 畸形修复与 JSON 尝试】
    try {
        parsedData = JSON.parse(jsonText);
        isParsedObject = true;
    } catch {
        try {
            // 清除非法控制字符
            let cleaned = jsonText.replace(/[\u0000-\u001F]+/g, ' ');
            // 修复尾随逗号 
            cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
            parsedData = JSON.parse(cleaned);
            isParsedObject = true;
        } catch (e) {
            isParsedObject = false;
        }
    }

    if (isParsedObject) {
        try {
            const arr = extractArrayFromParsed(parsedData);
            const validated = arr.filter((item: any) => {
                if (item && typeof item.i === 'number' && typeof item.t === 'string') {
                    return true;
                }
                console.warn('[AI Response] 跳过无效翻译项:', typeof item === 'object' ? JSON.stringify(item).substring(0, 50) : item);
                return false;
            });
            if (validated.length > 0) {
                return validated as Array<{ i: number; t: string }>;
            }
        } catch (e) {
            console.warn('[AI Response] 抽取 JSON 对象失败，准备降级为正则提取...', (e as Error).message);
        }
    }

    // 【阶段 3: 终极降维打击（正则表达式强行外科手术提取）】
    console.warn('[AI Response] 标准 JSON 解析失败或无有效条目，启动正则外科手术强行提取数据...');
    const fallbackResults: Array<{ i: number; t: string }> = [];
    const extractRegex = /"i"\s*:\s*(\d+)\s*,\s*"t"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;

    let match;
    while ((match = extractRegex.exec(content)) !== null) {
        try {
            const id = parseInt(match[1]);
            let unescapedText = match[2];
            try {
                // 最快且安全的反转义
                unescapedText = JSON.parse(`"${match[2]}"`);
            } catch {
                unescapedText = unescapedText.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }
            fallbackResults.push({ i: id, t: unescapedText });
        } catch (e) {
            // 忽略单个畸形项
        }
    }

    if (fallbackResults.length > 0) {
        console.warn(`[AI Response] 成功通过正则抢救出 ${fallbackResults.length} 条数据！`);
        return fallbackResults;
    }

    throw new Error('AI 返回数据格式严重损坏，正则急救也未能提取到业务结构 ({i, t})。');
}

/**
 * 智能数组向下钻取
 */
function extractArrayFromParsed(data: unknown): any[] {
    if (Array.isArray(data)) {
        return data;
    }

    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const obj = data as Record<string, unknown>;
        for (const value of Object.values(obj)) {
            if (Array.isArray(value) && value.length > 0) {
                return value;
            }
        }
        if ('i' in obj && 't' in obj) {
            return [obj];
        }
    }

    const preview = JSON.stringify(data).substring(0, 200);
    throw new Error(`无法从返回信息中识别提取数组: ${preview}`);
}
