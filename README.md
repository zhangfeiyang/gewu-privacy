# 格物实验

格物实验是一款离线互动科学仿真实验室，同时提供微信小程序和 Android APK。

- 100 个互动实验
- 覆盖力学、波动与光、电磁、热学、原子、化学和人工智能
- 支持搜索、收藏、最近使用、探索进度、随机实验、触感和系统分享
- 支持中文 / English 切换，首页、实验控件、数据栏和画布文字同步翻译
- Android 构建直接打包小程序的 `gewu-miniprogram/utils/sims.js`，实验逻辑保持单一来源
- 支持拖动摆球、弹簧重物、滑板手、碰撞球、液压活塞等直接触摸交互
- 自由电路实验支持拖放电源、灯泡、电阻和开关，从接线柱手动连线，并显示电子流动

## Android 构建

环境要求：

- JDK 17
- Android SDK 35

```bash
./gradlew :app:assembleDebug
```

APK 输出：

```text
app/build/outputs/apk/debug/app-debug.apk
```

Google Play AAB：

```bash
./gradlew :app:bundleRelease
```

```text
app/build/outputs/bundle/release/app-release.aab
```

## 验证

```bash
./gradlew :app:lintDebug
```

WebView 交互回归测试位于 `.ci/test_web_assets.py`，覆盖全部 100 个实验、移动端触摸滚动、控件、画布交互和独立数据栏。
其中布局回归会在 `320×568`、`360×568` 与 `390×720` 三种视口逐个打开全部实验，确保主要控制内容默认可见；极端字体缩放或更矮窗口仍保留控制区滚动作为兜底。

## 项目结构

```text
app/                  Android 应用与离线 WebView 外壳
gewu-miniprogram/     微信小程序与共享仿真逻辑
.ci/                  浏览器回归和截图审查脚本
```
