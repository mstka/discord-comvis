import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '../api/client'
import { useGraphStore } from '../store/graphStore'

interface SimNode extends GraphNode, d3.SimulationNodeDatum {
  x?: number; y?: number
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  value: number
  edge_type: string
  id: number
}

const EDGE_COLORS: Record<string, string> = {
  main: '#5865F2',
  sub: '#0891b2',
  distributed: '#059669',
  thanks: '#d97706',
  phase25: '#059669',
  fast: '#5865F2',
  slow: '#a78bfa',
  gemini: '#f472b6',
  confirmed: '#5865F2',
}

function nodeRadius(d: SimNode): number {
  return 5 + Math.sqrt(d.contribution_score) * 15
}

export default function GraphCanvas({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { selectedNodeId, setSelectedNode, filters } = useGraphStore()

  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const rect = svgRef.current!.getBoundingClientRect()
    const width = rect.width || 800
    const height = rect.height || 600

    // Filter edges
    const filteredEdges = edges.filter(
      (e) =>
        e.value >= filters.minWeight &&
        filters.edgeTypes.some((t) => e.edge_type.startsWith(t) || e.route === t)
    )

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }))
    const nodeById = new Map(simNodes.map((n) => [n.id, n]))

    const simLinks: SimLink[] = filteredEdges
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        value: e.value,
        edge_type: e.edge_type,
        id: e.id,
      }))

    // Arrowhead markers
    const defs = svg.append('defs')
    Object.entries(EDGE_COLORS).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 18).attr('refY', 0)
        .attr('markerWidth', 6).attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color)
    })

    // Zoom group
    const g = svg.append('g')
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => g.attr('transform', event.transform))
    )

    // Simulation
    const simulation = d3.forceSimulation<SimNode>(simNodes)
      .force('link', d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(160).strength((d) => d.value * 0.3))
      .force('charge', d3.forceManyBody<SimNode>().strength(-600).distanceMax(500))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 20).strength(0.9))
      .velocityDecay(0.4)

    // Edges
    const link = g.append('g').selectAll<SVGPathElement, SimLink>('path')
      .data(simLinks)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', (d) => EDGE_COLORS[d.edge_type] ?? '#6b7280')
      .attr('stroke-width', (d) => Math.max(0.5, d.value * 2))
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', (d) => `url(#arrow-${d.edge_type})`)

    // Nodes
    const node = g.append('g').selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null })
      )
      .on('click', (_event, d) => setSelectedNode(d.id === selectedNodeId ? null : d.id))

    node.append('circle')
      .attr('r', (d) => nodeRadius(d))
      .attr('fill', (d) => {
        if (filters.highlightHubs && d.centrality > 0.3) return '#FEE75C'
        return d.id === selectedNodeId ? '#EB459E' : '#5865F2'
      })
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1.5)

    node.append('text')
      .attr('dy', (d) => nodeRadius(d) + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#d1d5db')
      .attr('font-size', 10)
      .text((d) => d.display_name || d.username)

    // Tick
    simulation.on('tick', () => {
      link.attr('d', (d) => {
        const s = d.source as SimNode
        const t = d.target as SimNode
        if (!s.x || !t.x) return ''
        const dx = t.x - s.x, dy = t.y! - s.y!
        const dr = Math.sqrt(dx * dx + dy * dy)
        return `M${s.x},${s.y}A${dr},${dr} 0 0,1 ${t.x},${t.y}`
      })
      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { simulation.stop() }
  }, [nodes, edges, filters, selectedNodeId, setSelectedNode])

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ background: '#030712' }}
    />
  )
}
