import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { DashboardView } from './views/DashboardView'
import { AskWhyThenView } from './views/AskWhyThenView'
import { DecisionTimelineView } from './views/DecisionTimelineView'
import { KnowledgeSourcesView } from './views/KnowledgeSourcesView'
import { SettingsView } from './views/SettingsView'

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardView />} />
          <Route path="ask" element={<AskWhyThenView />} />
          <Route path="timeline" element={<DecisionTimelineView />} />
          <Route path="sources" element={<KnowledgeSourcesView />} />
          <Route path="settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
