package org.phetlike.projectile

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.hypot

private class Charge(val x: Float, val y: Float, val q: Float)

@Composable
fun ChargesFieldScreen() {
    val charges = remember { mutableStateListOf<Charge>() }
    var sign by remember { mutableStateOf(1f) }       // +1 or -1 to place
    var showField by remember { mutableStateOf(true) }
    val dark = LocalSimDark.current

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            ChargesCanvas(charges, showField, sign)
            MeasureCard(
                title = "电荷与电场",
                rows = listOf(
                    "电荷数" to "${charges.size}",
                    "待放置" to if (sign > 0) "正电荷 +" else "负电荷 −",
                    "电场" to if (showField) "显示" else "隐藏",
                ),
                modifier = Modifier.padding(10.dp),
            )
        }
        Surface(color = panelSurface(dark), shadowElevation = 8.dp) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .height(280.dp)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Text("点击上方画布放置电荷", fontSize = 13.sp, color = panelStrong(dark), fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Button(
                        onClick = { sign = 1f },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (sign > 0) Color(0xFFE53935) else Color(0xFFBDBDBD),
                        ),
                    ) { Text("放置  +", fontSize = 15.sp, fontWeight = FontWeight.Bold) }
                    Spacer(Modifier.width(10.dp))
                    Button(
                        onClick = { sign = -1f },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (sign < 0) Color(0xFF1E88E5) else Color(0xFFBDBDBD),
                        ),
                    ) { Text("放置  −", fontSize = 15.sp, fontWeight = FontWeight.Bold) }
                }
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedButton(
                        onClick = { if (charges.isNotEmpty()) charges.removeAt(charges.size - 1) },
                        modifier = Modifier.weight(1f),
                    ) { Text("撤销") }
                    Spacer(Modifier.width(10.dp))
                    OutlinedButton(onClick = { charges.clear() }, modifier = Modifier.weight(1f)) { Text("清除全部") }
                }
                Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("显示电场矢量", fontSize = 13.sp, color = panelLabel(dark))
                    Spacer(Modifier.width(10.dp))
                    Switch(checked = showField, onCheckedChange = { showField = it })
                }
                Text(
                    "每个网格箭头是该点所有电荷电场的矢量叠加；箭头越长表示场越强。",
                    fontSize = 11.sp, color = Color(0xFF90A4AE),
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun ChargesCanvas(charges: MutableList<Charge>, showField: Boolean, sign: Float) {
    Canvas(
        Modifier
            .fillMaxSize()
            .pointerInput(sign) {
                detectTapGestures { pos -> charges.add(Charge(pos.x, pos.y, sign)) }
            },
    ) {
        val w = size.width
        val h = size.height
        drawRect(Color(0xFFF7F8FA), size = androidx.compose.ui.geometry.Size(w, h))

        // Electric field vectors on a grid
        if (showField) {
            val k = 4200f
            val spacing = 40f
            var gy = spacing * 0.6f
            while (gy < h) {
                var gx = spacing * 0.6f
                while (gx < w) {
                    var ex = 0f; var ey = 0f
                    for (c in charges) {
                        val dx = gx - c.x; val dy = gy - c.y
                        val r2 = dx * dx + dy * dy + 36f
                        val r = kotlin.math.sqrt(r2)
                        val e = k * c.q / r2
                        ex += e * dx / r; ey += e * dy / r
                    }
                    val m = hypot(ex, ey)
                    if (m > 0.04f) {
                        val len = 17f * m / (m + 2.5f)
                        val ux = ex / m; val uy = ey / m
                        val tail = Offset(gx - ux * len, gy - uy * len)
                        val head = Offset(gx + ux * len, gy + uy * len)
                        val shade = (0.25f + 0.6f * (m / (m + 2.5f))).coerceIn(0f, 1f)
                        val col = Color(0f, 0f, 0f, shade)
                        drawLine(col, tail, head, 2.5f, cap = StrokeCap.Round)
                        // arrowhead
                        val s = 5f
                        drawLine(col, head, Offset(head.x - ux * s - uy * s * 0.6f, head.y - uy * s + ux * s * 0.6f), 2.5f, cap = StrokeCap.Round)
                        drawLine(col, head, Offset(head.x - ux * s + uy * s * 0.6f, head.y - uy * s - ux * s * 0.6f), 2.5f, cap = StrokeCap.Round)
                    }
                    gx += spacing
                }
                gy += spacing
            }
        }

        // Charges
        for (c in charges) {
            val col = if (c.q > 0) Color(0xFFE53935) else Color(0xFF1E88E5)
            drawCircle(col, 18f, Offset(c.x, c.y))
            drawCircle(Color.White.copy(alpha = 0.35f), 6f, Offset(c.x - 5f, c.y - 5f))
            // + / - sign
            drawLine(Color.White, Offset(c.x - 8f, c.y), Offset(c.x + 8f, c.y), 4f, cap = StrokeCap.Round)
            if (c.q > 0) {
                drawLine(Color.White, Offset(c.x, c.y - 8f), Offset(c.x, c.y + 8f), 4f, cap = StrokeCap.Round)
            }
        }
    }
}
