import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Landing from './pages/Landing';
import ManagerShell from './components/manager/ManagerShell';
import IncidentRoom from './pages/manager/IncidentRoom';
import Overview from './pages/manager/Overview';
import Tickets from './pages/manager/Tickets';
import EngineerShell from './components/engineer/EngineerShell';
import Join from './pages/engineer/Join';
import MyTasks from './pages/engineer/MyTasks';
import TaskDetail from './pages/engineer/TaskDetail';
import Capture from './pages/engineer/Capture';
import Alerts from './pages/engineer/Alerts';
import { Spinner } from './components/ui';

const KnowledgeGraph = lazy(() => import('./pages/manager/KnowledgeGraph'));

function Loading() {
  return (
    <div className="flex h-64 items-center justify-center text-gray-400">
      <Spinner size={22} />
    </div>
  );
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#151A23', color: '#fff', border: '1px solid #232D3F', fontSize: '13px' },
          success: { style: { border: '1px solid #06B6D4' }, iconTheme: { primary: '#06B6D4', secondary: '#0B0E14' } },
          error: { style: { border: '1px solid #EF4444' } },
        }}
      />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/m" element={<ManagerShell />}>
          <Route index element={<Overview />} />
          <Route path="case/:caseId" element={<IncidentRoom />} />
          <Route path="tickets" element={<Tickets />} />
          <Route
            path="graph"
            element={
              <Suspense fallback={<Loading />}>
                <KnowledgeGraph />
              </Suspense>
            }
          />
        </Route>
        <Route path="/e/join" element={<Join />} />
        <Route path="/e" element={<EngineerShell />}>
          <Route index element={<Navigate to="tasks" replace />} />
          <Route path="tasks" element={<MyTasks />} />
          <Route path="task/:ticketId" element={<TaskDetail />} />
          <Route path="capture" element={<Capture />} />
          <Route path="alerts" element={<Alerts />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
