# 格物实验

格物实验是一款离线互动科学仿真实验室，同时提供微信小程序和 Android APK。

- 100 个互动实验
- 覆盖力学、波动与光、电磁、热学、原子、化学和人工智能
- 支持搜索、收藏、最近使用、探索进度、随机实验、触感和系统分享
- Android 构建直接打包小程序的 `gewu-miniprogram/utils/sims.js`，实验逻辑保持单一来源

## Android 构建

环境要求：

- JDK 17
- Android SDK 34

```bash
./gradlew :app:assembleDebug
```

APK 输出：

```text
app/build/outputs/apk/debug/app-debug.apk
```

## 验证

```bash
./gradlew :app:lintDebug
```

WebView 交互回归测试位于 `.ci/test_web_assets.py`，覆盖全部 100 个实验、移动端触摸滚动、控件、画布交互和独立数据栏。

## 项目结构

```text
app/                  Android 应用与离线 WebView 外壳
gewu-miniprogram/     微信小程序与共享仿真逻辑
.ci/                  浏览器回归和截图审查脚本
```
