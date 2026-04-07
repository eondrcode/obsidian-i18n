const CONTENT_RULES = {
    REJECT_PATTERNS: [
        /^\s*$/, /^\d+$/, /^[\w-]+\.[\w-]+\.\w+$/, /^https?:\/\//i, /^data:image\//i,
        /^#([0-9a-f]{3}|[0-9a-f]{6})$/i, /^[a-z0-9-]+$/, /^[a-z]+[A-Z][a-zA-Z0-9]*$/,
        /^[A-Z_][A-Z0-9_]*$/, /^(px|em|rem|vh|vw|auto)$/i, /^rgba?\(/i, /^\./,
        /\.(png|jpg|gif|svg|css|js|ts|md|json)$/i
    ],
    VALID_PATTERNS: [
        /\s/, /[^\x00-\x7F]/, /[!?,;:。！？，；：]\s*$/
    ]
};

function isValidText(text) {
    if (text.length < 2) return false;
    if (CONTENT_RULES.REJECT_PATTERNS.some(regex => regex.test(text))) return false;
    if (CONTENT_RULES.VALID_PATTERNS.some(regex => regex.test(text))) return true;
    return false;
}

const testStrings = [
    "If enabled all beta themes will be checked for updates each time Obsidian starts.",
    "System settings",
    "Remote server",
    "View history",
    "px",
    "em",
    "12px",
    "auto"
];

testStrings.forEach(s => {
    console.log(`"${s}" -> ${isValidText(s)}`);
});
