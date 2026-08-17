---
title: ESP32 入坑第一课：GPIO、UART、I²C、SPI 到底在解决什么问题？
author: Katelya
published: 2026-08-17
category: 嵌入式
tags: [ESP32, 单片机, GPIO, UART, I2C, SPI, IoT, Wokwi]
draft: false
pinned: false
comment: true
description: 一份面向嵌入式新手的 ESP32 学习实验室笔记：不死背缩写，而是从“MCU 为什么要和外设通信”出发，建立 GPIO、UART、I²C、SPI 的统一心智模型，并给出无需购买开发板即可复现的 Wokwi 最小实验。
---

最近准备把技术栈从服务器、网络、Web 再往下探一层，我开始系统补嵌入式和单片机基础。

这篇不是“玩了很多年 ESP32 后的经验总结”，而是一份**从软件开发视角进入 MCU 世界的学习实验室笔记**。

刚接触单片机时，最容易撞上的四个词通常是：

```text
GPIO
UART
I2C / I²C
SPI
```

教程经常会直接告诉你：

- GPIO 可以点灯；
- UART 可以串口打印；
- I²C 两根线能挂很多传感器；
- SPI 速度快，适合屏幕和 Flash。

这些都没错，但如果只记用途，换一个芯片、换一个传感器，很快又会乱。

我更想先回答一个底层问题：

> **为什么一个 MCU 需要这么多不同的“和外界说话”的方式？**

理解这个问题之后，GPIO、UART、I²C 和 SPI 就不再是四套零散 API，而是四种不同的通信取舍。

## MCU 本质上是一个被现实世界包围的小计算机

在 PC / Web 开发里，我们很少直接考虑“一根线现在是高电平还是低电平”。

应用层看到的通常已经是：

```text
HTTP
WebSocket
TCP
文件
数据库
JSON
```

但 MCU 往下走之后，抽象层突然变薄了。

假设我想做一个最简单的环境监测节点，它可能包含：

```text
ESP32
 ├─ LED
 ├─ 温湿度传感器
 ├─ OLED 屏幕
 ├─ 外部 Flash
 └─ 另一个 MCU / USB 串口
```

CPU 能执行代码，却不能凭空知道温度，也不能直接让 OLED 出现文字。

它必须通过物理引脚和外设交换信息。

所以可以先建立一个统一模型：

```text
CPU / 程序
    ↓
ESP32 外设控制器
    ↓
GPIO 引脚
    ↓
电平 / 时钟 / 数据线
    ↓
真实外部设备
```

GPIO、UART、I²C、SPI 的区别，本质上就是：

**我们准备怎样组织这些电平变化。**

---

## GPIO：它甚至不是“通信协议”

GPIO 全称 General Purpose Input/Output，通用输入输出。

它最基础的能力非常直接：

```text
输出：我把这个引脚拉高 / 拉低
输入：我读取这个引脚现在是高 / 低
```

比如：

```text
GPIO18 = HIGH
```

可以让连接在 GPIO18 上的 LED 导通；按钮则可以反过来改变某个 GPIO 输入状态。

### GPIO 最值得先理解的一点

**GPIO 是引脚能力，而 UART / I²C / SPI 是建立在引脚之上的外设与通信机制。**

所以不要把下面四个概念理解成平级协议：

```text
GPIO | UART | I2C | SPI
```

更像是：

```text
物理 GPIO 引脚
   ├─ 被程序当普通数字输入/输出
   ├─ 路由给 UART 控制器
   ├─ 路由给 I2C 控制器
   └─ 路由给 SPI 控制器
```

ESP32 很有意思的一点就是它有 GPIO Matrix。Espressif 的官方文档说明，很多内部外设信号可以通过 GPIO Matrix 路由到不同 IO，从而获得较高的引脚配置自由度。

这也解释了为什么 ESP32 教程里经常会看到：

```cpp
Serial1.begin(..., RX_PIN, TX_PIN);
```

或者：

