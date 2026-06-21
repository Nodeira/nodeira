package com.deranjer.nodeira.ui.graph

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.deranjer.nodeira.ui.nav.AppDestination
import com.deranjer.nodeira.ui.nav.AppScaffold
import kotlin.math.min
import kotlin.math.sqrt
import kotlin.random.Random

@Composable
fun GraphScreen(
    viewModel: GraphViewModel,
    onOpenNote: (String) -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    AppScaffold(
        title = "Graph",
        currentRoute = AppDestination.GRAPH.route,
        onNavigate = onNavigate,
        onLogout = onLogout,
    ) {
        when {
            state.loading -> CircularProgressIndicator(Modifier.padding(24.dp))
            state.error != null ->
                Text(state.error!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(24.dp))
            state.nodes.isEmpty() ->
                Text("No notes to graph", modifier = Modifier.padding(24.dp))
            else -> ForceGraph(state, onOpenNote)
        }
    }
}

private const val NODE_RADIUS = 26f

@Composable
private fun ForceGraph(state: GraphUiState, onOpenNote: (String) -> Unit) {
    val nodes = state.nodes
    val edges = state.edges
    val nodeColor = MaterialTheme.colorScheme.primary
    val edgeColor = MaterialTheme.colorScheme.outlineVariant
    val labelColor = MaterialTheme.colorScheme.onSurface

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val w = constraints.maxWidth.toFloat().coerceAtLeast(1f)
        val h = constraints.maxHeight.toFloat().coerceAtLeast(1f)

        val indexOf = remember(nodes) { nodes.withIndex().associate { (i, n) -> n.id to i } }

        // Node positions, seeded in a ring around the centre.
        val positions = remember(nodes) {
            mutableStateListOf<Offset>().apply {
                val rnd = Random(nodes.size)
                val radius = min(w, h) / 3f
                nodes.forEachIndexed { i, _ ->
                    val angle = (2.0 * Math.PI * i / nodes.size).toFloat()
                    add(
                        Offset(
                            w / 2 + radius * kotlin.math.cos(angle) + rnd.nextFloat() * 4,
                            h / 2 + radius * kotlin.math.sin(angle) + rnd.nextFloat() * 4,
                        ),
                    )
                }
            }
        }

        var pan by remember(nodes) { mutableStateOf(Offset.Zero) }

        // Force-directed layout (Fruchterman–Reingold), cooled over a fixed number of frames.
        androidx.compose.runtime.LaunchedEffect(nodes, w, h) {
            simulate(positions, edges, indexOf, w, h)
        }

        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(nodes) {
                    detectDragGestures { _, drag -> pan += drag }
                }
                .pointerInput(nodes) {
                    detectTapGestures { tap ->
                        val tf = fitTransform(positions, size.width.toFloat(), size.height.toFloat(), pan)
                        val hit = positions.indices.minByOrNull { (tf(positions[it]) - tap).getDistance() }
                        if (hit != null && (tf(positions[hit]) - tap).getDistance() <= NODE_RADIUS + 16f) {
                            onOpenNote(nodes[hit].id)
                        }
                    }
                },
        ) {
            // Fit the laid-out graph into the viewport (with padding) so it's always visible,
            // regardless of the simulation's absolute scale.
            val tf = fitTransform(positions, size.width, size.height, pan)
            edges.forEach { e ->
                val a = indexOf[e.from]
                val b = indexOf[e.to]
                if (a != null && b != null) {
                    drawLine(color = edgeColor, start = tf(positions[a]), end = tf(positions[b]), strokeWidth = 2f)
                }
            }
            nodes.forEachIndexed { i, node ->
                val c = tf(positions[i])
                drawCircle(color = nodeColor, radius = NODE_RADIUS, center = c)
                drawLabel(node.label, c, labelColor)
            }
        }
    }
}

/** Builds a transform mapping laid-out positions into the viewport with padding + [pan]. */
private fun fitTransform(
    positions: List<Offset>,
    vw: Float,
    vh: Float,
    pan: Offset,
): (Offset) -> Offset {
    if (positions.isEmpty()) return { it + pan }
    var minX = Float.MAX_VALUE; var minY = Float.MAX_VALUE
    var maxX = -Float.MAX_VALUE; var maxY = -Float.MAX_VALUE
    positions.forEach {
        if (it.x < minX) minX = it.x
        if (it.y < minY) minY = it.y
        if (it.x > maxX) maxX = it.x
        if (it.y > maxY) maxY = it.y
    }
    val pad = 160f
    val gw = (maxX - minX).coerceAtLeast(1f)
    val gh = (maxY - minY).coerceAtLeast(1f)
    val scale = min((vw - 2 * pad) / gw, (vh - 2 * pad) / gh).coerceIn(0.05f, 1.3f)
    val gcx = (minX + maxX) / 2f
    val gcy = (minY + maxY) / 2f
    return { p ->
        Offset((p.x - gcx) * scale + vw / 2f, (p.y - gcy) * scale + vh / 2f) + pan
    }
}

private fun DrawScope.drawLabel(text: String, center: Offset, color: Color) {
    val label = if (text.length > 18) text.take(17) + "…" else text
    drawContext.canvas.nativeCanvas.apply {
        val paint = android.graphics.Paint().apply {
            this.color = color.toArgb()
            textSize = 30f
            textAlign = android.graphics.Paint.Align.CENTER
            isAntiAlias = true
        }
        drawText(label, center.x, center.y + NODE_RADIUS + 34f, paint)
    }
}

/** Runs the layout for a bounded number of frames, cooling the step size each frame. */
private suspend fun simulate(
    positions: SnapshotStateList<Offset>,
    edges: List<GraphEdge>,
    indexOf: Map<String, Int>,
    w: Float,
    h: Float,
) {
    val n = positions.size
    if (n <= 1) return
    val k = (sqrt(w * h / n) * 0.45f).coerceAtLeast(40f)
    var temp = w * 0.10f
    val center = Offset(w / 2, h / 2)

    repeat(420) {
        val disp = Array(n) { Offset.Zero }

        // repulsion (all pairs)
        for (i in 0 until n) {
            for (j in i + 1 until n) {
                val delta = positions[i] - positions[j]
                val dist = delta.getDistance().coerceAtLeast(0.5f)
                val force = k * k / dist
                val dir = delta / dist
                disp[i] += dir * force
                disp[j] -= dir * force
            }
        }
        // attraction (edges)
        for (e in edges) {
            val a = indexOf[e.from] ?: continue
            val b = indexOf[e.to] ?: continue
            val delta = positions[a] - positions[b]
            val dist = delta.getDistance().coerceAtLeast(0.5f)
            val force = dist * dist / k
            val dir = delta / dist
            disp[a] -= dir * force
            disp[b] += dir * force
        }
        // pull to centre keeps disconnected nodes on-screen (stronger so sparse graphs
        // don't fling apart to the clamped edges)
        for (i in 0 until n) {
            disp[i] += (center - positions[i]) * 0.06f
        }
        // apply, capped by temperature; clamp into bounds
        for (i in 0 until n) {
            val d = disp[i]
            val dl = d.getDistance().coerceAtLeast(0.01f)
            val next = positions[i] + d / dl * min(dl, temp)
            positions[i] = Offset(
                next.x.coerceIn(NODE_RADIUS, w - NODE_RADIUS),
                next.y.coerceIn(NODE_RADIUS, h - NODE_RADIUS),
            )
        }
        temp = (temp * 0.97f).coerceAtLeast(2f)
        androidx.compose.runtime.withFrameNanos { }
    }
}
