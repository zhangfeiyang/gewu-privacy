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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

@Composable
fun BendingLightScreen() {
    var incidenceDeg by remember { mutableStateOf(45f) }
    var n1 by remember { mutableStateOf(1.0f) }   // upper medium
    var n2 by remember { mutableStateOf(1.33f) }  // lower medium
    val dark = LocalSimDark.current

    val th1 = incidenceDeg * PI.toFloat() / 180f
    val sinT2 = n1 / n2 * sin(th1)
    val tir = sinT2 > 1f
    val th2 = if (tir) 0f else asin(sinT2.coerceIn(-1f, 1f))
    val critical = if (n1 > n2) asin((n2 / n1).coerceIn(0f, 1f)) * 180f / PI.toFloat() else null

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            BendingCanvas(th1, th2, tir, n1, n2)
            MeasureCard(
                title = "测量数据",
                rows = listOf(
                    "入射角" to "%.0f °".format(incidenceDeg),
                    "折射角" to if (tir) "—" else "%.0f °".format(th2 * 180f / PI.toFloat()),
                    "临界角" to (critical?.let { "%.0f °".format(it) } ?: "无"),
                    "状态" to if (tir) "全反射" else "折射 + 反射",
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
                LabeledSlider("入射角", incidenceDeg, 0f..89f, "%.0f °".format(incidenceDeg)) { incidenceDeg = it }
                Row(
                    Modifier.fillMaxWidth().padding(top = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("上方介质", fontSize = 13.sp, color = panelLabel(dark), modifier = Modifier.width(64.dp))
                    MediumChip("空气", 1.0f, n1) { n1 = it }
                    MediumChip("水", 1.33f, n1) { n1 = it }
                    MediumChip("玻璃", 1.5f, n1) { n1 = it }
                }
                Row(
                    Modifier.fillMaxWidth().padding(top = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("下方介质", fontSize = 13.sp, color = panelLabel(dark), modifier = Modifier.width(64.dp))
                    MediumChip("水", 1.33f, n2) { n2 = it }
                    MediumChip("玻璃", 1.5f, n2) { n2 = it }
                    MediumChip("钻石", 2.42f, n2) { n2 = it }
                }
                LabeledSlider("上方 n₁", n1, 1f..2.5f, "%.2f".format(n1)) { n1 = it }
                LabeledSlider("下方 n₂", n2, 1f..2.5f, "%.2f".format(n2)) { n2 = it }
                Text(
                    "斯涅尔定律 n₁·sinθ₁ = n₂·sinθ₂。当光从光密射向光疏且超过临界角时发生全反射。",
                    fontSize = 11.sp, color = Color(0xFF90A4AE),
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun MediumChip(name: String, value: Float, current: Float, onPick: (Float) -> Unit) =
    PlanetChip(name, value, current, onPick)

@Composable
private fun BendingCanvas(th1: Float, th2: Float, tir: Boolean, n1: Float, n2: Float) {
    Canvas(Modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        val interfaceY = h * 0.5f
        val ox = w * 0.5f
        val L = min(w, h) * 0.42f

        // Media
        val topColor = lerp(Color(0xFFF2F8FE), Color(0xFF7EB6DA), ((n1 - 1f) / 1.5f).coerceIn(0f, 1f))
        val botColor = lerp(Color(0xFFCDE8F5), Color(0xFF0D2E66), ((n2 - 1f) / 1.5f).coerceIn(0f, 1f))
        drawRect(topColor, Offset(0f, 0f), Size(w, interfaceY))
        drawRect(botColor, Offset(0f, interfaceY), Size(w, h - interfaceY))
        // Interface line
        drawLine(Color(0x55000000), Offset(0f, interfaceY), Offset(w, interfaceY), 3f)
        // Normal (dashed vertical)
        drawLine(
            Color(0x66FFFFFF), Offset(ox, interfaceY - L), Offset(ox, interfaceY + L), 2f,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 12f)),
        )

        val o = Offset(ox, interfaceY)
        val yellow = Color(0xFFFFEB3B)

        // Incident ray (from upper-left into O)
        val inc = Offset(ox - L * sin(th1), interfaceY - L * cos(th1))
        drawLine(yellow, inc, o, 5f, cap = StrokeCap.Round)
        drawArrow(inc, o, yellow)

        // Reflected ray (upper-right)
        val refl = Offset(ox + L * sin(th1), interfaceY - L * cos(th1))
        val reflAlpha = if (tir) 1f else 0.4f
        drawLine(yellow.copy(alpha = reflAlpha), o, refl, if (tir) 5f else 3f, cap = StrokeCap.Round)
        drawArrow(o, refl, yellow.copy(alpha = reflAlpha))

        // Refracted ray (lower-right) unless total internal reflection
        if (!tir) {
            val refr = Offset(ox + L * sin(th2), interfaceY + L * cos(th2))
            drawLine(Color(0xFFFFC107), o, refr, 5f, cap = StrokeCap.Round)
            drawArrow(o, refr, Color(0xFFFFC107))
        }

        // Origin glow + light source bulb at incident end
        drawCircle(Color(0xFFFFF59D), 8f, o)
        drawCircle(Color(0xFFFF7043), 9f, inc)
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawArrow(
    from: Offset, to: Offset, color: Color,
) {
    val dx = to.x - from.x
    val dy = to.y - from.y
    val len = kotlin.math.hypot(dx, dy)
    if (len < 1f) return
    val ux = dx / len
    val uy = dy / len
    val size = 16f
    val mid = Offset(from.x + dx * 0.62f, from.y + dy * 0.62f)
    val left = Offset(mid.x - ux * size - uy * size * 0.5f, mid.y - uy * size + ux * size * 0.5f)
    val right = Offset(mid.x - ux * size + uy * size * 0.5f, mid.y - uy * size - ux * size * 0.5f)
    drawLine(color, mid, left, 4f, cap = StrokeCap.Round)
    drawLine(color, mid, right, 4f, cap = StrokeCap.Round)
}