```cpp
Wire.begin(SDA_PIN, SCL_PIN);
```

引脚不是天然永远只属于某一种协议。

### 但“能路由”不等于“每个脚都随便用”

经典 ESP32 官方 GPIO 文档还列出了很多真实限制。例如：

- 一些 GPIO 是 strapping pins，会影响启动配置；
- 一些引脚通常连接模块内部 Flash / PSRAM；
- GPIO34～GPIO39 在经典 ESP32 上是 input-only；
- 默认 TX/RX 引脚可能同时承担下载和调试用途。

所以嵌入式里一个很重要的习惯是：

> **写代码之前先看芯片和开发板的 pinout / datasheet，而不是看到一个 GPIO 编号就直接接。**

这和 Web 世界里“API 能调就行”完全不同，因为这里还存在真实电气约束。

---

## UART：没有共享时钟的串行通信

UART 是 Universal Asynchronous Receiver/Transmitter。

名字里最重要的是：

```text
Asynchronous
异步
```

典型 UART 连接至少关心：

```text
设备 A TX ─────→ 设备 B RX
设备 A RX ←───── 设备 B TX
GND      ─────── GND
```

它没有像 SPI 那样额外提供一根共享时钟线。

双方提前约好通信参数，例如：

```text
baud rate = 115200
data bits = 8
parity = none
stop bits = 1
```

然后各自按照约定的节奏发送和采样比特。

Espressif 的 ESP-IDF 文档也把 UART 描述为一种广泛使用的异步串行通信方式，并允许独立配置波特率、数据位、停止位、校验等参数。

### 为什么新手第一次接触 ESP32 几乎一定会用到 UART？

因为最常见的：

```cpp
Serial.begin(115200);
Serial.println("hello");
```

本质上就是 UART / 串行终端场景。

它极其适合：

- 调试日志；
- MCU 和 MCU 通信；
- GPS 模块；
- 一些工业设备；
- AT 指令模块；
- Bootloader / 下载与调试链路。

### UART 最常见的坑：两边节奏不一致

如果 ESP32：

```cpp
Serial.begin(115200);
```

而串口监视器开成：

```text
9600
```

你可能会看到一堆乱码。

这不是“编码坏了”，而是接收端用错误的时间尺度解释了比特流。

UART 给我的第一个很重要的嵌入式直觉就是：

> **软件参数有时就是物理通信的一部分。**

---

## I²C：两根线为什么能挂一堆传感器？

I²C（Inter-Integrated Circuit）和 UART 最大的体验差异之一，是它天生考虑了**一条总线上存在多个设备**。

最典型的两条线：

```text
SDA  Serial Data
SCL  Serial Clock
```

拓扑可以想象成：

```text
             ┌─ 传感器 A (0x44)
ESP32 ─ SDA ─┼─ 传感器 B (0x76)
      ─ SCL ─┼─ OLED     (0x3C)
             └─ RTC      (0x68)
```

多个设备共享 SDA / SCL。

那 MCU 怎么知道自己在和谁讲话？

答案是：

```text
Address
地址
```

I²C 设备通常拥有总线地址。主机发起事务时，先指出目标地址，再完成读写。

这就像：

```text
同一条局域网里有多个节点
但每个节点有自己的标识
```

当然 I²C 远没有 IP 网络那么复杂，只是这种“共享介质 + 地址”的思维很像。

### I²C 为什么常见于传感器？

因为它的布线成本很低。

多个设备可以共享两根主信号线，不需要每增加一个外设就重新增加完整的一套 TX/RX 或多根独占数据线。

所以温湿度、气压、IMU、RTC、小型 OLED 等低到中速外设经常能看到 I²C。

### Open-drain 和上拉电阻是一个必须跨过去的坎

Espressif 的 I²C 文档明确指出，SDA 和 SCL 是**双向 open-drain 线路，需要通过电阻上拉**。

这意味着 I²C 不能简单理解成：

```text
ESP32 主动输出 0 和 1
```

更准确的直觉是：

