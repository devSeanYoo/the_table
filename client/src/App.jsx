import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import CountrySelect from './pages/CountrySelect.jsx';
import PersonalPage from './pages/PersonalPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/play" element={<CountrySelect />} />
      <Route path="/play/:code" element={<PersonalPage />} />
    </Routes>
  );
}
