// Static view of the synthetic LO-01 lube-oil console (docs/NICHE_DECISION.md 3.1 to 3.3),
// mirrored from fixtures/kg.json for the skid diagram and its component drawer.
export const COMPONENTS = {
  'TK-01': { name: 'Reservoir', tags: ['LT-101'], failureModes: ['F4 External leak'] },
  OIL: { name: 'Lube oil (ISO VG 32 turbine oil)', tags: ['WATER-PPM'], failureModes: ['F2 Water ingress', 'F7 Oxidation and varnish', 'F11 Foaming or air entrainment'] },
  'P-104A': { name: 'Main AC lube-oil pump', tags: ['IT-104A', 'VT-104A', 'PT-106'], failureModes: ['F3 Pump wear or relief valve passing', 'F8 P-104A bearing degradation', 'F9 Motor overheating'] },
  'P-104B': { name: 'Standby AC lube-oil pump', tags: [], failureModes: ['F6 Standby pump failed to auto-start'], note: 'Starts on PSL-104 below 1.2 barg via K3 and KM-104B (SITE SETPOINT, synthetic)' },
  'P-105': { name: 'DC emergency lube-oil pump', tags: [], failureModes: ['F6 Standby pump failed to auto-start'], note: 'Starts on PSLL-104 below 0.8 barg via K5 and KM-105 from BAT-220V; turbine trips (SITE SETPOINT, synthetic)' },
  'F-101A': { name: 'Duplex filter side A', tags: ['PDT-101'], failureModes: ['F1 Filter clogging'] },
  'F-101B': { name: 'Duplex filter side B (standby)', tags: ['PDT-101'], failureModes: ['F1 Filter clogging'] },
  'E-101A': { name: 'Oil cooler A', tags: ['TT-102', 'TT-103', 'TT-104'], failureModes: ['F2 Water ingress', 'F5 Oil cooler fouling'] },
  'E-101B': { name: 'Oil cooler B (standby)', tags: ['TT-102'], failureModes: ['F5 Oil cooler fouling'] },
  'PCV-101': { name: 'Header pressure control valve', tags: [], failureModes: [] },
  HEADER: { name: 'Lube-oil header', tags: ['PT-104'], failureModes: ['F4 External leak'], note: 'PSL-104 and PSLL-104 sense header pressure' },
  'BRG-1': { name: 'Journal bearing 1', tags: ['TE-201'], failureModes: ['F12 Bearing wipe'] },
  'BRG-2': { name: 'Journal bearing 2', tags: ['TE-202'], failureModes: ['F12 Bearing wipe'] },
  'BRG-T': { name: 'Thrust bearing', tags: ['TE-203', 'TE-204', 'ZT-205'], failureModes: ['F12 Bearing wipe'] },
};

export const TAG_INFO = {
  'PT-104': { label: 'Header pressure', unit: 'barg', digits: 2 },
  'PDT-101': { label: 'Filter dP', unit: 'bar', digits: 2 },
  'LT-101': { label: 'Reservoir level', unit: '%', digits: 1 },
  'TE-201': { label: 'Bearing 1 temp', unit: 'degC', digits: 1 },
  'IT-104A': { label: 'P-104A current', unit: 'A', digits: 1 },
  'PT-106': { label: 'P-104A discharge', unit: 'barg', digits: 2 },
  'VT-104A': { label: 'P-104A vibration', unit: 'mm/s', digits: 2 },
  'TT-102': { label: 'Oil after cooler', unit: 'degC', digits: 1 },
};

const TAG_COMPONENT = { 'PT-104': 'HEADER', 'PDT-101': 'F-101A', 'LT-101': 'TK-01', 'TE-201': 'BRG-1', 'IT-104A': 'P-104A', 'VT-104A': 'P-104A', 'PT-106': 'P-104A', 'TT-102': 'E-101A' };

// Status per component: 'G' | 'NG' | 'UNVERIFIED' | 'isolated' | undefined (neutral)
export function componentStatus(c) {
  const s = {};
  if (!c) return s;
  if (c.status === 'verified') {
    Object.keys(COMPONENTS).forEach((k) => (s[k] = 'G'));
    s['E-101A'] = 'isolated';
    s['F-101A'] = 'isolated';
    return s;
  }
  for (const t of c.detection?.tags || []) {
    if (t.anomalous && TAG_COMPONENT[t.tag]) s[TAG_COMPONENT[t.tag]] = 'UNVERIFIED';
  }
  if (c.pressurePath?.mechanism === 'filter_loading') s['F-101A'] = 'NG';
  const m = c.diagnosis?.matrix;
  if (m) {
    s['P-104A'] = 'G';
    if (m.material?.verdict === 'NG') {
      s.OIL = 'NG';
      s['TK-01'] = 'NG';
    } else if (m.material?.verdict === 'UNVERIFIED') {
      s.OIL = 'UNVERIFIED';
    } else if (m.material?.verdict === 'G') s.OIL = 'G';
    if (m.environment?.verdict === 'NG') s['E-101A'] = 'NG';
    else if (m.environment?.verdict === 'UNVERIFIED') s['E-101A'] = 'UNVERIFIED';
    else s['E-101A'] = 'G';
  }
  if (c.autostart?.verdict === 'NG') {
    s['P-104B'] = 'UNVERIFIED';
    s['P-105'] = 'UNVERIFIED';
  }
  if (c.decision?.approvedActionIds?.includes('A1')) s['F-101B'] = 'G';
  return s;
}

export const STATUS_COLOR = {
  G: '#10B981',
  NG: '#EF4444',
  UNVERIFIED: '#F59E0B',
  isolated: '#56627A',
};
