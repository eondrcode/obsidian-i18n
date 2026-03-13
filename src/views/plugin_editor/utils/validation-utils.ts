
/**
 * 验证括号平衡 ((), [], {})
 */
export function validateBracketBalance(text: string): boolean {
    if (!text) return true;
    const stack: string[] = [];
    const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

    for (const char of text) {
        if (['(', '[', '{'].includes(char)) {
            stack.push(char);
        } else if ([')', ']', '}'].includes(char)) {
            const last = stack.pop();
            if (last !== pairs[char]) return false;
        }
    }
    return stack.length === 0;
}

/**
 * 验证变量一致性
 * 检查源文本中的变量 (如 {0}, %s, ${var}) 是否在目标文本中由于
 */
export function validateVariableConsistency(source: string, target: string): boolean {
    if (!source || !target) return true;

    // 匹配常见的变量模式: {0}, {name}, %s, %d, $var, ${var}
    const variableRegex = /(\{\w+\}|%\w+|\$\w+|\$\{\w+\})/g;

    const sourceVars = source.match(variableRegex) || [];
    const targetVars = target.match(variableRegex) || [];

    // 简单比对变量数量是否一致 (更严格的比对可以检查具体变量名，但可能误报)
    // 这里我们检查源文本中的所有变量是否都出现在目标文本中
    for (const v of sourceVars) {
        if (!target.includes(v)) {
            return false;
        }
    }
    return true;
}

/**
 * 验证标点符号一致性 (结尾标点)
 */
export function validatePunctuation(source: string, target: string): boolean {
    if (!source || !target) return true;

    const punctuationRegex = /[.!?:;。！？：；]$/;
    const sourceMatch = source.trim().match(punctuationRegex);
    const targetMatch = target.trim().match(punctuationRegex);

    // 如果源文本没有标点结束，不强制要求目标文本也没有（可能有语境变化）
    // 但如果源文本有标点，目标文本最好也有（或者是对应的中文标点）
    if (sourceMatch) {
        // 如果源文本有标点，目标文本没有，视为不一致
        if (!targetMatch) return false;

        // 进一步可以检查标点类型是否匹配 (比如 ? 对 ？)，暂从简
    }

    return true;
}
