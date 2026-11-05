import { BaseEdge, Background, Handle, MarkerType, Position, ReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import type { Dataset } from '../model/types';
import { siteColor } from '../ui/palette';

// Static layout of the B → A network (R10). Sizes in px.
const MACHINE_W = 168;
const MACHINE_H = 52;
const STORE_W = 184;
const ROW = 74;
const PAD = 20;
const HEADER = 48;
const SITE_GAP = 220;

type SiteData = { label: string; subtitle: string; siteId: string };
type MachineData = { label: string; colors: string[] };
type StoreData = { label: string; capacity: number; accepts: string };
type SinkData = { label: string };

function SiteNode({ data }: NodeProps<Node<SiteData>>) {
  const color = siteColor(data.siteId);
  return (
    <div
      className="h-full w-full rounded-2xl border"
      style={{ borderColor: `color-mix(in srgb, ${color} 35%, transparent)`, background: `color-mix(in srgb, ${color} 6%, transparent)` }}
    >
      <div className="flex items-baseline gap-2 px-4 pt-3">
        <span className="text-sm font-semibold" style={{ color }}>
          {data.label}
        </span>
        <span className="text-xs text-muted">{data.subtitle}</span>
      </div>
    </div>
  );
}

function MachineNode({ data }: NodeProps<Node<MachineData>>) {
  return (
    <div className="flex h-full items-center justify-between rounded-lg border border-line bg-surface px-3 shadow-sm">
      <span className="text-[13px] font-medium">{data.label}</span>
      <span className="flex gap-1">
        {data.colors.map((c, i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
        ))}
      </span>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

function StoreNode({ data }: NodeProps<Node<StoreData>>) {
  return (
    <div className="h-full rounded-lg border border-dashed border-line bg-surface-2 px-3 py-2">
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div className="text-[13px] font-medium">{data.label}</div>
      <div className="tabular text-xs text-muted">
        {data.capacity} pallets · {data.accepts}
      </div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      <Handle id="bottom-in" type="target" position={Position.Bottom} className="!opacity-0" />
      <Handle id="bottom-out" type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

type UnderData = { y: number };

/** A lane running right to left: down from its store, along `y` (below the machines), up into the target store. */
function UnderEdge({ sourceX, sourceY, targetX, targetY, data, ...props }: EdgeProps<Edge<UnderData>>) {
  const y = data!.y;
  const r = 8;
  const path = [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceX} ${y - r}`,
    `Q ${sourceX} ${y} ${sourceX - r} ${y}`,
    `L ${targetX + r} ${y}`,
    `Q ${targetX} ${y} ${targetX} ${y - r}`,
    `L ${targetX} ${targetY}`,
  ].join(' ');
  return <BaseEdge {...props} path={path} labelX={(sourceX + targetX) / 2} labelY={y} />;
}

const edgeTypes = { under: UnderEdge };

function SinkNode({ data }: NodeProps<Node<SinkData>>) {
  return (
    <div className="flex h-full items-center justify-center rounded-full bg-ink px-4 text-center text-[13px] font-medium text-bg">
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      {data.label}
    </div>
  );
}

const nodeTypes = { site: SiteNode, machine: MachineNode, store: StoreNode, sink: SinkNode };
/** Free strip at the bottom of each site box, for lanes running right to left. */
const UNDER = 36;

export function buildGraph(ds: Dataset, productColors: Map<string, string>): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const siteW = PAD + MACHINE_W + 64 + STORE_W + PAD;
  const machinesOf = (siteId: string) => ds.machines.filter((m) => m.siteId === siteId);
  const tallest = Math.max(...ds.sites.map((s) => machinesOf(s.id).length));
  // Leave one extra row at the top of the demand site for the inbound warehouse.
  const siteH = HEADER + (tallest + 1) * ROW + PAD + UNDER;
  const siteIndex = new Map(ds.sites.map((s, i) => [s.id, i]));

  ds.sites.forEach((site, i) => {
    const x = i * (siteW + SITE_GAP);
    const machines = machinesOf(site.id);
    nodes.push({
      id: `site-${site.id}`,
      type: 'site',
      position: { x, y: 0 },
      data: { label: site.name, subtitle: site.isDemandSite ? 'production + demand' : 'production', siteId: site.id },
      style: { width: siteW, height: siteH },
      draggable: false,
      selectable: false,
    });
    const top = HEADER + (site.isDemandSite ? ROW : 0) + (site.isDemandSite ? 0 : ROW / 2);
    machines.forEach((m, j) => {
      const colors = ds.capabilities.filter((c) => c.machineId === m.id).map((c) => productColors.get(c.productId)!);
      nodes.push({
        id: `machine-${m.id}`,
        type: 'machine',
        parentId: `site-${site.id}`,
        extent: 'parent',
        position: { x: PAD, y: top + j * ROW },
        data: { label: m.name, colors },
        style: { width: MACHINE_W, height: MACHINE_H },
      });
    });
    const stores = ds.storageLocations.filter((l) => l.siteId === site.id);
    for (const store of stores) {
      const inbound = store.accepts === 'inbound';
      const y = inbound ? HEADER - 8 : top + ((machines.length - 1) * ROW) / 2 - 4;
      nodes.push({
        id: `store-${store.id}`,
        type: 'store',
        parentId: `site-${site.id}`,
        extent: 'parent',
        // Inbound storage sits top-left, where trucks arrive; local storage to the right of the machines.
        position: { x: inbound ? PAD : siteW - PAD - STORE_W, y },
        data: { label: store.name, capacity: store.capacityPallets, accepts: inbound ? 'from trucks' : 'local output' },
        style: { width: STORE_W, height: 60 },
      });
      if (!inbound) {
        for (const m of machines) {
          // An inline stroke, like the other edges: the PNG export (html-to-image) drops edges styled
          // only by React Flow's stylesheet.
          edges.push({ id: `e-${m.id}-${store.id}`, source: `machine-${m.id}`, target: `store-${store.id}`, type: 'smoothstep', style: { stroke: 'var(--edge)', strokeWidth: 1 } });
        }
      }
    }
  });

  for (const lane of ds.truckLanes) {
    // Trucked goods arrive in the inbound store, or the local one if the site has none (pre-SFGs at B).
    const toDemand = ds.sites.find((s) => s.id === lane.toSiteId)?.isDemandSite;
    const from = ds.storageLocations.find((l) => l.siteId === lane.fromSiteId && l.accepts === 'local');
    const to =
      ds.storageLocations.find((l) => l.siteId === lane.toSiteId && l.accepts === 'inbound') ??
      ds.storageLocations.find((l) => l.siteId === lane.toSiteId && l.accepts === 'local');
    if (from && to) {
      // Lanes against the layout's direction run under the machines instead of across them.
      const under = siteIndex.get(lane.fromSiteId)! > siteIndex.get(lane.toSiteId)!;
      edges.push({
        id: `e-truck-${lane.id}`,
        source: `store-${from.id}`,
        target: `store-${to.id}`,
        animated: true,
        zIndex: 10,
        ...(under ? { type: 'under', sourceHandle: 'bottom-out', targetHandle: 'bottom-in', data: { y: siteH - UNDER / 2 - 4 } } : !toDemand && { type: 'smoothstep' }),
        label: `🚚 ${toDemand ? '' : 'pre-SFGs '}≤ ${lane.maxTrucksPerWeek} trucks/wk × ${lane.palletsPerTruck} pallets`,
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 6,
        labelStyle: { fontSize: 12, fontWeight: 600, fill: 'var(--text)' },
        labelBgStyle: { fill: 'var(--surface)', stroke: 'var(--border)' },
        style: { stroke: 'var(--accent)', strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' },
      });
    }
  }

  const demand = ds.sites.find((s) => s.isDemandSite);
  if (demand) {
    const siteNode = nodes.find((n) => n.id === `site-${demand.id}`)!;
    nodes.push({
      id: 'sink',
      type: 'sink',
      position: { x: siteNode.position.x + siteW + 60, y: siteH / 2 - 30 },
      data: { label: 'Next process step' },
      style: { width: 150, height: 60 },
    });
    for (const store of ds.storageLocations.filter((l) => l.siteId === demand.id)) {
      edges.push({
        id: `e-${store.id}-sink`,
        source: `store-${store.id}`,
        target: 'sink',
        type: 'smoothstep',
        style: { stroke: siteColor(demand.id), strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: siteColor(demand.id) },
      });
    }
  }

  return { nodes, edges };
}

export function SiteMap({ dataset, productColors }: { dataset: Dataset; productColors: Map<string, string> }) {
  const { nodes, edges } = useMemo(() => buildGraph(dataset, productColors), [dataset, productColors]);
  // The box takes the graph's aspect ratio, so fitView fills it whatever the number of machines.
  const aspect = useMemo(() => {
    const right = Math.max(...nodes.filter((n) => !n.parentId).map((n) => n.position.x + Number(n.style?.width ?? 0)));
    const bottom = Math.max(...nodes.filter((n) => !n.parentId).map((n) => n.position.y + Number(n.style?.height ?? 0)));
    return `${right} / ${bottom}`;
  }, [nodes]);
  return (
    <div className="max-h-[480px] min-h-[220px] w-full" style={{ aspectRatio: aspect }} data-testid="site-map">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="system"
        fitView
        minZoom={0.1}
        fitViewOptions={{ padding: 0.03 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="var(--border)" />
      </ReactFlow>
    </div>
  );
}
