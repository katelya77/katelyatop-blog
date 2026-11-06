const BLOCKING_RULES = [
	{
		code: "secret-token",
		message: "检测到疑似访问令牌、API Key 或签名凭据",
		pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/i,
	},
	{
		code: "jwt-token",
		message: "检测到疑似 JWT 会话令牌",
		pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
	},
	{
		code: "private-key",
		message: "检测到私钥或证书私密材料标记",
		pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/i,
	},
	{
		code: "credential-assignment",
		message: "检测到疑似明文密码、Token 或 Secret 赋值",
		pattern: /\b(?:password|passwd|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|secret[_ -]?key|authorization)\s*[:=]\s*["']?(?!YOUR\b|YOUR_|REDACTED\b|PLACEHOLDER\b|EXAMPLE\b)[A-Za-z0-9+/_=.-]{8,}/i,
	},
	{
		code: "bearer-credential",
		message: "检测到疑似 Bearer 凭据",
		pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}={0,2}\b/i,
	},
	{
		code: "credential-url",
		message: "检测到 URL 中嵌入的用户名或密码",
		pattern: /\bhttps?:\/\/[^/\s:@]+:[^@\s/]+@/i,
	},
	{
		code: "private-network-address",
		message: "检测到 RFC1918 私有网络地址",
		pattern: /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/,
	},
	{
		code: "internal-domain",
		message: "检测到可能属于内部网络的域名",
		pattern: /\b(?:[a-z0-9-]+\.)+(?:internal|local|lan)\b/i,
	},
	{
		code: "local-filesystem-path",
		message: "检测到疑似个人设备或服务器的绝对路径",
		pattern: /(?:\/(?:root|home|Users|mnt\/data)\/[^\s"'<>]+|\b[A-Z]:\\(?:Users|Documents and Settings)\\[^\s"'<>]+)/i,
	},
	{
		code: "phone-number",
		message: "检测到疑似个人手机号",
		pattern: /\b1[3-9]\d{9}\b/,
	},
	{
		code: "government-id",
		message: "检测到疑似身份证号码",
		pattern: /\b\d{17}[\dXx]\b/,
	},
	{
		code: "student-identifier",
		message: "检测到疑似学号、学生证号或个人账号",
		pattern: /(?:学号|学生证号|身份证号|手机号|个人账号)\s*[:：]?\s*[A-Za-z0-9-]{5,}/i,
	},
	{
		code: "raw-chat-transcript",
		message: "检测到疑似原始 GPT 对话角色行，不允许直接发布聊天记录",
		pattern: /^\s*(?:user|assistant|system|developer)\s*:/im,
	},
];

const REVIEW_RULES = [
	{
		code: "email-address",
		message: "检测到邮箱地址，必须确认它是公开联系方式而非私人邮箱",
		pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
	},
];

export function scanPublicContent(value = "") {
	const content = String(value);
	const blocking = BLOCKING_RULES.filter((rule) => rule.pattern.test(content)).map(
		({ code, message }) => ({ code, message }),
	);
	const review = REVIEW_RULES.filter((rule) => rule.pattern.test(content)).map(
		({ code, message }) => ({ code, message }),
	);

	return {
		ok: blocking.length === 0 && review.length === 0,
		blocking,
		review,
	};
}
