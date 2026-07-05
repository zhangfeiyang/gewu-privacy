package org.phetlike.projectile

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

private val ELEMENTS = listOf(
    "" to "—", "H" to "氢", "He" to "氦", "Li" to "锂", "Be" to "铍", "B" to "硼",
    "C" to "碳", "N" to "氮", "O" to "氧", "F" to "氟", "Ne" to "氖",
    "Na" to "钠", "Mg" to "镁", "Al" to "铝", "Si" to "硅", "P" to "磷",
    "S" to "硫", "Cl" to "氯", "Ar" to "氩", "K" to "钾", "Ca" to "钙",
    "Sc" to "钪", "Ti" to "钛", "V" to "钒", "Cr" to "铬", "Mn" to "锰",
    "Fe" to "铁", "Co" to "钴", "Ni" to "镍", "Cu" to "铜", "Zn" to "锌",
)
private val SHELLS = intArrayOf(2, 8, 18, 8)

@Composable
fun AtomScreen() {
    var protons by remember { mutableStateOf(6) }
    var neutrons by remember { mutableStateOf(6) }
    var electrons by remember { mutableStateOf(6) }
    val dark = LocalSimDark.current

    var phase by remember { mutableStateOf(0f) }
    var lastNanos by remember { mutableStateOf(0L) }
    LaunchedEffect(Unit) {
        while (true) {
            withFrameNanos { now ->
                val dt = if (lastNanos == 0L) 0f else ((now - lastNanos) / 1_000_000_000f)
                lastNanos = now
                phase += dt.coerceIn(0f, 0.05f) * 0.6f
            }
        }
    }

    val symbol = ELEMENTS.getOrElse(protons) { "" to "—" }
    val mass = protons + neutrons
    val charge = protons - electrons
    val type = when {
        protons == 0 -> "—"
        charge == 0 -> "中性原子"
        charge > 0 -> "阳离子 +$charge"
        else -> "阴离子 $charge"
    }

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            AtomCanvas(protons, neutrons, electrons, phase)
            MeasureCard(
                title = "原子信息",
                rows = listOf(
                    "元素" to (if (protons == 0) "—" else "${symbol.second} ${symbol.first}"),
                    "质量数" to "$mass",
                    "电荷" to (if (charge == 0) "0" else "%+d".format(charge)),
                    "类型" to type,
                ),
                modifier = Modifier.padding(10.dp),
            )
        }
        Surface(color = panelSurface(dark), shadowElevation = 8.dp) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .height(286.dp)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                ParticleRow("质子", protons, Color(0xFFE53935), dark,
                    onMinus = { if (protons > 0) protons-- }, onPlus = { if (protons < 30) protons++ })
                ParticleRow("中子", neutrons, Color(0xFF78909C), dark,
                    onMinus = { if (neutrons > 0) neutrons-- }, onPlus = { if (neutrons < 40) neutrons++ })
                ParticleRow("电子", electrons, Color(0xFF1E88E5), dark,
                    onMinus = { if (electrons > 0) electrons-- }, onPlus = { if (electrons < 36) electrons++ })
                Spacer(Modifier.height(6.dp))
                OutlinedButton(onClick = { protons = 0; neutrons = 0; electrons = 0 }) { Text("清空") }
                Text(
                    "质子数决定元素种类；质子+中子=质量数；质子−电子=电荷（决定离子）。",
                    fontSize = 11.sp, color = Color(0xFF90A4AE),
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun ParticleRow(
    label: String,
    count: Int,
    color: Color,
    dark: Boolean,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(16.dp)) {
            Canvas(Modifier.fillMaxSize()) { drawCircle(color, size.minDimension / 2f, center) }
        }
        Text(label, fontSize = 14.sp, color = panelStrong(dark), modifier = Modifier.width(40.dp))
        OutlinedButton(onClick = onMinus, modifier = Modifier.size(width = 52.dp, height = 38.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) { Text("−", fontSize = 20.sp) }
        Text("$count", fontSize = 16.sp, color = panelStrong(dark), fontWeight = FontWeight.Bold,
            modifier = Modifier.width(34.dp))
        OutlinedButton(onClick = onPlus, modifier = Modifier.size(width = 52.dp, height = 38.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) { Text("+", fontSize = 20.sp) }
    }
}

@Composable
private fun AtomCanvas(protons: Int, neutrons: Int, electrons: Int, phase: Float) {
    Canvas(Modifier.fillMaxSize()) {
        phase.let { }
        val w = size.width
        val h = size.height
        drawRect(Color(0xFF0E1726), size = size)
        val cx = w * 0.5f
        val cy = h * 0.5f
        val maxR = min(w, h) * 0.44f

        // Electron shells (rings + orbiting electrons)
        var remaining = electrons
        for ((shellIdx, cap) in SHELLS.withIndex()) {
            if (remaining <= 0) break
            val onShell = min(remaining, cap)
            remaining -= onShell
            val rr = maxR * (0.45f + 0.18f * shellIdx)
            drawCircle(Color(0x33B0BEC5), rr, Offset(cx, cy), style = Stroke(width = 1.5f))
            for (i in 0 until onShell) {
                val ang = phase * (1f - shellIdx * 0.12f) + i * (6.2832f / onShell)
                val ex = cx + rr * cos(ang)
                val ey = cy + rr * sin(ang)
                drawCircle(Color(0xFF42A5F5), 7f, Offset(ex, ey))
                drawCircle(Color.White.copy(alpha = 0.4f), 2.5f, Offset(ex - 2f, ey - 2f))
            }
        }

        // Nucleus (protons + neutrons clustered)
        val total = protons + neutrons
        val nucR = (8f + sqrt(total.toFloat()) * 7f).coerceAtMost(maxR * 0.4f)
        for (i in 0 until total) {
            val golden = 2.39996f
            val ang = i * golden
            val r = if (total <= 1) 0f else nucR * sqrt(i / total.toFloat())
            val px = cx + r * cos(ang)
            val py = cy + r * sin(ang)
            val isProton = i < protons
            drawCircle(if (isProton) Color(0xFFE53935) else Color(0xFF90A4AE), 9f, Offset(px, py))
            drawCircle(Color.White.copy(alpha = 0.3f), 3f, Offset(px - 2.5f, py - 2.5f))
        }
    }
}
