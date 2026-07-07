package com.zhangfeiyang.gewu

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
import androidx.compose.ui.Alignment
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
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

@Composable
fun PendulumScreen() {
    var length by remember { mutableStateOf(1.5f) }     // m
    var gravity by remember { mutableStateOf(9.81f) }   // m/s^2
    var ampDeg by remember { mutableStateOf(35f) }      // degrees
    var damping by remember { mutableStateOf(0.1f) }    // 1/s
    var mass by remember { mutableStateOf(1.5f) }       // kg (bob size only)

    var theta by remember { mutableStateOf(35f * PI.toFloat() / 180f) }
    var omega by remember { mutableStateOf(0f) }
    var running by remember { mutableStateOf(false) }
    var swings by remember { mutableStateOf(0) }
    var lastOmegaSign by remember { mutableStateOf(0) }

    var frame by remember { mutableStateOf(0L) }
    var lastNanos by remember { mutableStateOf(0L) }

    LaunchedEffect(Unit) {
        while (true) {
            withFrameNanos { now ->
                val dt = if (lastNanos == 0L) 0f else ((now - lastNanos) / 1_000_000_000f)
                lastNanos = now
                val clamped = dt.coerceIn(0f, 0.05f)
                if (!running) {
                    theta = ampDeg * PI.toFloat() / 180f
                    omega = 0f
                } else if (clamped > 0f) {
                    val sub = 8
                    val h = clamped / sub
                    repeat(sub) {
                        val alpha = -(gravity / length) * sin(theta) - damping * omega
                        omega += alpha * h
                        theta += omega * h
                    }
                    val s = if (omega > 0f) 1 else -1
                    if (lastOmegaSign != 0 && s != lastOmegaSign) swings++
                    lastOmegaSign = s
                }
                frame = now
            }
        }
    }

    val period = 2.0 * PI * sqrt(length / gravity).toDouble()
    val vbob = length * omega
    val ke = 0.5f * mass * vbob * vbob
    val pe = mass * gravity * length * (1f - cos(theta))
    val dark = LocalSimDark.current

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().weight(1f)) {
            PendulumCanvas(theta, length, mass, ke, pe, frame)
            MeasureCard(
                title = "测量数据",
                rows = listOf(
                    "周期(理论)" to "%.2f s".format(period),
                    "当前角度" to "%.0f °".format(theta * 180f / PI.toFloat()),
                    "摆动次数" to "$swings 次",
                    "重力" to "%.2f".format(gravity),
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
                    primaryColor = if (running) Color(0xFFFB8C00) else Color(0xFF8E24AA),
                    onPrimary = { running = !running },
                    midText = null, onMid = null,
                    secondaryText = "重置",
                    onSecondary = {
                        running = false
                        theta = ampDeg * PI.toFloat() / 180f
                        omega = 0f
                        swings = 0
                        lastOmegaSign = 0
                    },
                )
                Spacer(Modifier.height(8.dp))
                LabeledSlider("摆长", length, 0.3f..3f, "%.2f m".format(length)) { length = it }
                LabeledSlider("初始角度", ampDeg, 5f..80f, "%.0f °".format(ampDeg)) {
                    ampDeg = it
                    if (!running) { theta = it * PI.toFloat() / 180f; omega = 0f }
                }
                LabeledSlider("阻尼", damping, 0f..1.5f, "%.2f".format(damping)) { damping = it }
                LabeledSlider("摆球质量", mass, 0.5f..5f, "%.1f kg".format(mass)) { mass = it }

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
                    "提示：单摆周期与摆球质量无关。",
                    fontSize = 11.sp, color = Color(0xFF90A4AE),
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun PendulumCanvas(theta: Float, length: Float, mass: Float, ke: Float, pe: Float, frame: Long) {
    val barLabel = remember {
        Paint().apply {
            color = android.graphics.Color.argb(200, 40, 50, 60)
            textSize = 22f
            isAntiAlias = true
        }
    }
    Canvas(Modifier.fillMaxSize()) {
        frame.let { }
        val w = size.width
        val h = size.height
        // Sky background
        drawRect(color = Color(0xFFEAF3FB), size = Size(w, h))

        val pivotX = w * 0.5f
        val pivotY = h * 0.13f
        val availH = h * 0.72f
        val scale = availH / 3.0f               // metres -> px (max length 3 m)
        val lpx = length * scale
        val bobX = pivotX + lpx * sin(theta)
        val bobY = pivotY + lpx * cos(theta)
        val bobR = 12f + mass * 4f

        // Ceiling bracket
        drawRect(
            color = Color(0xFF90A4AE),
            topLeft = Offset(pivotX - 60f, pivotY - 16f),
            size = Size(120f, 12f),
        )
        // Vertical reference (dashed)
        drawLine(
            color = Color(0x33000000),
            start = Offset(pivotX, pivotY),
            end = Offset(pivotX, pivotY + lpx + bobR + 20f),
            strokeWidth = 2f,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 12f)),
        )
        // String
        drawLine(
            color = Color(0xFF455A64),
            start = Offset(pivotX, pivotY),
            end = Offset(bobX, bobY),
            strokeWidth = 4f,
            cap = StrokeCap.Round,
        )
        // Pivot
        drawCircle(color = Color(0xFF37474F), radius = 7f, center = Offset(pivotX, pivotY))
        // Bob
        drawCircle(color = Color(0xFF8E24AA), radius = bobR, center = Offset(bobX, bobY))
        drawCircle(
            color = Color.White.copy(alpha = 0.45f),
            radius = bobR * 0.35f,
            center = Offset(bobX - bobR * 0.3f, bobY - bobR * 0.3f),
        )
        // Angle arc
        drawArc(
            color = Color(0x558E24AA),
            startAngle = 90f,
            sweepAngle = theta * 180f / PI.toFloat(),
            useCenter = false,
            topLeft = Offset(pivotX - 38f, pivotY - 38f),
            size = Size(76f, 76f),
            style = Stroke(width = 3f),
        )

        drawEnergyBars(
            listOf(
                Triple("动能", ke, Color(0xFF43A047)),
                Triple("势能", pe, Color(0xFF1E88E5)),
                Triple("总能", ke + pe, Color(0xFF455A64)),
            ),
            barLabel,
        )
    }
}
