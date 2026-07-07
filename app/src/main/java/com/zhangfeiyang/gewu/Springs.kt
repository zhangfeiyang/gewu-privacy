package com.zhangfeiyang.gewu

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Alignment
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sqrt

@Composable
fun SpringsScreen() {
    var k by remember { mutableStateOf(12f) }          // N/m
    var mass by remember { mutableStateOf(0.8f) }      // kg
    var gravity by remember { mutableStateOf(9.81f) }  // m/s^2
    var damping by remember { mutableStateOf(0.4f) }   // 1/s
    var u0 by remember { mutableStateOf(0.8f) }        // initial displacement from equilibrium (m)

    var u by remember { mutableStateOf(0.8f) }         // displacement from equilibrium
    var v by remember { mutableStateOf(0f) }           // velocity
    var running by remember { mutableStateOf(false) }

    var frame by remember { mutableStateOf(0L) }
    var lastNanos by remember { mutableStateOf(0L) }

    LaunchedEffect(Unit) {
        while (true) {
            withFrameNanos { now ->
                val dt = if (lastNanos == 0L) 0f else ((now - lastNanos) / 1_000_000_000f)
                lastNanos = now
                val clamped = dt.coerceIn(0f, 0.05f)
                if (!running) {
                    u = u0
                    v = 0f
                } else if (clamped > 0f) {
                    val sub = 8
                    val h = clamped / sub
                    repeat(sub) {
                        val a = -(k / mass) * u - damping * v
                        v += a * h
                        u += v * h
                    }
                }
                frame = now
            }
        }
    }

    val stretch = mass * gravity / k                       // equilibrium stretch (m)
    val period = 2.0 * PI * sqrt((mass / k).toDouble())
    val ke = 0.5f * mass * v * v
    val pe = 0.5f * k * u * u                               // elastic PE about equilibrium
    val dark = LocalSimDark.current

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            SpringCanvas(u, stretch, mass, ke, pe, frame)
            MeasureCard(
                title = "测量数据",
                rows = listOf(
                    "周期" to "%.2f s".format(period),
                    "平衡伸长" to "%.2f m".format(stretch),
                    "当前位移" to "%+.2f m".format(u),
                    "重力" to "%.2f".format(gravity),
                ),
                modifier = Modifier.padding(10.dp),
            )
        }
        Surface(color = panelSurface(dark), shadowElevation = 8.dp) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .height(300.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                ActionRow(
                    primaryText = if (running) "⏸ 暂停" else "▶ 释放",
                    primaryColor = if (running) Color(0xFFFB8C00) else Color(0xFF00897B),
                    onPrimary = { running = !running },
                    midText = null, onMid = null,
                    secondaryText = "重置",
                    onSecondary = { running = false; u = u0; v = 0f },
                )
                Spacer(Modifier.height(8.dp))
                LabeledSlider("劲度系数 k", k, 2f..40f, "%.0f N/m".format(k)) { k = it }
                LabeledSlider("质量", mass, 0.1f..2f, "%.2f kg".format(mass)) { mass = it }
                LabeledSlider("阻尼", damping, 0f..3f, "%.2f".format(damping)) { damping = it }
                LabeledSlider("初始位移", u0, -1.5f..1.5f, "%+.2f m".format(u0)) {
                    u0 = it
                    if (!running) { u = it; v = 0f }
                }
                Row(
                    Modifier.fillMaxWidth().padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("重力", fontSize = 13.sp, color = panelLabel(dark), modifier = Modifier.width(56.dp))
                    PlanetChip("地球", 9.81f, gravity) { gravity = it }
                    PlanetChip("月球", 1.62f, gravity) { gravity = it }
                    PlanetChip("木星", 24.79f, gravity) { gravity = it }
                }
                Text(
                    "提示：周期 T = 2π√(m/k)，与重力无关；重力只改变平衡位置。",
                    fontSize = 11.sp, color = Color(0xFF90A4AE),
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun SpringCanvas(u: Float, stretch: Float, mass: Float, ke: Float, pe: Float, frame: Long) {
    val barLabel = remember {
        Paint().apply {
            color = android.graphics.Color.argb(200, 40, 50, 60)
            textSize = 22f
            isAntiAlias = true
        }
    }
    Canvas(Modifier.fillMaxSize()) {
        frame.let { }
        val w = size.width
        val h = size.height
        drawRect(color = Color(0xFFEAF6F3), size = Size(w, h))

        val cx = w * 0.5f
        val supportY = h * 0.10f
        val availH = h * 0.80f
        val naturalLen = 1.0f
        val totalLenM = naturalLen + stretch + u
        val extentM = (naturalLen + stretch + abs(u)) + 0.4f
        val scale = (availH / extentM).coerceAtMost(availH / 1.4f)
        val springPx = (totalLenM * scale).coerceAtLeast(40f)

        val blockH = 26f + mass * 26f
        val blockW = 78f
        val massTopY = supportY + springPx

        // Support beam
        drawRect(color = Color(0xFF607D8B), topLeft = Offset(cx - 90f, supportY - 14f), size = Size(180f, 14f))
        // hatch above
        for (i in 0..8) {
            val x = cx - 90f + i * 22f
            drawLine(Color(0xFF455A64), Offset(x, supportY - 14f), Offset(x + 12f, supportY - 26f), 2f)
        }

        // Spring zigzag
        val coils = 16
        val coilW = 26f
        val path = Path().apply {
            moveTo(cx, supportY)
            val seg = springPx / (coils * 2f)
            for (i in 1..coils * 2) {
                val y = supportY + i * seg
                val x = when {
                    i == coils * 2 -> cx
                    i % 2 == 1 -> cx + coilW
                    else -> cx - coilW
                }
                lineTo(x, y)
            }
        }
        drawPath(path, color = Color(0xFF00897B), style = Stroke(width = 4f, cap = StrokeCap.Round))

        // Mass block
        drawRect(
            color = Color(0xFF00695C),
            topLeft = Offset(cx - blockW / 2f, massTopY),
            size = Size(blockW, blockH),
        )
        drawRect(
            color = Color.White.copy(alpha = 0.18f),
            topLeft = Offset(cx - blockW / 2f, massTopY),
            size = Size(blockW, 8f),
        )

        // Equilibrium reference line
        val eqY = supportY + (naturalLen + stretch) * scale
        drawLine(
            color = Color(0x55E53935),
            start = Offset(cx - blockW, eqY),
            end = Offset(cx + blockW, eqY),
            strokeWidth = 2f,
        )

        drawEnergyBars(
            listOf(
                Triple("动能", ke, Color(0xFF43A047)),
                Triple("弹性", pe, Color(0xFF1E88E5)),
                Triple("总能", ke + pe, Color(0xFF455A64)),
            ),
            barLabel,
        )
    }
}
