# heartbreak-guide skill

让 Claude Code 或 Codex 照《失恋后自救手册》回答分手后的具体问题。它会先查书里的条目，再回答，并注明出自第几节第几条。书里没写的，它会直接说没写。

## 安装

Claude Code（装到个人目录，所有项目都能用）：

```bash
mkdir -p ~/.claude/skills && cp -R skills/heartbreak-guide ~/.claude/skills/
```

Codex：

```bash
mkdir -p ~/.codex/skills && cp -R skills/heartbreak-guide ~/.codex/skills/
```

## 用法

装好以后直接问，比如：

- 分手三天了，要不要把他微信删了？
- 合租的房子只有我签了字，他不肯搬怎么办？
- 前任说要把我们的照片发出去，我该怎么办？

## 它不会做的事

不教挽回，不教报复，不做心理诊断。用户提到不想活、正在被威胁时，它会先给 12356 或 110，再回答别的。
