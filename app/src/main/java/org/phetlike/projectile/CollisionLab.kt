package org.phetlike.projectile

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs
import kotlin.math.pow

private const val TRACK = 20f

@Composable
fun CollisionScreen() {
    var m1 by remember { mutableStateOf(2f) }
    var m2 by remember { mutableStateOf(1f) }
    var v1i by remember { mutableStateOf(4f) }
    var v2i by remember { mutableStateOf(-2f) }
    var elasticity by remember { mutableStateOf(1f) }
    var running by remember { mutableStateOf(false) }
    val dark = LocalSimDark.current

    var x1 by remember { mutableStateOf(5f) }
    var x2 by remember { mutableStateOf(15f) }
    var v1 by remember { mutableStateOf(4f) }
    var v2 by remember { mutableStateOf(-2f) }

    var frame by remember { mutableStateOf(0L) }
    var lastNanos by remember { mutableStateOf(0L) }

    fun radius(m: Float) = 0.5f + m.pow(1f / 3f) * 0.6f

    fun reset() {
        x1 = 5f; x2 = 15f; v1 = v1i; v2 = v2i
    }

    LaunchedEffect(Unit) {
        while (true) {
            withFrameNanos { now ->
                val dt = if (lastNanos == 0L) 0f else ((now - lastNanos) / 1_000_000_000f)
                lastNanos = now
                val clamped = dt.coerceIn(0f, 0.05f)
                if (!running) {
                    v1 = v1i; v2 = v2i
                } else if (clamped > 0f) {
                    val r1 = radius(m1); val r2 = radius(m2)
                    val sub = 6
                    val hStep = clamped / sub
                    repeat(sub) {
                        x1 += v1 * hStep
                        x2 += v2 * hStep
                        // walls
                        if (x1 < r1) { x1 = r1; v1 = -v1 }
                        if (x2 > TRACK - r2) { x2 = TRACK - r2; v2 = -v2 }
                        if (x1 > TRACK - r1) { x1 = TRACK - r1; v1 = -v1 }
                        if (x2 < r2) { x2 = r2; v2 = -v2 }
                        // ball-ball collision
                        if (x2 - x1 <= r1 + r2 && (v1 - v2) > 0f) {
                            val e = elasticity
                            val sum = m1 + m2
                            val nv1 = (m1 * v1 + m2 * v2 + m2 * e * (v2 - v1)) / sum
                            val nv2 = (m1 * v1 + m2 * v2 + m1 * e * (v1 - v2)) / sum
                            v1 = nv1; v2 = nv2
                            val overlap = (r1 + r2) - (x2 - x1)
                            x1 -= overlap / 2f; x2 += overlap / 2f
                        }
                    }
                }
                frame = now
            }
        }
    }

    val pTot = m1 * v1 + m2 * v2
    val keTot = 0.5f * m1 * v1 * v1 + 0.5f * m2 * v2 * v2

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            CollisionCanvas(x1, x2, v1, v2, radius(m1), radius(m2), frame)
            MeasureCard(
                title = "测量数据",
                rows = listOf(
                    "总动量" to "%.1f".format(pTot),
                    "总动能" to "%.1f".format(keTot),
                    "球1速度" to "%.1f".format(v1),
                    "球2速度" to "%.1f".format(v2),
                ),
                modifier = Modifier.padding(10.dp),
            )
        }
        Surface(color = panelSurface(dark), shadowElevation = 8.dp) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .height(316.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                ActionRow(
                    primaryText = if (running) "⏸ 暂停" else "▶ 开始",
                    primaryColor = if (running) Color(0xFFFB8C00) else Color(0xFF5E35B1),
                    onPrimary = { running = !running },
                    midText = null, onMid = null,
                    secondaryText = "重置",
                    onSecondary = { running = false; reset() },
                )
                Spacer(Modifier.height(8.dp))
                LabeledSlider("球1 质量", m1, 0.5f..5f, "%.1f".format(m1)) { m1 = it }
                LabeledSlider("球2 质量", m2, 0.5f..5f, "%.1f".format(m2)) { m2 = it }
                LabeledSlider("球1 初速", v1i, -6f..6f, "%+.1f".format(v1i)) { v1i = it; if (!running) reset() }
                LabeledSlider("球2 初速", v2i, -6f..6f, "%+.1f".format(v2i)) { v2i = it; if (!running) reset() }
                LabeledSlider("弹性系数 e", elasticity, 0f..1f, "%.2f".format(elasticity)) { elasticity = it }
                Text(
                    "碰撞前后总动量恒守恒；e=1 完全弹性（动能守恒），e=0 完全非弹性（两球同速）。",
                    fontSize = 11.sp, color = Color(0xFF90A4AE),
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun CollisionCanvas(
    x1: Float, x2: Float, v1: Float, v2: Float, r1: Float, r2: Float, frame: Long,
) {
    Canvas(Modifier.fillMaxSize()) {
        frame.let { }
        val w = size.width
        val h = size.height
        drawRect(Color(0xFFF3F1FA), size = size)

        val left = w * 0.06f
        val trackW = w * 0.88f
        val cy = h * 0.5f
        val scale = trackW / TRACK

        fun sx(x: Float) = left + x * scale

        // Track + walls
        drawRect(Color(0xFFCAC4E0), Offset(left, cy + 22f), Size(trackW, 6f))
        drawRect(Color(0xFF5E35B1), Offset(left - 8f, cy - 60f), Size(8f, 90f))
        drawRect(Color(0xFF5E35B1), Offset(left + trackW, cy - 60f), Size(8f, 90f))

        // Ball 1
        val c1 = Offset(sx(x1), cy)
        drawCircle(Color(0xFFE53935), r1 * scale, c1)
        drawCircle(Color.White.copy(alpha = 0.35f), r1 * scale * 0.3f, Offset(c1.x - r1 * scale * 0.3f, c1.y - r1 * scale * 0.3f))
        velArrow(c1, v1, scale, Color(0xFFB71C1C))

        // Ball 2
        val c2 = Offset(sx(x2), cy)
        drawCircle(Color(0xFF1E88E5), r2 * scale, c2)
        drawCircle(Color.White.copy(alpha = 0.35f), r2 * scale * 0.3f, Offset(c2.x - r2 * scale * 0.3f, c2.y - r2 * scale * 0.3f))
        velArrow(c2, v2, scale, Color(0xFF0D47A1))
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.velArrow(c: Offset, v: Float, scale: Float, color: Color) {
    if (abs(v) < 0.05f) return
    val len = v * scale * 0.5f
    val tip = Offset(c.x + len, c.y)
    drawLine(color, c, tip, 4f, cap = StrokeCap.Round)
    val dir = if (v > 0) 1f else -1f
    drawLine(color, tip, Offset(tip.x - dir * 9f, tip.y - 6f), 4f, cap = StrokeCap.Round)
    drawLine(color, tip, Offset(tip.x - dir * 9f, tip.y + 6f), 4f, cap = StrokeCap.Round)
}
