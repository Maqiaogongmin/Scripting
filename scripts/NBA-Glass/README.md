# NBA 赛程 · Glass

v0.4.0 · 适用于 Scripting App

[点击安装](https://scripting.fun/import_scripts?urls=%5B%22https%3A%2F%2Fgithub.com%2FMaqiaogongmin%2FScripting%2Freleases%2Fdownload%2Fnba-glass-v0.4.0%2FNBA-Glass.zip%22%5D) · [版本下载](https://github.com/Maqiaogongmin/Scripting/releases/tag/nba-glass-v0.4.0)

NBA 赛程 · Glass 把整个赛季的赛程、球员评分和球迷评论放进同一个脚本。近日、赛季、组件三个底部标签，让查比赛和看赛后讨论各有位置；中性蓝灰玻璃界面兼顾清晰度和轻盈感。

- 近日：查看接下来三个比赛日，切换近期赛果。
- 赛季：浏览当前赛季全部已公布赛程，按阶段、球队、月份和日期筛选；筛选栏默认折叠。
- 比赛详情：两队切换，查看虎扑球员评分、热评及分页最新评论。
- 桌面组件：小号突出单场，中号按日期分列，大号展示多场，超大号显示更多赛程；支持球队图标与比赛入口。
- 本机缓存：再次打开可先显示已有数据；联网更新后替换缓存。

## 使用

1. 安装并运行「NBA赛程」，等待首次赛程同步。
2. 点击比赛查看详情；赛后评分以来源实际公布为准。
3. 长按桌面添加 Scripting 组件，选择尺寸，并将脚本设为「NBA赛程」。可在脚本「组件」页预览。

时间统一为北京时间。数据来自虎扑公开接口，无需虎扑账号；已公布赛程随数据源更新，系统决定组件实际刷新时机。超大号和锁屏组件的可用尺寸由设备与系统决定。

## 开发

`index.tsx` 是页面入口，`widget.tsx` 是组件入口，`ui.tsx` 是共享视觉组件，`runtime/` 包含数据、缓存、筛选及尺寸预算。

从仓库根目录运行 `python3 tools/package_scripts.py NBA-Glass` 打包。修改 Scripting API 前，请核对 [官方文档](https://scriptingapp.github.io/llms.txt)。

数据接口研究参考：[hupuX](https://github.com/bidabrain/hupuX)、[flutter-template](https://github.com/dirkhe1051931999/flutter-template)。玻璃界面方向参考：[girigirilove Glass C](https://github.com/OkadaMei/Scripting)。

本版本通过类型检查与 23 项自动检查；开发中依据用户 iPhone 截图迭代，最新组件视觉仍以设备实际显示为准。
