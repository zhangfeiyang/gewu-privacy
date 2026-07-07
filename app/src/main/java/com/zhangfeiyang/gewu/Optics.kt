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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs

@Composable
fun OpticsScreen() {
    var convex by remember { mutableStateOf(true) }
    var fMag by remember { mutableStateOf(14f) }   // focal length magnitude (units)
    var objectDist by remember { mutableStateOf(34f) }
    var objectH by remember { mutableStateOf(8f) }
    val dark = LocalSimDark.current

    val f = if (convex) fMag else -fMag
    val invDi = 1f / f - 1f / objectDist
    val atInfinity = abs(invDi) < 1e-3f
    val di = if (atInfinity) Float.POSITIVE_INFINITY else 1f / invDi
    val m = if (atInfinity) Float.POSITIVE_INFINITY else -di / objectDist
    val real = !atInfinity && di > 0f

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            OpticsCanvas(convex, f, objectDist, objectH, di, m, atInfinity)
            MeasureCard(
                title = "成像数据",
                rows = listOf(
                    "像距" to if (atInfinity) "∞" else "%.1f".format(di),
                    "放大率" to if (atInfinity) "∞" else "%.2f×".format(abs(m)),
                    "像" to when {
                        atInfinity -> "无（平行出射）"
                        real -> "实像 · 倒立"
                        else -> "虚像 · 正立"
                    },
                    "大小" to if (atInfinity) "—" else if (abs(m) > 1f) "放大" else "缩小",
                ),
                modifier = Modifier.padding(10.dp),
            )
        }
        Surface(color = panelSurface(dark), shadowElevation = 8.dp) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .height(280.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("透镜", fontSize = 13.sp, color = panelLabel(dark), modifier = Modifier.width(48.dp))
                    LensChip("凸透镜", convex) { convex = true }
                    LensChip("凹透镜", !convex) { convex = false }
                }
                LabeledSlider("焦距 f", fMag, 6f..30f, "%.0f".format(fMag)) { fMag = it }
                LabeledSlider("物距", objectDist, 8f..70f, "%.0f".format(objectDist)) { objectDist = it }
                LabeledSlider("物高", objectH, 3f..14f, "%.0f".format(objectH)) { objectH = it }
                Text(
                    "薄透镜公式 1/f = 1/do + 1/di。凸透镜物体在焦点内成放大正立虚像（放大镜）。",
                    fontSize = 11.sp, color = Color(0xFF90A4AE),
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun LensChip(label: String, selected: Boolean, onClick: () -> Unit) =
    PlanetChip(label, if (selected) 1f else 0f, 1f, onPick = { onClick() })

@Composable
private fun OpticsCanvas(
    convex: Boolean,
    f: Float,
    objectDist: Float,
    objectH: Float,
    di: Float,
    m: Float,
    atInfinity: Boolean,
) {
    Canvas(Modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        drawRect(Color(0xFFF7FAFC), size = size)

        val cy = h * 0.46f
        val lensX = w * 0.52f
        val scale = w * 0.011f
        val fpx = abs(f) * scale

        // Optical axis
        drawLine(Color(0x55000000), Offset(0f, cy), Offset(w, cy), 2f)

        // Lens symbol (vertical line with arrowheads)
        val lensHalf = h * 0.34f
        drawLine(Color(0xFF1565C0), Offset(lensX, cy - lensHalf), Offset(lensX, cy + lensHalf), 4f)
        val ah = 16f
        if (convex) {
            drawLine(Color(0xFF1565C0), Offset(lensX, cy - lensHalf), Offset(lensX - ah, cy - lensHalf + ah), 4f)
            drawLine(Color(0xFF1565C0), Offset(lensX, cy - lensHalf), Offset(lensX + ah, cy - lensHalf + ah), 4f)
            drawLine(Color(0xFF1565C0), Offset(lensX, cy + lensHalf), Offset(lensX - ah, cy + lensHalf - ah), 4f)
            drawLine(Color(0xFF1565C0), Offset(lensX, cy + lensHalf), Offset(lensX + ah, cy + lensHalf - ah), 4f)
        } else {
            drawLine(Color(0xFF1565C0), Offset(lensX, cy - lensHalf), Offset(lensX - ah, cy - lensHalf - ah), 4f)
            drawLine(Color(0xFF1565C0), Offset(lensX, cy - lensHalf), Offset(lensX + ah, cy - lensHalf - ah), 4f)
            drawLine(Color(0xFF1565C0), Offset(lensX, cy + lensHalf), Offset(lensX - ah, cy + lensHalf + ah), 4f)
            drawLine(Color(0xFF1565C0), Offset(lensX, cy + lensHalf), Offset(lensX + ah, cy + lensHalf + ah), 4f)
        }
        // Focal points
        for (s in listOf(-1f, 1f)) {
            val fx = lensX + s * fpx
            drawCircle(Color(0xFF9C27B0), 5f, Offset(fx, cy))
        }

        // Object (upright arrow on the left)
        val objX = lensX - objectDist * scale
        val objTopY = cy - objectH * scale
        drawArrowV(Offset(objX, cy), Offset(objX, objTopY), Color(0xFF2E7D32))

        val ot = Offset(objX, objTopY)
        val center = Offset(lensX, cy)
        val yellow = Color(0xFFF9A825)

        // Image top point
        val imageX = lensX + (if (atInfinity) 0f else di) * scale
        val imageTopY = cy - (if (atInfinity) 0f else m * objectH) * scale
        val it = Offset(imageX, imageTopY)

        // Ray 1: parallel to axis, then refracts toward/away from focus (through image top)
        val pPar = Offset(lensX, objTopY)
        drawLine(yellow, ot, pPar, 2.5f, cap = StrokeCap.Round)
        drawRayThrough(pPar, it, w, yellow)

        // Ray 2: chief ray through lens centre (undeviated)
        drawLine(yellow, ot, center, 2.5f, cap = StrokeCap.Round)
        drawRayThrough(center, it, w, yellow)

        // Image arrow
        if (!atInfinity) {
            val real = di > 0f
            if (real) {
                drawArrowV(Offset(imageX, cy), it, Color(0xFFD32F2F))
            } else {
                // virtual: dashed
                drawArrowVDashed(Offset(imageX, cy), it, Color(0xFFD32F2F))
            }
        }
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawRayThrough(
    a: Offset, b: Offset, w: Float, color: Color,
) {
    if (abs(b.x - a.x) < 0.5f) return
    val slope = (b.y - a.y) / (b.x - a.x)
    val yAtRight = a.y + slope * (w - a.x)
    drawLine(color, a, Offset(w, yAtRight), 2.5f, cap = StrokeCap.Round)
    // dashed back-extension toward a virtual image point on the left
    if (b.x < a.x) {
        drawLine(
            color.copy(alpha = 0.5f), a, b, 1.5f,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f)),
        )
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawArrowV(base: Offset, tip: Offset, color: Color) {
    drawLine(color, base, tip, 4f, cap = StrokeCap.Round)
    val dir = if (tip.y < base.y) -1f else 1f
    drawLine(color, tip, Offset(tip.x - 7f, tip.y + dir * 10f), 4f, cap = StrokeCap.Round)
    drawLine(color, tip, Offset(tip.x + 7f, tip.y + dir * 10f), 4f, cap = StrokeCap.Round)
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawArrowVDashed(base: Offset, tip: Offset, color: Color) {
    drawLine(color, base, tip, 3f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(9f, 9f)))
    val dir = if (tip.y < base.y) -1f else 1f
    drawLine(color, tip, Offset(tip.x - 6f, tip.y + dir * 9f), 3f)
    drawLine(color, tip, Offset(tip.x + 6f, tip.y + dir * 9f), 3f)
}
