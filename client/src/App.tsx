import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SystemsListPage } from "./pages/SystemsListPage";
import { SystemFormPage } from "./pages/SystemFormPage";
import { SystemDetailPage } from "./pages/SystemDetailPage";
import { RiskAssessmentPage } from "./pages/RiskAssessmentPage";
import { AssessmentReportPage } from "./pages/AssessmentReportPage";
import { WorkPaperPage } from "./pages/WorkPaperPage";
import { CommitteeSummaryPage } from "./pages/CommitteeSummaryPage";
import { IntakeWizardPage } from "./pages/IntakeWizardPage";
import { AccountPage } from "./pages/AccountPage";
import { AdminPage } from "./pages/AdminPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { SystemExportPage } from "./pages/SystemExportPage";
import { BulkExportPage } from "./pages/BulkExportPage";
import { CalendarPage } from "./pages/CalendarPage";
import { PolicyRepositoryPage } from "./pages/PolicyRepositoryPage";

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/systems" element={<SystemsListPage />} />
                  <Route path="/systems/intake" element={<IntakeWizardPage />} />
                  <Route path="/systems/export-bulk" element={<BulkExportPage />} />
                  <Route path="/systems/:id" element={<SystemDetailPage />} />
                  <Route path="/systems/:id/edit" element={<SystemFormPage />} />
                  <Route path="/systems/:id/export" element={<SystemExportPage />} />
                  <Route path="/systems/:id/intake" element={<IntakeWizardPage />} />
                  <Route path="/systems/:systemId/assessments/:assessmentId" element={<RiskAssessmentPage />} />
                  <Route path="/systems/:systemId/assessments/:assessmentId/report" element={<AssessmentReportPage />} />
                  <Route path="/systems/:systemId/work-papers/:workPaperId" element={<WorkPaperPage />} />
                  <Route path="/systems/:systemId/committee-review" element={<CommitteeSummaryPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/policies" element={<PolicyRepositoryPage />} />
                  <Route path="/account" element={<AccountPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
