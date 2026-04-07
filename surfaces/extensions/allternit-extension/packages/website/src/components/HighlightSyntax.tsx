/**
 * js 语法高亮组件，适合在文章中演示代码片段
 */
import React from 'react'

import styles from './HighlightSyntax.module.css'

interface HighlightSyntaxProps {
	code: string
}

// JavaScript/TypeScript 关键字
const keywords =
	'async|await|function|const|let|var|if|else|for|while|return|try|catch|finally|class|extends|from|import|export|default|undefined|throw|break|continue|switch|case|do|with|yield|delete|typeof|void|static|get|set|super|debugger'

// TypeScript 特定关键字
const tsKeywords =
	'interface|type|enum|namespace|module|declare|abstract|implements|public|private|protected|readonly|as|satisfies|infer|keyof|is'

// 布尔值和空值
const literals = 'true|false|null|undefined|NaN|Infinity'

// TypeScript 内置类型
const tsTypes =
	'string|number|boolean|any|unknown|never|void|object|symbol|bigint|Array|Promise|Record|Partial|Required|Readonly|Pick|Omit|Exclude|Extract|NonNullable|ReturnType|Parameters|ConstructorParameters|InstanceType|ThisType|Uppercase|Lowercase|Capitalize|Uncapitalize'

function renderToken(token: string, key: number): React.ReactNode {
	if (/^\s+$/.test(token)) {
		return token
	}

	if (/^\/\/.*$/.test(token) || /^\/\*[\s\S]*?\*\/$/.test(token)) {
		return (
			<span key={key} className={styles.comment}>
				{token}
			</span>
		)
	}

	if (
		/^"([^"\\]|\\.)*"$/.test(token) ||
		/^'([^'\\]|\\.)*'$/.test(token) ||
		/^`([^`\\]|\\.)*`$/.test(token)
	) {
		return (
			<span key={key} className={styles.string}>
				{token}
			</span>
		)
	}

	if (/^(0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)$/.test(token)) {
		return (
			<span key={key} className={styles.number}>
				{token}
			</span>
		)
	}

	if (new RegExp(`^(?:${literals})$`).test(token)) {
		return (
			<span key={key} className={styles.literal}>
				{token}
			</span>
		)
	}

	if (new RegExp(`^(?:${keywords})$`).test(token)) {
		return (
			<span key={key} className={styles.keyword}>
				{token}
			</span>
		)
	}

	if (new RegExp(`^(?:${tsKeywords})$`).test(token)) {
		return (
			<span key={key} className={styles.tsKeyword}>
				{token}
			</span>
		)
	}

	if (new RegExp(`^(?:${tsTypes})$`).test(token)) {
		return (
			<span key={key} className={styles.type}>
				{token}
			</span>
		)
	}

	if (/^@[a-zA-Z_$][\w$]*$/.test(token)) {
		return (
			<span key={key} className={styles.decorator}>
				{token}
			</span>
		)
	}

	if (token === '=>') {
		return (
			<span key={key} className={styles.arrow}>
				{token}
			</span>
		)
	}

	if (/^[a-zA-Z_$][\w$]*$/.test(token)) {
		return (
			<span key={key} className={styles.identifier}>
				{token}
			</span>
		)
	}

	if (/^\.[a-zA-Z_$][\w$]*$/.test(token)) {
		return (
			<span key={key} className={styles.property}>
				{token}
			</span>
		)
	}

	if (/^[+\-*/%&|^!~<>=?:]+$/.test(token)) {
		return (
			<span key={key} className={styles.operator}>
				{token}
			</span>
		)
	}

	return token
}

// 语法高亮函数，先提取 token 再渲染
function highlightSyntax(code: string): React.ReactNode[] {
	// 构建正则模式，包含更多 token 类型（在原始文本上匹配）
	const pattern = new RegExp(
		'(' +
			// 1. 字符串（双引号、单引号、模板字符串）
			'"([^"\\\\]|\\\\.)*"|' +
			"'([^'\\\\]|\\\\.)*'|" +
			'`([^`\\\\]|\\\\.)*`|' +
			// 2. 注释（单行和多行）
			'//[^\\n]*|' +
			'/\\*[\\s\\S]*?\\*/|' +
			// 3. 装饰器
			'@[a-zA-Z_$][\\w$]*|' +
			// 4. 数字（包括小数、十六进制、科学计数法）
			'\\b0[xX][0-9a-fA-F]+\\b|' +
			'\\b\\d+\\.?\\d*(?:[eE][+-]?\\d+)?\\b|' +
			// 5. TypeScript/JavaScript 关键字
			'\\b(?:' +
			keywords +
			'|' +
			tsKeywords +
			'|' +
			literals +
			')\\b|' +
			// 6. TypeScript 内置类型
			'\\b(?:' +
			tsTypes +
			')\\b|' +
			// 7. 箭头函数
			'=>|' +
			// 8. 函数调用（函数名后跟括号）
			'\\b[a-zA-Z_$][\\w$]*(?=\\()|' +
			// 9. 属性访问
			'\\.[a-zA-Z_$][\\w$]*|' +
			// 10. 运算符和特殊符号
			'[+\\-*/%&|^!~<>=?:]+|' +
			'[{}\\[\\]();,.]' +
			')',
		'g'
	)

	const tokens: string[] = []
	let lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = pattern.exec(code)) !== null) {
		if (match.index > lastIndex) {
			const gap = code.slice(lastIndex, match.index)
			// 将间隙按空白符分割，保留空白符
			tokens.push(...gap.split(/(\s+)/))
		}
		tokens.push(match[0])
		lastIndex = pattern.lastIndex
	}
	if (lastIndex < code.length) {
		tokens.push(...code.slice(lastIndex).split(/(\s+)/))
	}

	return tokens.map((token, index) => renderToken(token, index))
}

const HighlightSyntaxClient: React.FC<HighlightSyntaxProps> = ({ code }) => {
	return <code className={styles.syntax}>{highlightSyntax(code)}</code>
}

export default HighlightSyntaxClient
