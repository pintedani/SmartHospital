import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import './i18n';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import HospitalListPage from './pages/HospitalListPage';
import HospitalDetailPage from './pages/HospitalDetailPage';
import FeedbackFormPage from './pages/FeedbackFormPage';
import DashboardPage from './pages/DashboardPage';
import MapPage from './pages/MapPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import SymptomCheckerPage from './pages/SymptomCheckerPage';
import ReservationPage from './pages/ReservationPage';
import ReservationStatusPage from './pages/ReservationStatusPage';
import ReservationManagePage from './pages/ReservationManagePage';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<HospitalListPage />} />
              <Route path="/hospital/:id" element={<HospitalDetailPage />} />
              <Route path="/feedback/:hospitalId" element={<FeedbackFormPage />} />
              <Route path="/reservation/:hospitalId" element={<ReservationPage />} />
              <Route path="/reservation-status" element={<ReservationStatusPage />} />
              <Route path="/reservations" element={<ReservationManagePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/symptoms" element={<SymptomCheckerPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
