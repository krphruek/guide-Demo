/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AuditDashboard from './components/AuditDashboard';
import GuidelineManager from './components/GuidelineManager';
import TokenDashboard from './components/TokenDashboard';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<AuditDashboard />} />
          <Route path="/guidelines" element={<GuidelineManager />} />
          <Route path="/tokens" element={<TokenDashboard />} />
        </Routes>
      </Layout>
    </Router>
  );
}
