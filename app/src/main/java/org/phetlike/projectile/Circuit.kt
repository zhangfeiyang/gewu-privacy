package org.phetlike.projectile

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
import androidx.compose.material3.Switch
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
import kotlin.math.abs

@Composable
fun CircuitScreen() {
    var emf by remember { mutableStateOf(9f) }       // V
    var resistance by remember { mutableStateOf(6f) }// external resistor, ohm
    var bulbR by remember { mutableStateOf(8f) }     // bulb resistance, ohm
    var internalR by remember { mutableStateOf(0.5f) }
    var switchOn by remember { mutableStateOf(true) }

    var phase by remember { mutableStateOf(0f) }
    var frame by remember { mutableStateOf(0L) }
    var lastNanos by remember { mutableStateOf(0L) }

    val dark = LocalSimDark.current
    val totalR = resistance + bulbR + internalR
    val current = if (switchOn) emf / totalR else 0f
    val bulbPower = current * current * bulbR
    val bulbVolt = current * bulbR
    val brightness = (bulbPower / 8f).coerceIn(0f, 1f)

    LaunchedEffect(Unit) {
        while (true) {
            withFrameNanos { now ->
                val dt = if (lastNanos == 0L) 0f else ((now - lastNanos) / 1_000_000_000f)
                lastNanos = now
                phase += current * 0.05f * dt.coerceIn(0f, 0.05f) * 60f
                if (phase > 1f) phase -= phase.toInt().toFloat()
                frame = now
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            CircuitCanvas(current, brightness, switchOn, phase, frame)
            MeasureCard(
                title = "测量数据",
                rows = listOf(
                    "电流" to "%.2f A".format(current),
                    "灯泡功率" to "%.2f W".format(bulbPower),
                    "灯泡电压" to "%.2f V".format(bulbVolt),
                    "总电阻" to "%.1f Ω".format(totalR),
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
                Row(
                    Modifier.fillMaxWidth().padding(bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("开关", fontSize = 14.sp, color = panelStrong(dark), fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                    Spacer(Modifier.width(12.dp))
                    Switch(checked = switchOn, onCheckedChange = { switchOn = it })
                    Spacer(Modifier.weight(1f))
                    Text(if (switchOn) "闭合 · 通路" else "断开 · 无电流",
                        fontSize = 12.sp, color = if (switchOn) Color(0xFF2E7D32) else Color(0xFFC62828))
                }
                LabeledSlider("电源电压", emf, 1f..12f, "%.1f V".format(emf)) { emf = it }
                LabeledSlider("电阻", resistance, 0f..20f, "%.1f Ω".format(resistance)) { resistance = it }
                LabeledSlider("灯泡电阻", bulbR, 2f..20f, "%.1f Ω".format(bulbR)) { bulbR = it }
                LabeledSlider("电池内阻", internalR, 0f..3f, "%.1f Ω".format(internalR)) { internalR = it }
                Text(
                    "欧姆定律 I = U / R总。灯泡越亮表示功率越大；导线上的小球是流动的电子。",
                    fontSize = 11.sp, color = Color(0xFF90A4AE),
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun CircuitCanvas(
    current: Float,
    brightness: Float,
    switchOn: Boolean,
    phase: Float,
    frame: Long,
) {
    Canvas(Modifier.fillMaxSize()) {
        frame.let { }
        val w = size.width
        val h = size.height
        drawRect(color = Color(0xFFF4F6F8), size = Size(w, h))

        val x0 = w * 0.16f
        val x1 = w * 0.84f
        val y0 = h * 0.18f
        val y1 = h * 0.74f
        val tl = Offset(x0, y0); val tr = Offset(x1, y0)
        val br = Offset(x1, y1); val bl = Offset(x0, y1)
        val corners = listOf(tl, tr, br, bl)

        val wire = Color(0xFF37474F)
        // Loop wires
        drawLine(wire, tl, tr, 6f, cap = StrokeCap.Round)
        drawLine(wire, tr, br, 6f, cap = StrokeCap.Round)
        drawLine(wire, br, bl, 6f, cap = StrokeCap.Round)
        drawLine(wire, bl, tl, 6f, cap = StrokeCap.Round)

        // Flowing electrons along the perimeter
        if (switchOn && abs(current) > 0.001f) {
            val edges = listOf(tl to tr, tr to br, br to bl, bl to tl)
            val lens = edges.map { (a, b) -> (b - a).getDistance() }
            val total = lens.sum()
            val count = 26
            for (j in 0 until count) {
                var s = ((j.toFloat() / count) + phase) % 1f
                if (s < 0) s += 1f
                var d = s * total
                for (k in edges.indices) {
                    if (d <= lens[k]) {
                        val (a, b) = edges[k]
                        val f = if (lens[k] == 0f) 0f else d / lens[k]
                        val p = Offset(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f)
                        drawCircle(Color(0xFF1565C0), 5f, p)
                        break
                    }
                    d -= lens[k]
                }
            }
        }

        // Battery on the bottom edge
        val bcx = (x0 + x1) / 2f
        drawRect(Color(0xFFF4F6F8), Offset(bcx - 34f, y1 - 16f), Size(68f, 32f)) // gap
        drawLine(Color(0xFF263238), Offset(bcx - 10f, y1 - 20f), Offset(bcx - 10f, y1 + 20f), 6f) // long (+)
        drawLine(Color(0xFF263238), Offset(bcx + 10f, y1 - 11f), Offset(bcx + 10f, y1 + 11f), 12f) // short (-)
        // resistor on the right edge (zigzag)
        val rcy = (y0 + y1) / 2f
        drawRect(Color(0xFFF4F6F8), Offset(x1 - 14f, rcy - 36f), Size(28f, 72f))
        val zig = Path().apply {
            moveTo(x1, rcy - 36f)
            val n = 6; val seg = 72f / n
            for (i in 1..n) {
                val yy = rcy - 36f + i * seg
                val xx = if (i % 2 == 1) x1 + 13f else x1 - 13f
                lineTo(if (i == n) x1 else xx, yy)
            }
        }
        drawPath(zig, Color(0xFFEF6C00), style = Stroke(width = 4f, cap = StrokeCap.Round))

        // switch on the left edge
        val scy = (y0 + y1) / 2f
        drawRect(Color(0xFFF4F6F8), Offset(x0 - 16f, scy - 30f), Size(32f, 60f))
        drawCircle(Color(0xFF37474F), 5f, Offset(x0, scy + 24f))
        drawCircle(Color(0xFF37474F), 5f, Offset(x0, scy - 24f))
        if (switchOn) {
            drawLine(Color(0xFF2E7D32), Offset(x0, scy + 24f), Offset(x0, scy - 24f), 5f, cap = StrokeCap.Round)
        } else {
            drawLine(Color(0xFFC62828), Offset(x0, scy + 24f), Offset(x0 + 22f, scy - 14f), 5f, cap = StrokeCap.Round)
        }

        // Bulb on the top edge
        val lcx = (x0 + x1) / 2f
        drawRect(Color(0xFFF4F6F8), Offset(lcx - 26f, y0 - 26f), Size(52f, 52f))
        if (brightness > 0.01f) {
            drawCircle(Color(0xFFFFF59D).copy(alpha = brightness * 0.5f), 46f, Offset(lcx, y0))
            drawCircle(Color(0xFFFFEE58).copy(alpha = brightness * 0.7f), 30f, Offset(lcx, y0))
        }
        drawCircle(Color(0xFFFFFFFF), 20f, Offset(lcx, y0))
        drawCircle(
            color = Color(0xFFFFB300).copy(alpha = 0.35f + brightness * 0.65f),
            radius = 20f, center = Offset(lcx, y0), style = Stroke(width = 3f),
        )
        // filament
        drawLine(
            Color(0xFFEF6C00).copy(alpha = 0.4f + brightness * 0.6f),
            Offset(lcx - 9f, y0 + 6f), Offset(lcx, y0 - 8f), 3f,
        )
        drawLine(
            Color(0xFFEF6C00).copy(alpha = 0.4f + brightness * 0.6f),
            Offset(lcx, y0 - 8f), Offset(lcx + 9f, y0 + 6f), 3f,
        )
    }
}
