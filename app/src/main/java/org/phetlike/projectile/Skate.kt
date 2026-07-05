package org.phetlike.projectile

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
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.sign
import kotlin.math.sqrt

private const val TRACK_W = 20f   // metres wide
private const val TRACK_H = 6f    // metres tall walls

private fun hMeters(xN: Float): Float {
    val t = 2f * xN - 1f
    return TRACK_H * t * t
}

private fun slopeAt(xN: Float): Float = TRACK_H * (8f * xN - 4f) / TRACK_W

@Composable
fun SkateScreen() {
    var gravity by remember { mutableStateOf(9.81f) }
    var friction by remember { mutableStateOf(0f) }
    var mass by remember { mutableStateOf(60f) }       // kg
    var releaseH by remember { mutableStateOf(5f) }    // m

    var xN by remember { mutableStateOf(0.5f - sqrt(5f / TRACK_H) / 2f) }
    var u by remember { mutableStateOf(0f) }           // velocity along track (signed)
    var thermal by remember { mutableStateOf(0f) }
    var running by remember { mutableStateOf(false) }

    var frame by remember { mutableStateOf(0L) }
    var lastNanos by remember { mutableStateOf(0L) }

    fun placeAtRelease() {
        val hN = (releaseH / TRACK_H).coerceIn(0f, 1f)
        xN = 0.5f - sqrt(hN) / 2f
        u = 0f
        thermal = 0f
    }

    LaunchedEffect(Unit) {
        while (true) {
            withFrameNanos { now ->
                val dt = if (lastNanos == 0L) 0f else ((now - lastNanos) / 1_000_000_000f)
                lastNanos = now
                val clamped = dt.coerceIn(0f, 0.05f)
                if (!running) {
                    placeAtRelease()
                } else if (clamped > 0f) {
                    val sub = 8
                    val h = clamped / sub
                    repeat(sub) {
                        val m = slopeAt(xN)
                        val inv = 1f / sqrt(1f + m * m)
                        val cosT = inv
                        val aT = -gravity * m * inv
                        // friction opposes motion (kinetic only)
                        val fr = if (u != 0f) -sign(u) * friction * gravity * cosT else 0f
                        u += (aT + fr) * h
                        val dxm = u * cosT * h
                        var nx = xN + dxm / TRACK_W
                        if (nx < 0.03f) { nx = 0.03f; u = -u * 0.6f }
                        if (nx > 0.97f) { nx = 0.97f; u = -u * 0.6f }
                        // accumulate thermal from friction work
                        thermal += friction * mass * gravity * cosT * kotlin.math.abs(u) * h
                        xN = nx
                    }
                }
                frame = now
            }
        }
    }

    val dark = LocalSimDark.current
    val speed = kotlin.math.abs(u)
    val height = hMeters(xN)
    val ke = 0.5f * mass * u * u
    val pe = mass * gravity * height

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            SkateCanvas(xN, u, mass, ke, pe, thermal, frame)
            MeasureCard(
                title = "测量数据",
                rows = listOf(
                    "速率" to "%.1f m/s".format(speed),
                    "高度" to "%.1f m".format(height),
                    "动能" to "%.0f J".format(ke),
                    "势能" to "%.0f J".format(pe),
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
                    primaryColor = if (running) Color(0xFFFB8C00) else Color(0xFFFF7043),
                    onPrimary = { running = !running },
                    midText = null, onMid = null,
                    secondaryText = "重置",
                    onSecondary = { running = false; placeAtRelease() },
                )
                Spacer(Modifier.height(8.dp))
                LabeledSlider("释放高度", releaseH, 1f..TRACK_H, "%.1f m".format(releaseH)) {
                    releaseH = it; if (!running) placeAtRelease()
                }
                LabeledSlider("摩擦", friction, 0f..0.4f, "%.2f".format(friction)) { friction = it }
                LabeledSlider("滑板者质量", mass, 20f..90f, "%.0f kg".format(mass)) { mass = it }
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
                    "无摩擦时动能+势能守恒；有摩擦时机械能转化为热能（红色条增长）。",
                    fontSize = 11.sp, color = Color(0xFF90A4AE),
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun SkateCanvas(
    xN: Float,
    u: Float,
    mass: Float,
    ke: Float,
    pe: Float,
    thermal: Float,
    frame: Long,
) {
    val barLabel = remember {
        Paint().apply {
            color = android.graphics.Color.argb(200, 40, 50, 60)
            textSize = 24f
            isAntiAlias = true
        }
    }
    Canvas(Modifier.fillMaxSize()) {
        frame.let { }
        val w = size.width
        val h = size.height
        // Sky + ground
        drawRect(color = Color(0xFFDBEEFB), size = Size(w, h * 0.86f))
        drawRect(color = Color(0xFF9CCC65), topLeft = Offset(0f, h * 0.86f), size = Size(w, h * 0.14f))

        val left = w * 0.06f
        val trackW = w * 0.60f
        val baseY = h * 0.80f
        val scaleY = (h * 0.62f) / TRACK_H

        fun sx(xn: Float) = left + xn * trackW
        fun sy(hm: Float) = baseY - hm * scaleY

        // Track
        val track = Path()
        var first = true
        var i = 0
        while (i <= 100) {
            val xn = i / 100f
            val px = sx(xn); val py = sy(hMeters(xn))
            if (first) { track.moveTo(px, py); first = false } else track.lineTo(px, py)
            i++
        }
        drawPath(track, color = Color(0xFF5D4037), style = Stroke(width = 7f, cap = StrokeCap.Round))

        // Skater
        val px = sx(xN); val py = sy(hMeters(xN))
        val angle = atan(slopeAt(xN)) * 180f / PI.toFloat()
        rotate(degrees = angle, pivot = Offset(px, py)) {
            // board
            drawRect(Color(0xFF263238), Offset(px - 18f, py - 4f), Size(36f, 6f))
            drawCircle(Color(0xFF111111), 4f, Offset(px - 12f, py + 5f))
            drawCircle(Color(0xFF111111), 4f, Offset(px + 12f, py + 5f))
            // body
            drawCircle(Color(0xFFFF7043), 11f, Offset(px, py - 18f))
            drawLine(Color(0xFFFF7043), Offset(px, py - 8f), Offset(px, py - 28f), 5f, cap = StrokeCap.Round)
        }

        // Energy bars on the right
        val total = ke + pe + thermal
        val maxE = total.coerceAtLeast(1f)
        val bx = w * 0.72f
        val barW = w * 0.055f
        val gap = w * 0.012f
        val barBase = h * 0.78f
        val maxBarH = h * 0.60f
        val bars = listOf(
            Triple("动能", ke, Color(0xFF43A047)),
            Triple("势能", pe, Color(0xFF1E88E5)),
            Triple("热能", thermal, Color(0xFFE53935)),
            Triple("总能", total, Color(0xFF455A64)),
        )
        for ((idx, bar) in bars.withIndex()) {
            val (label, value, color) = bar
            val x = bx + idx * (barW + gap)
            val bh = (value / maxE) * maxBarH
            drawRect(Color(0x22000000), Offset(x, barBase - maxBarH), Size(barW, maxBarH))
            drawRect(color, Offset(x, barBase - bh), Size(barW, bh))
            drawContext.canvas.nativeCanvas.drawText(label, x - 2f, barBase + 26f, barLabel)
        }
    }
}
