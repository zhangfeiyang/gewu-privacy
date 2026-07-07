package com.zhangfeiyang.gewu

import android.graphics.Paint
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs

/** Whether the app chrome (control panels, home, settings) is in dark mode. */
internal val LocalSimDark = staticCompositionLocalOf { false }

internal fun panelSurface(dark: Boolean) = if (dark) Color(0xFF1C2026) else Color.White
internal fun panelLabel(dark: Boolean) = if (dark) Color(0xFFB0BEC5) else Color(0xFF455A64)
internal fun panelStrong(dark: Boolean) = if (dark) Color(0xFFECEFF1) else Color(0xFF263238)
internal fun panelAccent(dark: Boolean) = if (dark) Color(0xFF64B5F6) else Color(0xFF1565C0)

/** A floating measurement card used by every simulation. */
@Composable
internal fun MeasureCard(
    title: String,
    rows: List<Pair<String, String>>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .background(Color(0xE6FFFFFF), RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text(title, fontSize = 11.sp, color = Color(0xFF1565C0), fontWeight = FontWeight.Bold)
        for ((label, value) in rows) {
            Row(Modifier.padding(top = 2.dp)) {
                Text(label, fontSize = 12.sp, color = Color(0xFF607D8B), modifier = Modifier.width(76.dp))
                Text(value, fontSize = 12.sp, color = Color(0xFF263238), fontWeight = FontWeight.Medium)
            }
        }
    }
}

@Composable
internal fun LabeledSlider(
    label: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    valueText: String,
    onChange: (Float) -> Unit,
) {
    val dark = LocalSimDark.current
    Column(Modifier.padding(top = 2.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(label, fontSize = 13.sp, color = panelLabel(dark))
            Spacer(Modifier.weight(1f))
            Text(valueText, fontSize = 13.sp, color = panelAccent(dark), fontWeight = FontWeight.Medium)
        }
        Slider(value = value, onValueChange = onChange, valueRange = range)
    }
}

@Composable
internal fun PlanetChip(name: String, g: Float, current: Float, onPick: (Float) -> Unit) {
    val dark = LocalSimDark.current
    val selected = abs(current - g) < 0.01f
    OutlinedButton(
        onClick = { onPick(g) },
        modifier = Modifier.padding(end = 6.dp).height(32.dp),
        contentPadding = PaddingValues(horizontal = 10.dp),
        colors = if (selected)
            ButtonDefaults.outlinedButtonColors(containerColor = if (dark) Color(0xFF24405E) else Color(0xFFE3F2FD))
        else ButtonDefaults.outlinedButtonColors(),
    ) {
        Text(
            name, fontSize = 12.sp,
            color = if (selected) panelAccent(dark) else if (dark) Color(0xFF90A4AE) else Color(0xFF607D8B),
        )
    }
}

/** Draws a compact set of energy bars in the top-right of a simulation canvas.
 *  Pass the total as the last bar so every bar is scaled against it. */
internal fun DrawScope.drawEnergyBars(
    bars: List<Triple<String, Float, Color>>,
    labelPaint: Paint,
) {
    val w = size.width
    val h = size.height
    val n = bars.size
    val maxE = bars.maxOf { it.second }.coerceAtLeast(1f)
    val barW = w * 0.05f
    val gap = w * 0.014f
    val totalW = n * barW + (n - 1) * gap
    val bx = w - totalW - w * 0.05f
    val barBase = h * 0.40f
    val maxBarH = h * 0.30f
    for ((idx, bar) in bars.withIndex()) {
        val x = bx + idx * (barW + gap)
        val bh = (bar.second / maxE) * maxBarH
        drawRect(Color(0x18000000), Offset(x, barBase - maxBarH), Size(barW, maxBarH))
        drawRect(bar.third, Offset(x, barBase - bh), Size(barW, bh))
        drawContext.canvas.nativeCanvas.drawText(bar.first, x - 2f, barBase + 22f, labelPaint)
    }
}

/** Primary / secondary action buttons row used by sims. */
@Composable
internal fun ActionRow(
    primaryText: String,
    primaryColor: Color,
    onPrimary: () -> Unit,
    secondaryText: String,
    onSecondary: () -> Unit,
    midText: String? = null,
    onMid: (() -> Unit)? = null,
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Button(
            onClick = onPrimary,
            modifier = Modifier.weight(1f),
            colors = ButtonDefaults.buttonColors(containerColor = primaryColor),
        ) { Text(primaryText, fontSize = 15.sp, fontWeight = FontWeight.Bold) }
        if (midText != null && onMid != null) {
            Spacer(Modifier.width(10.dp))
            OutlinedButton(onClick = onMid, modifier = Modifier.weight(1f)) { Text(midText) }
        }
        Spacer(Modifier.width(10.dp))
        OutlinedButton(onClick = onSecondary, modifier = Modifier.weight(1f)) { Text(secondaryText) }
    }
}
