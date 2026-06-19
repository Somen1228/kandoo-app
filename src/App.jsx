import { Navigate, Route, Routes } from 'react-router-dom';
import Board from './pages/Board';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import "./App.css";

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Board /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
