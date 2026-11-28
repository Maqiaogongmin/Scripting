# NBA 赛程 · Glass

适用于 Scripting App

[点击安装](https://scripting.fun/import_scripts?urls=%5B%22https%3A%2F%2Fgithub.com%2FMaqiaogongmin%2FScripting%2Ftree%2Fmain%2Fscripts%2FNBA-Glass%22%5D) · [版本下载](https://github.com/Maqiaogongmin/Scripting/releases/tag/nba-glass-v0.6.3)

NBA 赛程 · Glass 把整个赛季的赛程、球员评分和球迷评论放进同一个脚本。近日、赛季、组件三个底部标签，让查比赛和看赛后讨论各有位置；中性蓝灰玻璃界面兼顾清晰度和轻盈感。

- 近日：先显示缓存，再刷新近期赛程和赛果。球队排行可切换东西部，显示名次、胜负、胜率和胜场差。
- 赛季：点击右上角「同步完整赛季」获取所有已公布比赛，按阶段、球队、月份和日期筛选。筛选栏默认折叠。
- 比赛详情：切换两队及“评分 / 技术统计”，查看球员评分、评论和完整统计表；详情刷新直接更新本场比分与状态。
- 球员资料：点击头像或姓名查看基本资料、年薪、薪资排名和合同。本赛季保留基础、进阶与三项命中率；生涯展示累计及单场最高数据，历季统计按赛季筛选，默认最新赛季，补充首发、时间、抢断、盖帽和投篮明细。14区域投篮热图随所选赛季更新，可展开精确命中率及命中/出手次数。
- 桌面组件：小号突出单场，中号按日期分列，大号展示多场，超大号显示更多赛程；支持球队图标与比赛入口。

## 使用

1. 安装并运行「NBA赛程」。旧版 ZIP 用户可在脚本设置中把远程来源改为下方的 GitHub 目录，再检查更新。
2. 点击比赛查看详情。评分与战绩随来源发布后更新。
3. 长按桌面添加 Scripting 组件，选择尺寸，并将脚本设为「NBA赛程」。可在脚本「组件」页预览。

```text
https://github.com/Maqiaogongmin/Scripting/tree/main/scripts/NBA-Glass
```

赛程、评分、评论和球员资料来自虎扑，球队排行来自 ESPN。时间统一为北京时间。系统决定组件实际刷新时机。

## 开发

`index.tsx` 是页面入口，`widget.tsx` 是组件入口，`boxscore-ui.tsx` 是技术统计表，`shooting-ui.tsx` 是逐季投篮热区，`ui.tsx` 是共享视觉组件，`runtime/` 包含数据、缓存、筛选及尺寸预算。

从仓库根目录运行 `python3 tools/package_scripts.py NBA-Glass` 打包。修改 Scripting API 前，请核对 [官方文档](https://scriptingapp.github.io/llms.txt)。

数据接口研究参考：[hupuX](https://github.com/bidabrain/hupuX)、[flutter-template](https://github.com/dirkhe1051931999/flutter-template)。玻璃界面方向参考：[girigirilove Glass C](https://github.com/OkadaMei/Scripting)。
