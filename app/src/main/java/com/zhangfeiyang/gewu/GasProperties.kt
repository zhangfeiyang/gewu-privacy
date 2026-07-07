package com.zhangfeiyang.gewu

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.sqrt
import kotlin.random.Random

private const val BOX_H = 10f      // box height in units (fixed)

private class GasP(var x: Float, var y: Float, var vx: Float, var vy: Float)

@Composable
fun GasScreen() {
    var count by remember { mutableStateOf(60f) }     // particle count
    var temperature by remember { mutableStateOf(40f) } // 1..100, sets target speed
    var volumeW by remember { mutableStateOf(12f) }    // box width in units
    val dark = LocalSimDark.current

    val parts = remember { mutableListOf<GasP>() }
    var pressure by remember { mutableStateOf(0f) }
    var frame by remember { mutableStateOf(0L) }
    var lastNanos by remember { mutableStateOf(0L) }

    // Resize the particle population to match the slider.
    LaunchedEffect(count.toInt()) {
        val n = count.toInt()
        while (parts.size < n) {
            val sp = temperature / 14f
            val ang = Random.nextFloat() * 6.2832f
            parts.add(
                GasP(
                    Random.nextFloat() * volumeW,
                    Random.nextFloat() * BOX_H,
                    sp * kotlin.math.cos(ang),
                    sp * kotlin.math.sin(ang),
                ),
            )
        }
        while (parts.size > n) parts.removeAt(parts.size - 1)
    }

    LaunchedEffect(Unit) {
        while (true) {
            withFrameNanos { now ->
                val dt = if (lastNanos == 0L) 0f else ((now - lastNanos) / 1_000_000_000f)
                lastNanos = now
                val clamped = dt.coerceIn(0f, 0.05f)
                if (clamped > 0f && parts.isNotEmpty()) {
                    // thermostat: gently scale speeds toward target
                    val target = temperature / 14f
                    var sumSp = 0f
                    for (p in parts) sumSp += hypot(p.vx, p.vy)
                    val avgSp = sumSp / parts.size
                    val factor = if (avgSp > 1e-3f) 1f + (target / avgSp - 1f) * 0.06f else 1f

                    var wallImpulse = 0f
                    var sumKE = 0f
                    for (p in parts) {
                        p.vx *= factor; p.vy *= factor
                        p.x += p.vx * clamped
                        p.y += p.vy * clamped
                        if (p.x < 0f) { p.x = 0f; p.vx = -p.vx; wallImpulse += -p.vx }
                        if (p.x > volumeW) { p.x = volumeW; p.vx = -p.vx; wallImpulse += p.vx }
                        if (p.y < 0f) { p.y = 0f; p.vy = -p.vy }
                        if (p.y > BOX_H) { p.y = BOX_H; p.vy = -p.vy }
                        sumKE += 0.5f * (p.vx * p.vx + p.vy * p.vy)
                    }
                    // Ideal-gas style pressure ~ N * <KE> / Area
                    val pInst = sumKE / (volumeW * BOX_H) * 10f
                    pressure += (pInst - pressure) * 0.06f
                }
                frame = now
            }
        }
    }

    val avgKE = if (parts.isEmpty()) 0f else
        parts.sumOf { (0.5f * (it.vx * it.vx + it.vy * it.vy)).toDouble() }.toFloat() / parts.size

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            GasCanvas(parts, volumeW, frame)
            MeasureCard(
                title = "测量数据",
                rows = listOf(
                    "粒子数" to "${parts.size}",
                    "温度" to "%.0f".format(avgKE * 28f),
                    "压强" to "%.1f".format(pressure),
                    "体积" to "%.0f".format(volumeW * BOX_H),
                ),
                modifier = Modifier.padding(10.dp),
            )
        }
        Surface(color = panelSurface(dark), shadowElevation = 8.dp) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .height(270.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                LabeledSlider("粒子数", count, 10f..150f, "%.0f".format(count)) { count = it }
                LabeledSlider("温度", temperature, 5f..100f, "%.0f".format(temperature)) { temperature = it }
                LabeledSlider("容器体积", volumeW, 5f..16f, "%.0f".format(volumeW * BOX_H)) { volumeW = it }
                Text(
                    "升高温度 → 分子更快 → 压强增大；缩小体积 → 碰撞更频繁 → 压强增大（PV ∝ T）。",
                    fontSize = 11.sp, color = Color(0xFF90A4AE),
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun GasCanvas(parts: List<GasP>, volumeW: Float, frame: Long) {
    Canvas(Modifier.fillMaxSize()) {
        frame.let { }
        val w = size.width
        val h = size.height
        drawRect(Color(0xFFEFF3F6), size = size)

        val maxW = 16f
        val availW = w * 0.86f
        val availH = h * 0.78f
        val scale = min(availW / maxW, availH / BOX_H)
        val boxW = volumeW * scale
        val boxH = BOX_H * scale
        val left = w * 0.5f - (maxW * scale) / 2f
        val top = (h - boxH) / 2f

        // Container (right wall = piston)
        drawRect(Color.White, Offset(left, top), Size(boxW, boxH))
        drawRect(Color(0xFF455A64), Offset(left - 6f, top - 6f), Size(6f, boxH + 12f))   // left wall
        drawRect(Color(0xFF455A64), Offset(left, top - 6f), Size(boxW + 6f, 6f))         // top
        drawRect(Color(0xFF455A64), Offset(left, top + boxH), Size(boxW + 6f, 6f))       // bottom
        // piston
        drawRect(Color(0xFF8D6E63), Offset(left + boxW, top - 10f), Size(12f, boxH + 20f))

        // Particles
        for (p in parts) {
            val sp = hypot(p.vx, p.vy)
            // colour by speed: slow=blue, fast=red
            val t = (sp / 9f).coerceIn(0f, 1f)
            val col = Color(0.2f + 0.7f * t, 0.35f * (1f - t) + 0.1f, 0.85f * (1f - t) + 0.1f, 1f)
            drawCircle(col, 5f, Offset(left + p.x * scale, top + p.y * scale))
        }

        drawRect(Color(0x22000000), Offset(left, top), Size(boxW, boxH), style = Stroke(width = 1.5f))
    }
}