```text
设备可以主动把线拉低
没有设备拉低时，由上拉电阻把线恢复到高电平
```

因此真实硬件里还要考虑：

- 上拉电阻是否存在；
- 阻值是否合理；
- 总线电容；
- 线长；
- 电平电压；
- 地址冲突。

经典 ESP32 的当前 ESP-IDF 文档给出的 Standard-mode / Fast-mode 是最高 100 kHz / 400 kHz，并特别提醒 SCL 频率会受到上拉电阻和线路电容影响。

这就是为什么“代码里写了 400 kHz”不代表真实线上一定就有完美的 400 kHz 波形。

---

## SPI：用更多线换更直接、更高吞吐的通信

SPI 的常见信号包括：

```text
SCLK  时钟
MOSI  Host → Device
MISO  Device → Host
CS    Chip Select
```

典型结构：

```text
                 ┌─ Device A
ESP32 ─ MOSI ────┼─ Device B
      ─ MISO ────┼─ Device C
      ─ SCLK ────┤
      ─ CS_A ─────→ A
      ─ CS_B ─────→ B
      ─ CS_C ─────→ C
```

Espressif 的 SPI Master 文档里把这个模型说得很清楚：多个 Device 可以共享 MOSI、MISO、SCLK，但每个 Device 通过自己的 CS 线被选中。

和 I²C 相比，SPI 的思维方式更像：

```text
共享高速主干
+
每个设备单独的“点名线”
```

### 为什么 SPI 通常更适合屏幕、Flash 这类高数据量设备？

因为它拥有独立时钟和更直接的数据通道，不需要像 I²C 那样在同一两根线里完成地址、仲裁等更紧凑的共享总线逻辑。

ESP-IDF 的 SPI Master 驱动甚至直接提供 DMA、事务队列等机制，说明它常常面对的是更高吞吐的数据传输需求。

代价也很明显：

- 线更多；
- 每增加设备通常还要多一个 CS；
- Mode / 时钟极性 / 相位等参数需要匹配；
- 高速之后，布线和信号完整性变得更重要。

所以“SPI 比 I²C 高级”这个说法没有意义。

它们只是优化目标不同。

---

## 四种方式放进一张表里就清楚了

| 方式 | 核心思路 | 典型信号 | 多设备方式 | 常见用途 |
| --- | --- | --- | --- | --- |
| GPIO | 直接控制 / 读取电平 | 单个或多个 IO | 程序自己管理 | LED、按钮、继电器、简单状态 |
| UART | 无共享时钟的串行收发 | TX、RX、GND | 通常点对点 | 调试、GPS、AT 模块、设备串口 |
| I²C | 共享双线 + 地址 | SDA、SCL | 地址区分设备 | 传感器、RTC、OLED、配置型外设 |
| SPI | 共享高速数据/时钟 + 独立 CS | MOSI、MISO、SCLK、CS | CS 选择设备 | 显示屏、Flash、ADC、高速外设 |

真正选型时，我现在会先问几个问题：

```text
我只需要一个开关状态吗？
→ GPIO

设备是不是只提供串口？
→ UART

我要挂很多低速传感器，又想少占引脚？
→ I2C

我要持续传较多数据，能接受多几根线？
→ SPI
```

不是绝对规则，但作为第一层判断已经很好用。

---

## 一个不用买开发板也能开始的 ESP32 最小实验

如果现在手里还没有 ESP32，我觉得很适合先用 Wokwi 建立第一层直觉。

Wokwi 官方 ESP32 Simulation 文档目前列出的模拟能力里，ESP32 的 GPIO、UART、I²C、SPI 都属于支持范围；其中 I²C 模拟有自己的限制，例如目前以 Master 为主，并不等价于完整真实硬件环境。

所以它很适合做：

```text
学习 API
验证程序控制逻辑
观察 GPIO 状态
看串口输出
理解总线连接
```

但不能替代：

```text
真实电压测量
上拉电阻选型
高速信号完整性
EMI
供电稳定性
真实板卡时序边界
```

