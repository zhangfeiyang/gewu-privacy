package com.zhangfeiyang.gewu

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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.sin

private const val N = 120

private enum class EndType(val label: String) { FIXED("固定端"), LOOSE("自由端"), ABSORB("吸收端") }

@Composable
fun WaveScreen() {
    var amp by remember { mutableStateOf(0.6f) }       // 0..1 normalised
    var freq by remember { mutableStateOf(1.4f) }      // Hz
    var damping by remember { mutableStateOf(0.02f) }  // per step
    var tension by remember { mutableStateOf(0.85f) }  // Courant number 0..1 -> speed
    var endType by remember { mutableStateOf(EndType.FIXED) }

    var oscillating by remember { mutableStateOf(true) }
    var pulsing by remember { mutableStateOf(false) }
    var pulsePhase by remember { mutableStateOf(0f) }
    var t by remember { mutableStateOf(0f) }

    val y = remember { FloatArray(N) }
    val yOld = remember { FloatArray(N) }
    val yNew = remember { FloatArray(N) }

    var frame by remember { mutableStateOf(0L) }
    var lastNanos by remember { mutableStateOf(0L) }
    val dark = LocalSimDark.current

    fun reset() {
        y.fill(0f); yOld.fill(0f); yNew.fill(0f)
        t = 0f; pulsing = false; pulsePhase = 0f
    }

    LaunchedEffect(Unit) {
        while (true) {
            withFrameNanos { now ->
                val dt = if (lastNanos == 0L) 0f else ((now - lastNanos) / 1_000_000_000f)
                lastNanos = now
                val clamped = dt.coerceIn(0f, 0.05f)
                if (clamped > 0f) {
                    val sub = 3
                    val hStep = clamped / sub
                    val c2 = tension * tension
                    repeat(sub) {
                        t += hStep
                        // Drive the left end (the "wrench").
                        var drive = 0f
                        if (oscillating) drive = amp * sin(2f * PI.toFloat() * freq * t)
                        if (pulsing) {
                            drive = amp * sin(pulsePhase)
                            pulsePhase += 2f * PI.toFloat() * freq * hStep
                            if (pulsePhase >= PI.toFloat()) { pulsing = false }
                        }
                        // Leapfrog wave update for the interior.
                        for (i in 1 until N - 1) {
                            yNew[i] = 2f * y[i] - yOld[i] +
                                c2 * (y[i + 1] - 2f * y[i] + y[i - 1]) -
                                damping * (y[i] - yOld[i])
                        }
                        yNew[0] = drive
                        // Right boundary condition.
                        yNew[N - 1] = when (endType) {
                            EndType.FIXED -> 0f
                            EndType.LOOSE -> yNew[N - 2]
                            EndType.ABSORB -> {
                                val r = (tension - 1f) / (tension + 1f)
                                y[N - 2] + r * (yNew[N - 2] - y[N - 1])
                            }
                        }
                        // Rotate buffers.
                        for (i in 0 until N) { yOld[i] = y[i]; y[i] = yNew[i] }
                    }
                }
                frame = now
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            WaveCanvas(y, endType, frame)
            MeasureCard(
                title = "波源",
                rows = listOf(
                    "频率" to "%.1f Hz".format(freq),
                    "振幅" to "%.0f %%".format(amp * 100),
                    "波速档" to "%.2f".format(tension),
                    "端点" to endType.label,
                ),
                modifier = Modifier.padding(10.dp),
            )
        }
        Surface(color = panelSurface(dark), shadowElevation = 8.dp) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .height(308.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                ActionRow(
                    primaryText = if (oscillating) "■ 停止波源" else "▶ 连续波",
                    primaryColor = if (oscillating) Color(0xFFFB8C00) else Color(0xFF3949AB),
                    onPrimary = { oscillating = !oscillating },
                    midText = "脉冲",
                    onMid = { pulsing = true; pulsePhase = 0f; oscillating = false },
                    secondaryText = "重置",
                    onSecondary = { reset() },
                )
                Spacer(Modifier.height(8.dp))
                LabeledSlider("振幅", amp, 0.1f..1f, "%.0f %%".format(amp * 100)) { amp = it }
                LabeledSlider("频率", freq, 0.4f..3f, "%.1f Hz".format(freq)) { freq = it }
                LabeledSlider("波速", tension, 0.3f..1f, "%.2f".format(tension)) { tension = it }
                LabeledSlider("阻尼", damping, 0f..0.12f, "%.3f".format(damping)) { damping = it }

                Row(
                    Modifier.fillMaxWidth().padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("端点", fontSize = 13.sp, color = panelLabel(dark), modifier = Modifier.width(48.dp))
                    for (e in EndType.values()) {
                        EndChip(e.label, e == endType) { endType = e }
                    }
                }
                Text(
                    "固定端反射倒立波，自由端反射正立波，吸收端不反射。",
                    fontSize = 11.sp, color = Color(0xFF90A4AE),
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun EndChip(label: String, selected: Boolean, onClick: () -> Unit) {
    PlanetChip(label, if (selected) 1f else 0f, 1f, onPick = { onClick() })
}

@Composable
private fun WaveCanvas(y: FloatArray, endType: EndType, frame: Long) {
    Canvas(Modifier.fillMaxSize()) {
        frame.let { }
        val w = size.width
        val h = size.height
        drawRect(color = Color(0xFFEDEFFB), size = Size(w, h))

        val left = w * 0.07f
        val right = w * 0.95f
        val midY = h * 0.46f
        val dx = (right - left) / (N - 1)
        val ampPx = h * 0.30f

        // Centre reference line
        drawLine(Color(0x22000000), Offset(left, midY), Offset(right, midY), 2f)

        // The string
        val path = Path()
        path.moveTo(left, midY - y[0] * ampPx)
        for (i in 1 until N) {
            path.lineTo(left + i * dx, midY - y[i] * ampPx)
        }
        drawPath(path, color = Color(0xFF3949AB), style = Stroke(width = 4f, cap = StrokeCap.Round))

        // Green beads to make motion legible
        var i = 0
        while (i < N) {
            drawCircle(Color(0xFF1A237E), 3.5f, Offset(left + i * dx, midY - y[i] * ampPx))
            i += 8
        }

        // Driver ("wrench") at the left
        val driverY = midY - y[0] * ampPx
        drawRect(
            color = Color(0xFF455A64),
            topLeft = Offset(left - 26f, driverY - 16f),
            size = Size(24f, 32f),
        )
        drawCircle(Color(0xFFE53935), 7f, Offset(left, driverY))

        // Right end marker
        val endY = midY - y[N - 1] * ampPx
        when (endType) {
            EndType.FIXED -> {
                // a wall + clamp ring
                drawRect(Color(0xFF8D6E63), Offset(right + 2f, midY - ampPx), Size(10f, ampPx * 2f))
                drawCircle(Color(0xFF3949AB), 7f, Offset(right, endY))
            }
            EndType.LOOSE -> {
                // a ring on a vertical pole (free to slide)
                drawLine(Color(0x55000000), Offset(right + 8f, midY - ampPx), Offset(right + 8f, midY + ampPx), 3f)
                drawCircle(Color(0xFF3949AB), 9f, Offset(right + 8f, endY))
                drawCircle(Color(0xFFEDEFFB), 5f, Offset(right + 8f, endY))
            }
            EndType.ABSORB -> {
                drawCircle(Color(0x553949AB), 7f, Offset(right, endY))
            }
        }
    }
}
