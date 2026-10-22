# Scripting

我的 Scripting App 脚本合集，持续更新。

| 脚本 | 功能 | 安装 |
| --- | --- | --- |
| [NBA 赛程 · Glass](scripts/NBA-Glass) | 全赛季赛程、虎扑球员评分与评论、多尺寸桌面组件 | [点击安装](https://scripting.fun/import_scripts?urls=%5B%22https%3A%2F%2Fgithub.com%2FMaqiaogongmin%2FScripting%2Freleases%2Fdownload%2Fnba-glass-v0.5.0%2FNBA-Glass.zip%22%5D) |

先在 iPhone / iPad 上安装 [Scripting App](https://scripting.fun/)，再通过上方链接导入脚本。

## 仓库结构

- `scripts/`：各脚本的完整运行源码。
- `tools/`：打包工具。
- [Releases](https://github.com/Maqiaogongmin/Scripting/releases)：可直接导入的 ZIP 安装包及版本记录。

## 从源码打包

```sh
python3 tools/package_scripts.py NBA-Glass
```

生成 `dist/NBA-Glass.zip`，通过 Scripting 导入。

## 数据层回归检查

使用 Node.js 24 或更新版本：

```sh
node --test tests/*.test.mjs
```

测试样本仅保留本场公开赛程与球员技术统计；不包含用户评论、登录数据或开发环境配置。