### 实验目标

只做一件事：

**让 GPIO18 控制一个 LED，同时通过串口输出这个 GPIO 当前状态。**

这一个实验里已经能同时看到：

```text
GPIO → 控制真实世界状态
UART → 把 MCU 内部状态输出给人看
```

### 接线

概念连接：

```text
ESP32 GPIO18
      │
      ├── 约 220Ω 限流电阻
      │
      └── LED
           │
          GND
```

实际 LED 极性和 Wokwi 元件引脚要按元件定义连接。

### Arduino 示例

```cpp
constexpr int LED_PIN = 18;
bool ledOn = false;

void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("ESP32 learning lab started");
}

void loop() {
  ledOn = !ledOn;
  digitalWrite(LED_PIN, ledOn ? HIGH : LOW);

  Serial.printf(
    "GPIO%d -> %s\n",
    LED_PIN,
    ledOn ? "HIGH" : "LOW"
  );

  delay(1000);
}
```

如果逻辑正常，你应该看到两件事：

```text
LED 每秒切换一次亮灭
```

以及串口终端交替出现：

```text
GPIO18 -> HIGH
GPIO18 -> LOW
GPIO18 -> HIGH
GPIO18 -> LOW
```

这看起来非常简单，但它建立的是后面所有嵌入式实验都会反复出现的模式：

```text
程序状态
   ↓
外设控制器 / GPIO
   ↓
物理引脚状态
   ↓
外部设备响应

同时：

程序状态
   ↓
UART
   ↓
串口终端
   ↓
人类可观察
```

这就是一个最小的“控制 + 可观测性”闭环。

服务器排障依赖日志，单片机其实一样。

---

## 如果把这个实验升级成 I²C，会发生什么？

下一步可以把 LED 换成 I²C 传感器。

程序结构就从：

```text
digitalWrite(GPIO18, HIGH)
```

变成：

```text
初始化 I2C Bus
    ↓
选择 SDA / SCL
    ↓
找到目标设备地址
    ↓
发送寄存器地址 / 命令
    ↓
读取返回数据
```

这时排障问题也会升级：

```text
线接对了吗？
SDA/SCL 对吗？
设备地址是多少？
有上拉吗？
电平兼容吗？
总线上是否存在地址冲突？
传感器是不是需要上电等待？
```

所以很多嵌入式“代码问题”，真正根因可能根本不在代码。

---

## 再升级成 SPI，又多了什么维度？

如果再换成 SPI 屏幕：

```text
MOSI
MISO（有些屏幕甚至不需要）
SCLK
CS
可能还有 DC / RST
```

你开始面对：

- SPI Mode；
- 时钟频率；
- CS 时序；
- 一次 transaction 的边界；
- DMA；
- 大块 framebuffer 传输；
- 引脚路由和性能差异。

到这一步就能明显感觉：

> **嵌入式不是“会 C/C++ 就行”，而是软件状态机和物理世界的接口工程。**

---

## 我整理出的几个新手高频误区

### 误区 1：GPIO 编号只要存在就能随便输出

不一定。

至少在经典 ESP32 上就存在 input-only、strapping、Flash/PSRAM 占用等限制。

开发板还可能进一步占用某些引脚。

所以一定先看对应芯片和板子的 pinout。

### 误区 2：TX 接 TX，RX 接 RX

普通 UART 点对点通信里通常是交叉：

```text
A TX → B RX
A RX ← B TX
```

并且要共地。

### 误区 3：串口乱码一定是编码问题

先查：

```text
baud rate
数据位
校验
停止位
```

最常见的其实是参数不匹配。

### 误区 4：I²C 只有两根线，所以最简单

逻辑连接确实省线，但真实电气上还要关心：

```text
上拉
电容
地址
线长
频率
电压
```

“线少”不等于“没有物理层问题”。

### 误区 5：SPI 只要四根线接上就一定能跑

还要确认：

```text
CS
Mode
Clock
Bit Order
设备时序要求
```

