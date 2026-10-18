// Knowledge graph (MGR-08): cytoscape on a dot-grid canvas, nodes coloured by type, the
// root-cause path glowing cyan, a detail panel and the Ask panel (citation chips focus nodes).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import cytoscape from 'cytoscape';
import { Network, Crosshair, MessageSquareText, Info, Maximize2 } from 'lucide-react';
import { useCase, useKg } from '../../hooks/useData';
import { Card, MicroLabel, Skeleton, EmptyState } from '../../components/ui';
import AskPanel from '../../components/manager/AskPanel';
import { DEFAULT_CASE_ID } from '../../lib/config';

const TYPE_COLOR = {
  system: '#E5E7EB',
  component: '#06B6D4',
  tag: '#3B82F6',
  failure_mode: '#EF4444',
  rule: '#8B5CF6',
  sop: '#10B981',
  incident: '#F59E0B',
  case: '#F472B6',
};
const TYPE_LABEL = {
  system: 'System',
  component: 'Component',
  tag: 'Tag',
  failure_mode: 'Failure mode',
  rule: 'Rule',
  sop: 'SOP section',
  incident: 'Incident',
  case: 'Case',
};

export default function KnowledgeGraph() {
  const { session } = useOutletContext();
  const caseId = session.caseId || DEFAULT_CASE_ID;
  const [params] = useSearchParams();
  const { data: c } = useCase(caseId, session);
  const { data: kg, loading, error } = useKg(session, caseId, c?.status);
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [selectedId, setSelectedId] = useState(params.get('focus'));
  const [hidden, setHidden] = useState(() => new Set());
  const [side, setSide] = useState('detail');

  const highlight = useMemo(() => kg?.highlight || [], [kg]);
  const nodeById = useMemo(() => new Map((kg?.nodes || []).map((n) => [n.id, n])), [kg]);

  useEffect(() => {
    if (!kg || !containerRef.current) return undefined;
    const hl = new Set(highlight);
    const hlEdges = new Set();
    for (let i = 0; i < highlight.length - 1; i++) {
      hlEdges.add(`${highlight[i]}|${highlight[i + 1]}`);
      hlEdges.add(`${highlight[i + 1]}|${highlight[i]}`);
    }
    const ids = new Set(kg.nodes.map((n) => n.id));
    const elements = [
      ...kg.nodes.map((n) => ({ data: { id: n.id, label: n.type === 'incident' || n.type === 'sop' || n.type === 'rule' ? n.id : n.label.length > 26 ? n.id : n.label, type: n.type, color: TYPE_COLOR[n.type] || '#9CA3AF' }, classes: hl.has(n.id) ? 'hl' : '' })),
      ...kg.edges
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e, i) => ({ data: { id: `e${i}`, source: e.source, target: e.target, type: e.type }, classes: hlEdges.has(`${e.source}|${e.target}`) ? 'hl' : '' })),
    ];
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      wheelSensitivity: 0.25,
      minZoom: 0.15,
      maxZoom: 3,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'background-opacity': 0.9,
            label: 'data(label)',
            color: '#D1D5DB',
            'font-size': 9,
            'font-family': 'Inter, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            width: 16,
            height: 16,
            'border-width': 1.5,
            'border-color': '#0B0E14',
            'text-outline-color': '#0B1220',
            'text-outline-width': 2,
          },
        },
        { selector: 'node[type = "component"]', style: { width: 22, height: 22, 'font-size': 10, shape: 'round-rectangle' } },
        { selector: 'node[type = "system"]', style: { width: 30, height: 30, shape: 'hexagon', 'font-weight': 700 } },
        { selector: 'node[type = "rule"]', style: { shape: 'diamond' } },
        { selector: 'node[type = "sop"]', style: { shape: 'round-tag' } },
        { selector: 'node[type = "failure_mode"]', style: { shape: 'triangle' } },
        {
          selector: 'edge',
          style: {
            width: 1,
            'line-color': '#2E3A50',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#2E3A50',
            'arrow-scale': 0.6,
            opacity: 0.8,
          },
        },
        {
          selector: 'node.hl',
          style: {
            'border-color': '#06B6D4',
            'border-width': 3,
            'underlay-color': '#06B6D4',
            'underlay-padding': 8,
            'underlay-opacity': 0.35,
            'underlay-shape': 'ellipse',
            color: '#A5F3FC',
            'font-weight': 700,
          },
        },
        { selector: 'edge.hl', style: { width: 3.5, 'line-color': '#06B6D4', 'target-arrow-color': '#06B6D4', opacity: 1, 'underlay-color': '#06B6D4', 'underlay-opacity': 0.25, 'underlay-padding': 4 } },
        { selector: 'node:selected', style: { 'border-color': '#FFFFFF', 'border-width': 3, 'underlay-color': '#FFFFFF', 'underlay-opacity': 0.2, 'underlay-padding': 10 } },
        { selector: '.faded', style: { opacity: 0.12 } },
        { selector: '.hidden-type', style: { display: 'none' } },
      ],
      layout: { name: 'cose', animate: false, nodeRepulsion: () => 9000, idealEdgeLength: () => 60, gravity: 0.35, numIter: 1200, randomize: true },
    });
    cy.on('tap', 'node', (evt) => setSelectedId(evt.target.id()));
    cy.on('tap', (evt) => {
      if (evt.target === cy) setSelectedId(null);
    });
    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [kg, highlight]);

  // focus and neighbourhood fade for the selected node
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass('faded').unselect();
    if (!selectedId) return;
    const node = cy.getElementById(selectedId);
    if (!node || node.empty()) return;
    const hood = node.closedNeighborhood();
    cy.elements().not(hood).not('.hl').addClass('faded');
    node.select();
    cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 1.1) }, { duration: 400 });
  }, [selectedId, kg]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().forEach((n) => (hidden.has(n.data('type')) ? n.addClass('hidden-type') : n.removeClass('hidden-type')));
  }, [hidden, kg]);

  const selected = selectedId ? nodeById.get(selectedId) : null;
  const neighbours = useMemo(() => {
    if (!selected || !kg) return [];
    const out = [];
    for (const e of kg.edges) {
      if (e.source === selected.id) out.push({ dir: 'out', type: e.type, node: nodeById.get(e.target) });
      else if (e.target === selected.id) out.push({ dir: 'in', type: e.type, node: nodeById.get(e.source) });
    }
    return out.filter((x) => x.node);
  }, [selected, kg, nodeById]);

  function focus(id) {
    if (nodeById.has(id)) {
      setSelectedId(id);
      setSide('detail');
    }
  }
  const fit = () => cyRef.current?.animate({ fit: { padding: 30 } }, { duration: 400 });
  const toggleType = (t) =>
    setHidden((h) => {
      const n = new Set(h);
      n.has(t) ? n.delete(t) : n.add(t);
      return n;
    });

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Knowledge graph</h1>
          <p className="text-xs text-gray-400 md:text-sm">
            {kg ? `${kg.nodes.length} nodes, ${kg.edges.length} edges.` : ''} Components, tags, failure modes, rules, SOP sections and synthetic past incidents.
          </p>
        </div>
        {highlight.length ? (
          <span className="pill pill-cyan">
            <Crosshair size={12} /> Root-cause path: {highlight.join(' > ')}
          </span>
        ) : (
          <span className="pill pill-gray">Root-cause path appears once evidence is judged</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(TYPE_LABEL).map(([t, label]) => (
          <button key={t} type="button" onClick={() => toggleType(t)} className={`pill ${hidden.has(t) ? 'pill-gray opacity-50' : 'pill-gray'} gap-1.5`} aria-pressed={!hidden.has(t)}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[t] }} /> {label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="relative overflow-hidden rounded-card border border-dark-700 xl:col-span-8">
          {loading && <Skeleton className="h-[640px] w-full" />}
          {error && !kg && <EmptyState title="Could not load the graph">{error.message}</EmptyState>}
          <div ref={containerRef} className="dot-grid h-[640px] w-full" aria-label="Knowledge graph canvas" />
          <button type="button" onClick={fit} className="btn-secondary absolute right-3 top-3 px-2.5 py-1.5 text-xs" aria-label="Fit graph">
            <Maximize2 size={14} /> Fit
          </button>
          {selected && (
            <div className="glass absolute bottom-3 left-3 max-w-xs rounded-card p-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[selected.type] }} />
                <span className="font-mono text-xs text-white">{selected.id}</span>
              </div>
              <div className="mt-0.5 text-xs text-gray-300">{selected.label}</div>
            </div>
          )}
        </div>
        <div className="space-y-3 xl:col-span-4">
          <div className="flex gap-1 rounded-card border border-dark-700 bg-dark-800 p-1">
            {[
              ['detail', 'Node detail', Info],
              ['ask', 'Ask LubeGuard', MessageSquareText],
            ].map(([k, label, Icon]) => (
              <button key={k} type="button" onClick={() => setSide(k)} className={`flex flex-1 items-center justify-center gap-2 rounded-control px-3 py-2 text-sm font-semibold ${side === k ? 'bg-dark-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                <Icon size={15} className={k === 'ask' ? 'text-accent-purple' : 'text-accent-cyan'} /> {label}
              </button>
            ))}
          </div>
          {side === 'ask' ? (
            <Card bodyClass="p-3">
              <AskPanel session={session} caseId={caseId} onCite={focus} heightClass="h-[560px]" />
            </Card>
          ) : (
            <Card title={selected ? selected.id : 'Select a node'} icon={Network} className="glass-card" bodyClass="max-h-[600px] overflow-y-auto p-4">
              {!selected ? (
                <p className="text-sm text-gray-400">Click a node to see its tags, failure modes, SOP sections and incidents. Citation chips in Ask answers focus the node here.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <span className="pill pill-gray gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[selected.type] }} /> {TYPE_LABEL[selected.type]}
                    </span>
                    {highlight.includes(selected.id) && <span className="pill pill-cyan ml-1.5">On root-cause path</span>}
                    <div className="mt-2 text-base font-semibold text-white">{selected.label}</div>
                  </div>
                  {selected.props && Object.keys(selected.props).length > 0 && (
                    <dl className="space-y-1.5 text-xs">
                      {Object.entries(selected.props).map(([k, v]) => (
                        <div key={k} className="grid grid-cols-3 gap-2">
                          <dt className="text-gray-500">{k}</dt>
                          <dd className="col-span-2 text-gray-200">{typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div>
                    <MicroLabel className="mb-2">Connections ({neighbours.length})</MicroLabel>
                    <ul className="space-y-1">
                      {neighbours.map((n, i) => (
                        <li key={i}>
                          <button type="button" onClick={() => focus(n.node.id)} className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs hover:bg-dark-700">
                            <span className="w-28 shrink-0 font-mono text-[10px] text-gray-500">
                              {n.dir === 'out' ? '' : '<- '}
                              {n.type}
                            </span>
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLOR[n.node.type] }} />
                            <span className="truncate text-gray-200">{n.node.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
