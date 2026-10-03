# 移动端悬浮快捷菜单：组件库参考规格

> 基于 Firefly 已实现的移动端按钮整理。本文是抽取独立组件时的设计与行为参考，并不是现成的 npm 包或可直接复制的组件源码。

## 1. 一句话定义

一个固定在移动端右下角的 **Floating Action Button（FAB）+ Speed Dial**：平时只显示一个圆形 `+` 主按钮；打开后，操作项以「左侧文字胶囊 + 右侧圆形图标」的形式沿右边缘向上依次展开。操作项直接浮在页面上，没有包住整组按钮的矩形菜单卡片。

Firefly 当前的操作项是「深色主题」「浅色主题」「回到顶部」。组件库应把它们视为外部传入的动作数据，而不是把主题或回顶写死在组件内部。

```text
收起                      展开

                         [ 深色 ]  ◐
                         [ 浅色 ]  ◑
                       [ 回到顶部 ] ↑
                    [+]             [×]
```

## 2. 视觉结构

| 元素 | Firefly 当前实现 | 独立组件建议 |
| --- | --- | --- |
| 主按钮 | 52 × 52px 圆形按钮，右下角固定；`+` 旋转 45° 后成为 `×` | 尺寸、图标和偏移量可配置；默认保留 44px 以上触控区域 |
| 子操作 | 圆形图标按钮至少 44 × 44px；左侧有独立的文字胶囊 | 动作数量由数据驱动；长标签限制宽度并省略 |
| 当前选中项 | 主题按钮使用强调色、较明显的圆形边框和 `aria-pressed` | 选中态由外部传入，不能只靠颜色表达 |
| 容器 | 子操作所在容器透明，无整块背景或边框 | 不把它改成表单面板或矩形卡片 |
| 背景遮罩 | 展开时用主题文字色约 8% 不透明度轻微压低正文 | 遮罩颜色与强度用主题 token 配置；点击遮罩关闭 |
| 层级 | 遮罩在正文之上、按钮之下 | 与页面其他浮层约定层级，避免压住系统级对话框 |

Firefly 以语义颜色变量设置表面、文字、边框、强调色和阴影，因此深浅主题共用同一套结构。独立组件可以接受如下变量，避免依赖 Firefly 的 `--terminal-color-*`：

```css
--speed-dial-surface
--speed-dial-text
--speed-dial-border
--speed-dial-accent
--speed-dial-shadow
--speed-dial-backdrop
--speed-dial-focus
```

## 3. 状态与交互

| 事件 | 结果 |
| --- | --- |
| 点击收起的主按钮 | 打开子操作，主按钮变成关闭形态，焦点进入当前选中的操作；没有选中项时进入第一个操作 |
| 点击打开的主按钮、按 Escape、点击遮罩或菜单外 | 收起菜单；必要时把焦点还给主按钮 |
| 点击子操作 | 调用宿主传入的回调，然后收起菜单并把焦点还给主按钮 |
| 快速反复点击主按钮 | 视觉状态、`aria-expanded`、焦点和可点击状态保持一致，不留下隐形可点的操作 |
| 输入设备从触屏模式切到非触屏模式 | 隐藏组件；如果焦点仍在组件内，先转移到正文等安全位置 |

收起后，子操作应立即退出键盘顺序和辅助技术树。Firefly 通过 `inert` 与 `aria-hidden` 立即处理交互，再延迟 CSS `visibility`，让反向收起动画能够完整播放；不要只设置 `opacity: 0`，否则隐形按钮仍可能被聚焦或点击。没有 JavaScript 时，Firefly 的整个快捷菜单保持隐藏，正文仍可正常阅读。

## 4. 动画规格

Firefly 现有参数可作为组件默认值：

```text
子操作收起：translateY(20px) scale(0.7)，opacity: 0
子操作展开：translateY(0)    scale(1)，  opacity: 1
位移/缩放：  260ms cubic-bezier(0.34, 1.56, 0.64, 1)
透明度：     180ms ease-out
错峰间隔：   45ms
主按钮旋转： 260ms，0° → 45°
遮罩淡入淡出：220ms
```