有些模块还会增加 DC、RST、BUSY 等控制线。

### 误区 6：模拟器跑通 = 真板一定跑通

这是我会特别提醒自己的边界。

模拟器可以验证软件逻辑和大部分接口使用方式，但它不会自动证明：

```text
真实供电没问题
电压兼容
焊接可靠
上拉正确
高速波形干净
EMI 可接受
板子没有硬件缺陷
```

所以模拟实验应该被称为：

**软件与逻辑层验证。**

而不是完整硬件验收。

---

## 为什么我觉得服务器 / 网络玩家学嵌入式会很有意思？

因为往上看，其实两边最后能接起来。

例如一个很完整的个人技术栈可以是：

```text
温湿度 / 光照 / 土壤传感器
          ↓
        I2C
          ↓
        ESP32
          ↓
      Wi-Fi / MQTT
          ↓
     VPS / Cloudflare
          ↓
 Worker / API / Database
          ↓
 Web Dashboard / 手机端
```

我之前更熟悉的是后半段：

```text
服务器 → 网络 → API → Web
```

现在补 MCU，相当于继续往数据源头走：

```text
物理世界 → 电信号 → MCU → 网络 → 云 → Web
```

这样一来，很多以前看起来互不相关的技术开始连接起来。

例如：

- GPIO 是最底层状态；
- I²C / SPI 负责板级外设；
- UART 负责调试和设备通信；
- FreeRTOS 负责任务调度；
- Wi-Fi 把 MCU 带入 IP 网络；
- MQTT 做轻量消息分发；
- Cloudflare / VPS 做公网服务；
- Web 前端做最终可视化；
- TinyML 则可以进一步把一部分推理放回边缘设备。

这也是我后面想逐渐补齐的一条技术链。

---

## 下一阶段我会怎么学

这篇只解决四个最基础的概念。

我给自己的顺序暂时是：

```text
1. GPIO 输入 / 输出
2. 中断、按键去抖、PWM
3. UART
4. I2C + 一个真实/模拟传感器
5. SPI + 屏幕或存储
6. ADC / PWM / Timer / DMA
7. FreeRTOS Task / Queue / Semaphore
8. Wi-Fi
9. MQTT
10. 传感器 → 云端 → Dashboard
11. TinyML / Edge AI
```

这种顺序的好处是，每一步都能和前一步形成一个真实的小系统，而不是先背完整本芯片手册。

## 结语

如果只记一句话，我现在会这样区分它们：

```text
GPIO：直接改变或读取一个引脚状态。
UART：双方约好速度，用 TX/RX 异步串行聊天。
I2C：大家共享 SDA/SCL，用地址找到具体设备。
SPI：共享高速数据与时钟，用独立 CS 点名设备。
```

再往深一层：

```text
GPIO 是“电平控制能力”
UART / I2C / SPI 是“如何把电平变化组织成通信”
```

这套心智模型比单纯背“几根线、多少 MHz”更重要。

因为以后换 STM32、RP2040、ESP32-S3，甚至换完全不同的传感器，协议背后的问题仍然是同一个：

> **CPU 怎样以足够可靠、足够便宜、足够快的方式，把自己的状态和真实世界连接起来？**

这也是我开始学嵌入式之后，觉得它最有意思的地方。

---

### 参考资料

- Espressif ESP-IDF — GPIO & RTC GPIO: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/gpio.html
- Espressif ESP-IDF — UART: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/peripherals/uart.html
- Espressif ESP-IDF — I2C: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/i2c.html
- Espressif ESP-IDF — SPI Master Driver: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/spi_master.html
- Wokwi Docs — ESP32 Simulation: https://docs.wokwi.com/guides/esp32

> 本文属于“学习实验室”系列。内容以官方文档和可复现模拟实验为基础，不将尚未完成的实体硬件操作包装成长期实战经验；后续如果开始使用真实开发板，会把电气测量、示波器/逻辑分析仪结果和真机踩坑继续补进这个系列。
