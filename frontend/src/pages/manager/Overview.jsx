// Manager Overview (MGR-01): KPI row, small skid diagram, case card, join code with QR.
import { Link, useOutletContext } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Siren, Ticket, BadgeCheck, DollarSign, ArrowRight, Workflow, Smartphone, LineChart } from 'lucide-react';
import { useCase, useTickets } from '../../hooks/useData';
import { KpiCard, Card, StatusPill, LiveDot, Skeleton, PriorityPill, TicketStatusPill, ProvenanceChip, MicroLabel } from '../../components/ui';
import SkidDiagram from '../../components/manager/SkidDiagram';
import SignalChart from '../../components/manager/SignalChart';
import { joinUrl } from '../../components/manager/ManagerShell';
import { fmtUsd, STATUS_LABEL, CATEGORY_LABEL, relTime } from '../../lib/format';
import { DEFAULT_CASE_ID } from '../../lib/config';

export default function Overview() {
  const { session } = useOutletContext();
  const caseId = session.caseId || DEFAULT_CASE_ID;
  const { data: c, loading } = useCase(caseId, session);
  const { data: tickets } = useTickets(session);
  const list = tickets || [];
  const openTickets = list.filter((t) => !['done', 'verified'].includes(t.status));
  const overdue = openTickets.filter((t) => Date.parse(t.dueAt) < Date.now()).length;
  const verified = c?.status === 'verified' ? 1 : 0;
  const openCases = c && c.status !== 'verified' ? 1 : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <LiveDot color="bg-green-500" />
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Overview</h1>
          <p className="text-xs text-gray-400 md:text-sm">Steam turbine ST-01, lube-oil console LO-01. Synthetic demo plant.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-4">
        <KpiCard label="Open cases" value={openCases} sub={c ? STATUS_LABEL[c.status] : ''} icon={Siren} tone="red" />
        <KpiCard label="Open tickets" value={openTickets.length} sub={`${overdue} overdue`} icon={Ticket} tone="cyan" />
        <KpiCard label="Verified fixes" value={verified} sub="Post-repair data back to baseline" icon={BadgeCheck} tone="green" />
        <KpiCard label="Current exposure" value={c?.impact ? fmtUsd(c.impact.exposureUsd) : '-'} sub="synthetic; formula in the Incident Room" icon={DollarSign} tone="purple" title={c?.impact?.formula} />
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <Card title="Lube-oil system" icon={Workflow} className="xl:col-span-2" bodyClass="p-2 dot-grid rounded-b-card">
          {loading ? <Skeleton className="h-72 w-full" /> : <SkidDiagram caseData={c} compact />}
        </Card>
        <div className="space-y-4">
          {c && (
            <Link to={`/m/case/${caseId}`} className="card block p-4 transition-colors hover:border-accent-cyan/50">
              <div className="flex items-center gap-2">
                <LiveDot color={c.status === 'verified' ? 'bg-green-500' : 'bg-red-500'} />
                <span className="font-mono text-xs text-gray-400">{c.id}</span>
                <span className="pill pill-amber">{STATUS_LABEL[c.status]}</span>
              </div>
              <div className="mt-2 text-lg font-bold">{c.title}</div>
              <div className="text-xs text-gray-400">{c.asset?.name}</div>
              {c.diagnosis?.matrix ? (
                <div className="mt-3 grid grid-cols-5 gap-1">
                  {Object.keys(CATEGORY_LABEL).map((k) => (
                    <div key={k} className="flex flex-col items-center gap-1 rounded-control bg-dark-900 p-1.5">
                      <span className="text-[9px] uppercase text-gray-500">{CATEGORY_LABEL[k].slice(0, 4)}</span>
                      <StatusPill iconOnly verdict={c.diagnosis.matrix[k]?.verdict} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-gray-500">Not investigated yet.</p>
              )}
              <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-cyan">
                Open Incident Room <ArrowRight size={14} />
              </div>
            </Link>
          )}
          <Card title="Engineer phone" icon={Smartphone}>
            <div className="flex items-center gap-4">
              <div className="rounded-control bg-white p-2">
                <QRCodeSVG value={joinUrl(session.code)} size={104} />
              </div>
              <div>
                <MicroLabel>Join code</MicroLabel>
                <div className="font-mono text-2xl font-bold tracking-[0.2em]">{session.code}</div>
                <p className="mt-1 text-xs text-gray-500">Scan to open the Engineer app in this sandbox.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <Card title="Header pressure trend" icon={LineChart} className="xl:col-span-1">
          {c ? <SignalChart readings={c.readings} height={200} compact /> : <Skeleton className="h-48" />}
        </Card>
        <Card title="Work orders" icon={Ticket} className="xl:col-span-2" bodyClass="p-0">
          {list.length === 0 ? (
            <p className="p-4 text-xs text-gray-500">No tickets yet. They appear here when evidence is requested or actions are approved.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-dark-900/50 text-left text-[10px] uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-4 py-2.5">Ticket</th>
                    <th className="px-4 py-2.5">Assignee</th>
                    <th className="px-4 py-2.5">Priority</th>
                    <th className="px-4 py-2.5">Due</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">By</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => (
                    <tr key={t.id} className="border-t border-dark-700 hover:bg-dark-700/30">
                      <td className="px-4 py-2.5">
                        <Link to={`/m/tickets?open=${t.id}`} className="hover:text-accent-cyan">
                          <span className="font-mono text-xs text-gray-500">{t.id}</span> {t.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-300">{t.assigneeName}</td>
                      <td className="px-4 py-2.5">
                        <PriorityPill priority={t.priority} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{relTime(t.dueAt)}</td>
                      <td className="px-4 py-2.5">
                        <TicketStatusPill status={t.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        <ProvenanceChip provenance={t.createdBy} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