展开时从靠近主按钮的子操作开始，依次向上出现；收起时顺序反转。子操作数量可变时，应按数量计算延迟和容器隐藏时间，不能写死三项。`prefers-reduced-motion: reduce` 时取消位移、缩放、旋转过渡与错峰，状态直接切换；回到顶部也使用即时滚动。

## 5. 位置与页面协作

- 固定在视口右下角，偏移至少覆盖 `safe-area-inset-right` 与 `safe-area-inset-bottom`。
- 页面若有固定底部导航或状态栏，宿主提供其高度；主按钮整体上移，避免遮挡导航。
- 正文末尾预留足够底部空间，使最后一行内容能滚动到悬浮按钮上方。
- 子操作数量较多时限制展开区域的最大高度并允许内部滚动；不要让按钮超出视口。
- Firefly 仅在 `(hover: none) and (pointer: coarse)` 匹配时显示。组件库应允许宿主决定显示条件，而不是把“移动端 = 屏宽小”写死。

## 6. 建议的组件接口

组件负责**呈现、开合、动效、焦点与遮罩**；宿主负责**动作定义、主题持久化、业务命令和滚动目标**。一个框架无关的数据形状可以是：

```ts
type SpeedDialAction = {
  id: string;
  label: string;
  icon: unknown;                 // 由所用 UI 框架定义图标插槽类型
  selected?: boolean;
  onActivate: () => void;
};

type SpeedDialOptions = {
  actions: SpeedDialAction[];
  launcherLabel: string;          // 例如“快捷操作”
  bottomObstacleHeight?: number;  // 固定导航/状态栏高度
  visible?: boolean;              // 宿主控制触屏等显示条件
  motion?: 'auto' | 'reduce';      // auto 遵循系统偏好
};
```

Firefly 的适配层从 CSS 主题注册表生成主题动作，以配置文件名为稳定 `id`，以 CSS 中的 `--terminal-theme-label` 为显示文案；主题动作调用现有的主题设置函数。回顶动作调用滚动接口。**独立组件本身不读取 Firefly 的 CSS 文件、不写 `localStorage`、不认识 `theme` 命令，也不要求特定路由或内容主题。**

## 7. 无障碍验收

- 主按钮是真正的 `<button>`，有可理解的名称、`aria-controls` 和正确的 `aria-expanded`。
- 子操作也是真正的按钮；选中的主题用 `aria-pressed` 表达。
- 装饰性 SVG 对辅助技术隐藏；文字标签与按钮名称一致。
- 打开时将焦点移到当前选中项；关闭时合理恢复焦点。菜单关闭时按 Escape 不抢走页面焦点。
- 遮罩不进入键盘导航；关闭后的子操作不可聚焦、不可点击。
- 所有操作有可见焦点样式，触控区域至少 44 × 44px；减少动画偏好生效。

## 8. 组件库验收清单

1. 深浅主题、短标签和长标签下均无横向溢出；收起时页面只出现一个主按钮。
2. 动作列表由数据生成；新增主题只增加数据项，不修改 Speed Dial 内部逻辑。
3. 展开、反向收起、错峰顺序和快速连点均保持视觉与可访问状态同步。
4. Escape、遮罩、页面外点击、主按钮和子操作都按上表工作。
5. 禁用 JavaScript、非触屏模式、减少动画模式和底部固定导航场景均有明确行为。
6. 页面末尾可滚动至按钮上方；按钮与子操作不越过安全区域或视口边缘。

## 9. Firefly 实现定位

- 结构和交互：`apps/site/src/layouts/TerminalLayout.astro`
- 外观与动效：`apps/site/src/styles/terminal.css` 中的 `.terminal-quick-*` 规则
- 主题动作来源：`apps/site/src/lib/terminal-theme-registry.ts` 与 `apps/site/src/styles/terminal-themes/*.css`
- 行为验证：`apps/site/tests/mobile-homepage.spec.ts`、`apps/site/tests/static-output.test.mjs`

抽取组件时可参考这些文件的已验证行为，但应使用第 6 节的边界重写接口，避免把 Firefly 的页面根节点、存储键、主题命令或构建方式带进通用组件库。
