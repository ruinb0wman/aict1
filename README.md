# dict - AI 词典工具

一个 AI 驱动的词典桌面应用，将单词发送给配置好的大模型 API，按固定格式返回内容并渲染展示。

## 功能特性

- 🔍 **单词查询** - 查询词性、翻译、例句和音标
- 🔊 **单词发音** - 点击喇叭图标播放发音（Google Translate TTS）
- 📝 **语句翻译** - 支持整句翻译，自动识别单词/句子
- ⭐ **收藏单词** - 支持搜索、导入导出（JSON 格式）
- 📚 **复习单词** - 卡片式翻转复习，「认识/不认识」评分
- 📝 **查询历史** - 自动保存，支持重新查看、单条删除和清空
- ✏️ **单词编辑** - 自定义翻译、例句，添加个人批注
- 📋 **自动读取剪切板** - 自动检测英文内容并翻译
- ⚙️ **自定义配置** - 支持大模型 API（OpenAI 通用格式）
- 💾 **本地缓存** - IndexedDB (Dexie.js) 缓存，重复查询免 API 调用
- 🖥️ **系统托盘** - 托盘常驻，关闭窗口隐藏而非退出

## Preview

|查询|语法|收藏|学习|历史|设置|
|-|-|-|-|-|-|
|![](./README/Trans.png)|![](./README/Grammar.png)|![](./README/Fav.png)|![](./README/Review.png)|![](./README/History.png)|![](./README/Setting.png)|

## 技术栈

- **框架**：Tauri v2 + React 19 + Vite
- **数据库**：dexie.js (IndexedDB)
- **状态管理**：Zustand
- **样式**：Tailwind CSS v4
- **语言**：TypeScript
- **图标**：lucide-react
- **包管理器**：bun

### 视觉风格

- **整体风格**：极简主义，深色主题
- **主色调**：红色 `#f56565`（强调）
- **背景色**：深灰 `#1b1b1f`（主背景）、浅灰 `#202127`（卡片背景）
- **文字色**：白色 `#ffffff`（主要）、灰色 `#a0a0a0`（次要）
- **字体**：系统默认字体栈
- **图标**：Lucide 线性图标，1.5px 细线条
- **圆角**：小元素 6px，大元素 12px

## License

本项目采用 [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE)。

### 商业许可

如需闭源商用，请联系 📧 **ruinb0wman@gmail.com**
