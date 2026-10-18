// Original interactive SVG of the LO-01 lube-oil console (docs/NICHE_DECISION.md 3.1):
// reservoir, AC main and standby pumps, DC emergency pump, duplex filter, duplex cooler,
// PCV-101, header and bearings. Components are coloured by status (with an icon badge),
// live tag chips show the last reading, and the root-cause path glows with an animated flow.
import { COMPONENTS, STATUS_COLOR, TAG_INFO, componentStatus } from '../../lib/plant';
import { lastValue } from '../../lib/format';

const NEUTRAL = '#3D4A63';
const PIPE = '#2E3A50';
const CYAN = '#06B6D4';

function Badge({ x, y, status }) {
  if (!status || status === 'isolated') return null;
  const c = STATUS_COLOR[status];
  return (
    <g transform={`translate(${x},${y})`} aria-hidden>
      <circle r="8" fill="#0B0E14" stroke={c} strokeWidth="1.5" />
      {status === 'G' && <path d="M-3.5 0 L-1 2.8 L3.8 -2.6" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {status === 'NG' && <path d="M-3 -3 L3 3 M3 -3 L-3 3" stroke={c} strokeWidth="2" strokeLinecap="round" />}
      {status === 'UNVERIFIED' && (
        <text y="3.6" textAnchor="middle" fontSize="10" fontWeight="800" fill={c} fontFamily="Inter, sans-serif">
          ?
        </text>
      )}
    </g>
  );
}

function Part({ id, status, selected, onSelect, children, label }) {
  const clickable = Boolean(onSelect);
  return (
    <g
      className={clickable ? 'cursor-pointer outline-none [&:hover>*:first-child]:brightness-125' : ''}
      onClick={clickable ? () => onSelect(id) : undefined}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onSelect(id) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${id} ${label || COMPONENTS[id]?.name || ''}${status ? `, status ${status}` : ''}` : undefined}
      style={{ filter: selected ? 'drop-shadow(0 0 6px rgba(6,182,212,0.8))' : undefined }}
    >
      {children}
    </g>
  );
}

function TagChip({ x, y, tag, value, anomalous, compact }) {
  const info = TAG_INFO[tag] || { unit: '', digits: 2 };
  const v = value == null ? '-' : Number(value).toFixed(info.digits);
  const color = anomalous ? '#FBBF24' : '#22D3EE';
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width={compact ? 84 : 104} height="30" rx="6" fill="#0B0E14" fillOpacity="0.92" stroke={anomalous ? '#B45309' : '#232D3F'} />
      <text x="8" y="12" fontSize="8.5" fill="#9CA3AF" fontFamily="JetBrains Mono, monospace" letterSpacing="0.5">
        {tag}
        {anomalous ? ' !' : ''}
      </text>
      <text x="8" y="25" fontSize="12" fontWeight="700" fill={color} fontFamily="JetBrains Mono, monospace">
        {v}
        <tspan fontSize="8.5" fill="#9CA3AF" fontWeight="400">{` ${info.unit}`}</tspan>
      </text>
    </g>
  );
}

export default function SkidDiagram({ caseData, onSelect, selected, compact = false, className = '' }) {
  const st = componentStatus(caseData);
  const series = caseData?.readings?.series || {};
  const anomalous = new Set((caseData?.detection?.tags || []).filter((t) => t.anomalous).map((t) => t.tag));
  const path = caseData?.diagnosis?.rootCause?.path || [];
  const showPath = path.length > 0 && caseData?.status !== 'verified';
  const verified = caseData?.status === 'verified';
  const fillFor = (id) => (st[id] && st[id] !== 'isolated' ? `${STATUS_COLOR[st[id]]}22` : '#151A23');
  const strokeFor = (id) => (st[id] ? STATUS_COLOR[st[id]] : NEUTRAL);
  const lt = lastValue(series, 'LT-101') ?? 70;
  const levelH = Math.max(10, Math.min(100, lt)) * 1.0;
  const filterB = caseData?.decision?.approvedActionIds?.includes('A1') || verified;
  const sel = (id) => selected === id;

  return (
    <svg viewBox="0 0 840 440" className={`h-auto w-full select-none ${className}`} role="img" aria-label="Lube-oil console LO-01 schematic">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="oil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={st.OIL === 'NG' ? '#D6C59A' : '#B7791F'} stopOpacity="0.55" />
          <stop offset="1" stopColor={st.OIL === 'NG' ? '#A68F5B' : '#7C4A0E'} stopOpacity="0.55" />
        </linearGradient>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={PIPE} />
        </marker>
        <marker id="arrowCyan" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={CYAN} />
        </marker>
      </defs>

      {/* ---------- piping ---------- */}
      <g stroke={PIPE} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* suction lines */}
        <path d="M70 300 V250 M130 300 V250 M190 300 V250" />
        {/* AC pump discharge manifold to filter */}
        <path d="M70 210 V130 H260 M130 210 V130" markerEnd="url(#arrow)" />
        {/* filter to cooler to PCV to header */}
        <path d="M334 130 H390 M480 130 H515 M545 130 H560" />
        {/* header feeds to bearings */}
        <path d="M615 138 V215 M695 138 V215 M777 138 V215" />
      </g>
      {/* DC emergency pump bypass to header */}
      <path d="M190 210 V34 H640 V122" stroke="#4C3B7A" strokeWidth="3" fill="none" strokeDasharray="6 5" markerEnd="url(#arrow)" />
      {!compact && (
        <text x="250" y="27" fontSize="10" fill="#8B7FD1" fontFamily="Inter, sans-serif">
          P-105 DC bypass to header
        </text>
      )}
      {/* drain back to reservoir */}
      <path d="M615 259 V385 M695 259 V385 M777 259 V385 H230" stroke="#232D3F" strokeWidth="3" fill="none" strokeDasharray="4 5" markerEnd="url(#arrow)" />
      {!compact && (
        <text x="420" y="401" fontSize="10" fill="#56627A" fontFamily="Inter, sans-serif">
          bearing drain to reservoir
        </text>
      )}

      {/* ---------- root-cause flow ---------- */}
      {showPath && (
        <g filter="url(#glow)">
          <path d="M260 130 H560 H615 V215" stroke={CYAN} strokeWidth="4" fill="none" className="flow-path" strokeLinecap="round" />
          {path.includes('E-101A') && (
            <>
              <path d="M410 168 C 410 250, 320 300, 205 338" stroke={CYAN} strokeWidth="2.5" fill="none" strokeDasharray="5 5" className="flow-path" markerEnd="url(#arrowCyan)" />
              <text x="322" y="262" fontSize="11" fontWeight="700" fill={CYAN} fontFamily="Inter, sans-serif">
                water into oil
              </text>
            </>
          )}
        </g>
      )}

      {/* ---------- reservoir and oil ---------- */}
      <Part id="TK-01" status={st['TK-01']} selected={sel('TK-01')} onSelect={onSelect}>
        <rect x="30" y="300" width="200" height="110" rx="10" fill="#151A23" stroke={strokeFor('TK-01')} strokeWidth="2" />
        <text x="44" y="322" fontSize="12" fontWeight="700" fill="#E5E7EB" fontFamily="JetBrains Mono, monospace">
          TK-01
        </text>
        {!compact && (
          <text x="44" y="336" fontSize="10" fill="#9CA3AF" fontFamily="Inter, sans-serif">
            Reservoir
          </text>
        )}
        <Badge x={222} y={300} status={st['TK-01']} />
      </Part>
      <Part id="OIL" status={st.OIL} selected={sel('OIL')} onSelect={onSelect} label="Lube oil">
        <rect x="34" y={406 - levelH} width="192" height={levelH} rx="6" fill="url(#oil)" />
        <line x1="34" x2="226" y1={406 - levelH} y2={406 - levelH} stroke={strokeFor('OIL')} strokeWidth="2" strokeDasharray={st.OIL === 'UNVERIFIED' ? '4 3' : undefined} />
        {!compact && (
          <text x="44" y={406 - levelH + 18} fontSize="10" fill="#FDE68A" fontFamily="Inter, sans-serif">
            {st.OIL === 'NG' ? 'Oil: hazy, free water' : st.OIL === 'UNVERIFIED' ? 'Oil: unverified' : 'Oil'}
          </text>
        )}
        <Badge x={34} y={406 - levelH} status={st.OIL} />
      </Part>

      {/* ---------- pumps ---------- */}
      {[
        ['P-104A', 70, 'AC main'],
        ['P-104B', 130, 'AC standby'],
        ['P-105', 190, 'DC emerg.'],
      ].map(([id, cx, sub]) => (
        <Part key={id} id={id} status={st[id]} selected={sel(id)} onSelect={onSelect}>
          <circle cx={cx} cy="230" r="20" fill={fillFor(id)} stroke={strokeFor(id)} strokeWidth="2" />
          <path d={`M${cx - 8} ${238} L${cx} ${220} L${cx + 8} ${238}`} fill="none" stroke={strokeFor(id)} strokeWidth="2" />
          <text x={cx} y="268" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#E5E7EB" fontFamily="JetBrains Mono, monospace">
            {id}
          </text>
          {!compact && (
            <text x={cx} y="280" textAnchor="middle" fontSize="8.5" fill="#9CA3AF" fontFamily="Inter, sans-serif">
              {sub}
            </text>
          )}
          <Badge x={cx + 16} y={212} status={st[id]} />
        </Part>
      ))}

      {/* ---------- duplex filter ---------- */}
      <path d="M277 100 V92 H317 V100" stroke={PIPE} strokeWidth="3" fill="none" />
      {[
        ['F-101A', 260, !filterB],
        ['F-101B', 300, filterB],
      ].map(([id, x, active]) => (
        <Part key={id} id={id} status={st[id]} selected={sel(id)} onSelect={onSelect}>
          <rect x={x} y="100" width="34" height="60" rx="6" fill={fillFor(id)} stroke={strokeFor(id)} strokeWidth="2" strokeDasharray={st[id] === 'isolated' ? '4 3' : undefined} opacity={active ? 1 : 0.75} />
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={x + 6} x2={x + 28} y1={112 + i * 11} y2={112 + i * 11} stroke={strokeFor(id)} strokeOpacity="0.5" strokeWidth="1.5" />
          ))}
          <text x={x + 17} y="176" textAnchor="middle" fontSize="9" fontWeight="700" fill="#E5E7EB" fontFamily="JetBrains Mono, monospace">
            {id.slice(-1)}
          </text>
          <Badge x={x + 30} y={100} status={st[id]} />
        </Part>
      ))}
      {!compact && (
        <text x="297" y="192" textAnchor="middle" fontSize="10" fill="#9CA3AF" fontFamily="Inter, sans-serif">
          Filter F-101A/B
        </text>
      )}

      {/* ---------- duplex cooler ---------- */}
      {[
        ['E-101A', 390],
        ['E-101B', 440],
      ].map(([id, x]) => (
        <Part key={id} id={id} status={st[id]} selected={sel(id)} onSelect={onSelect}>
          <rect x={x} y="95" width="40" height="70" rx="8" fill={fillFor(id)} stroke={strokeFor(id)} strokeWidth="2" strokeDasharray={st[id] === 'isolated' ? '4 3' : undefined} />
          <path d={`M${x + 8} 105 V155 M${x + 16} 105 V155 M${x + 24} 105 V155 M${x + 32} 105 V155`} stroke={strokeFor(id)} strokeOpacity="0.45" strokeWidth="1.5" />
          <text x={x + 20} y="180" textAnchor="middle" fontSize="9" fontWeight="700" fill="#E5E7EB" fontFamily="JetBrains Mono, monospace">
            {id.slice(-1)}
          </text>
          <Badge x={x + 36} y={95} status={st[id]} />
        </Part>
      ))}
      <path d="M402 190 H470" stroke="#1D4ED8" strokeWidth="2" strokeDasharray="3 3" markerEnd="url(#arrow)" />
      {!compact && (
        <>
          <text x="435" y="206" textAnchor="middle" fontSize="10" fill="#9CA3AF" fontFamily="Inter, sans-serif">
            Cooler E-101A/B
          </text>
          <text x="476" y="193" fontSize="8.5" fill="#60A5FA" fontFamily="Inter, sans-serif">
            cooling water
          </text>
        </>
      )}

      {/* ---------- PCV-101 ---------- */}
      <Part id="PCV-101" status={st['PCV-101']} selected={sel('PCV-101')} onSelect={onSelect}>
        <path d="M515 120 L545 140 L545 120 L515 140 Z" fill={fillFor('PCV-101')} stroke={strokeFor('PCV-101')} strokeWidth="2" />
        <path d="M530 130 V110 M522 110 H538" stroke={strokeFor('PCV-101')} strokeWidth="2" />
        <text x="530" y="158" textAnchor="middle" fontSize="9" fontWeight="700" fill="#E5E7EB" fontFamily="JetBrains Mono, monospace">
          PCV-101
        </text>
      </Part>

      {/* ---------- header ---------- */}
      <Part id="HEADER" status={st.HEADER} selected={sel('HEADER')} onSelect={onSelect}>
        <rect x="560" y="122" width="260" height="16" rx="8" fill={fillFor('HEADER')} stroke={strokeFor('HEADER')} strokeWidth="2" />
        <text x="810" y="114" textAnchor="end" fontSize="10" fontWeight="700" fill="#E5E7EB" fontFamily="JetBrains Mono, monospace">
          HEADER
        </text>
        <Badge x={816} y={122} status={st.HEADER} />
      </Part>
      {!compact && (
        <g fontFamily="Inter, sans-serif" fontSize="9" fill="#9CA3AF">
          <text x="650" y="166">PSL-104 &lt; 1.2 barg: start P-104B</text>
          <text x="650" y="179">PSLL-104 &lt; 0.8 barg: P-105 + trip</text>
          <text x="650" y="192" fill="#6B7280">SITE SETPOINTS (synthetic)</text>
        </g>
      )}

      {/* ---------- bearings ---------- */}
      {[
        ['BRG-1', 585, 60, 'Journal 1'],
        ['BRG-2', 665, 60, 'Journal 2'],
        ['BRG-T', 745, 64, 'Thrust'],
      ].map(([id, x, w, sub]) => (
        <Part key={id} id={id} status={st[id]} selected={sel(id)} onSelect={onSelect}>
          <rect x={x} y="215" width={w} height="44" rx="8" fill={fillFor(id)} stroke={strokeFor(id)} strokeWidth="2" />
          <circle cx={x + w / 2} cy="237" r="9" fill="none" stroke={strokeFor(id)} strokeOpacity="0.6" strokeWidth="2" />
          <text x={x + w / 2} y="273" textAnchor="middle" fontSize="9" fontWeight="700" fill="#E5E7EB" fontFamily="JetBrains Mono, monospace">
            {id}
          </text>
          {!compact && (
            <text x={x + w / 2} y="285" textAnchor="middle" fontSize="8.5" fill="#9CA3AF" fontFamily="Inter, sans-serif">
              {sub}
            </text>
          )}
          <Badge x={x + w - 4} y={215} status={st[id]} />
        </Part>
      ))}

      {/* ---------- live tag chips ---------- */}
      <TagChip x={6} y={150} tag="IT-104A" value={lastValue(series, 'IT-104A')} anomalous={anomalous.has('IT-104A')} compact={compact} />
      <TagChip x={246} y={50} tag="PDT-101" value={lastValue(series, 'PDT-101')} anomalous={anomalous.has('PDT-101')} compact={compact} />
      <TagChip x={566} y={60} tag="PT-104" value={lastValue(series, 'PT-104')} anomalous={anomalous.has('PT-104')} compact={compact} />
      <TagChip x={compact ? 140 : 120} y={372} tag="LT-101" value={lastValue(series, 'LT-101')} anomalous={anomalous.has('LT-101')} compact={compact} />
      <TagChip x={524} y={300} tag="TE-201" value={lastValue(series, 'TE-201')} anomalous={anomalous.has('TE-201')} compact={compact} />
    </svg>
  );
}
