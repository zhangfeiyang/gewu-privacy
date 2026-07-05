package org.phetlike.projectile

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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

@Composable
fun PrismScreen() {
    var tiltDeg by remember { mutableStateOf(8f) }       // incoming beam tilt
    var dispersion by remember { mutableStateOf(0.05f) } // exaggeration of n(λ) spread
    var nBase by remember { mutableStateOf(1.52f) }
    val dark = LocalSimDark.current

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            PrismCanvas(tiltDeg, dispersion, nBase)
            MeasureCard(
                title = "棱镜色散",
                rows = listOf(
                    "入射倾角" to "%.0f °".format(tiltDeg),
                    "基准 n" to "%.2f".format(nBase),
                    "色散强度" to "%.2f".format(dispersion),
                ),
                modifier = Modifier.padding(10.dp),
            )
        }
        Surface(color = panelSurface(dark), shadowElevation = 8.dp) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .height(260.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                LabeledSlider("入射倾角", tiltDeg, -25f..25f, "%.0f °".format(tiltDeg)) { tiltDeg = it }
                LabeledSlider("基准折射率", nBase, 1.4f..1.7f, "%.2f".format(nBase)) { nBase = it }
                LabeledSlider("色散强度", dispersion, 0f..0.12f, "%.2f".format(dispersion)) { dispersion = it }
                Text(
                    "玻璃对不同波长的折射率不同（紫光最大、红光最小），白光经棱镜两次折射后分解成光谱。",
                    fontSize = 11.sp, color = Color(0xFF90A4AE),
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

// --- vector helpers -------------------------------------------------------

private fun sub(a: Offset, b: Offset) = Offset(a.x - b.x, a.y - b.y)
private fun add(a: Offset, b: Offset) = Offset(a.x + b.x, a.y + b.y)
private fun scale(a: Offset, s: Float) = Offset(a.x * s, a.y * s)
private fun dot(a: Offset, b: Offset) = a.x * b.x + a.y * b.y
private fun crossv(ax: Float, ay: Float, bx: Float, by: Float) = ax * by - ay * bx
private fun norm(a: Offset): Offset {
    val l = hypot(a.x, a.y)
    return if (l < 1e-6f) a else Offset(a.x / l, a.y / l)
}

/** Ray p+t*d against segment a..b. Returns t>0 if it crosses, else null. */
private fun rayEdge(p: Offset, d: Offset, a: Offset, b: Offset): Float? {
    val e = sub(b, a)
    val denom = crossv(d.x, d.y, e.x, e.y)
    if (kotlin.math.abs(denom) < 1e-6f) return null
    val ap = sub(a, p)
    val t = crossv(ap.x, ap.y, e.x, e.y) / denom
    val s = crossv(ap.x, ap.y, d.x, d.y) / denom
    return if (t > 1e-2f && s >= -1e-3f && s <= 1.0001f) t else null
}

/** Vector Snell refraction. n must oppose d (cos = -d·n > 0). null on TIR. */
private fun refract(d: Offset, n: Offset, eta: Float): Offset? {
    val cosi = -dot(d, n)
    val k = 1f - eta * eta * (1f - cosi * cosi)
    if (k < 0f) return null
    return norm(add(scale(d, eta), scale(n, eta * cosi - sqrt(k))))
}

private fun nOfWavelength(lambda: Float, nBase: Float, disp: Float): Float =
    nBase + disp * (560f - lambda) / 160f

private fun wavelengthColor(l: Float): Color {
    var r = 0f; var g = 0f; var b = 0f
    when {
        l < 440 -> { r = -(l - 440f) / (440f - 380f); b = 1f }
        l < 490 -> { g = (l - 440f) / (490f - 440f); b = 1f }
        l < 510 -> { g = 1f; b = -(l - 510f) / (510f - 490f) }
        l < 580 -> { r = (l - 510f) / (580f - 510f); g = 1f }
        l < 645 -> { r = 1f; g = -(l - 645f) / (645f - 580f) }
        else -> { r = 1f }
    }
    return Color(r.coerceIn(0f, 1f), g.coerceIn(0f, 1f), b.coerceIn(0f, 1f), 1f)
}

@Composable
private fun PrismCanvas(tiltDeg: Float, dispersion: Float, nBase: Float) {
    Canvas(Modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        drawRect(Color(0xFF101418), size = size) // dark room to make the spectrum pop

        val cx = w * 0.54f
        val cy = h * 0.5f
        val s = min(w, h) * 0.34f
        val a = Offset(cx, cy - s * 0.62f)            // apex (top)
        val b = Offset(cx - s * 0.58f, cy + s * 0.5f) // bottom-left
        val c = Offset(cx + s * 0.58f, cy + s * 0.5f) // bottom-right
        val centroid = Offset((a.x + b.x + c.x) / 3f, (a.y + b.y + c.y) / 3f)
        val edges = listOf(a to b, b to c, c to a)
        val outN = edges.map { (p1, p2) ->
            val e = sub(p2, p1)
            var n = norm(Offset(e.y, -e.x))
            val mid = Offset((p1.x + p2.x) / 2f, (p1.y + p2.y) / 2f)
            if (dot(n, sub(mid, centroid)) < 0f) n = scale(n, -1f)
            n
        }

        // Draw the glass prism
        val tri = Path().apply { moveTo(a.x, a.y); lineTo(b.x, b.y); lineTo(c.x, c.y); close() }
        drawPath(tri, Color(0x33B3E5FC))
        drawPath(tri, Color(0x88B3E5FC), style = Stroke(width = 2f))

        // Aim a white beam at the middle of the left face (a..b)
        val tilt = tiltDeg * PI.toFloat() / 180f
        val d0 = norm(Offset(cos(tilt), sin(tilt)))
        val leftMid = Offset((a.x + b.x) / 2f, (a.y + b.y) / 2f)
        val source = sub(leftMid, scale(d0, s * 1.4f))

        // Entry: nearest edge we cross going inward
        var entryT = Float.MAX_VALUE
        var entryEdge = -1
        for (i in edges.indices) {
            if (dot(d0, outN[i]) >= 0f) continue
            val t = rayEdge(source, d0, edges[i].first, edges[i].second) ?: continue
            if (t < entryT) { entryT = t; entryEdge = i }
        }
        if (entryEdge < 0) {
            // beam misses the prism; just draw it straight
            drawLine(Color.White, source, add(source, scale(d0, s * 3f)), 3f, cap = StrokeCap.Round)
            return@Canvas
        }
        val entry = add(source, scale(d0, entryT))
        drawLine(Color(0xFFFFFFFF), source, entry, 4f, cap = StrokeCap.Round)

        // Trace each wavelength through the prism
        var lambda = 400f
        while (lambda <= 680f) {
            val nl = nOfWavelength(lambda, nBase, dispersion)
            val col = wavelengthColor(lambda)
            val d1 = refract(d0, outN[entryEdge], 1f / nl)
            if (d1 != null) {
                // Exit: nearest other edge
                val p1 = add(entry, scale(d1, 0.5f))
                var exT = Float.MAX_VALUE; var exEdge = -1
                for (i in edges.indices) {
                    if (i == entryEdge) continue
                    val t = rayEdge(p1, d1, edges[i].first, edges[i].second) ?: continue
                    if (t < exT) { exT = t; exEdge = i }
                }
                if (exEdge >= 0) {
                    val exit = add(p1, scale(d1, exT))
                    drawLine(col.copy(alpha = 0.85f), entry, exit, 2.5f, cap = StrokeCap.Round)
                    val d2 = refract(d1, scale(outN[exEdge], -1f), nl)
                    if (d2 != null) {
                        drawLine(col, exit, add(exit, scale(d2, s * 2.6f)), 2.5f, cap = StrokeCap.Round)
                    }
                }
            }
            lambda += 20f
        }
    }
}
