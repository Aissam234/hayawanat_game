import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LobbyPage from './pages/LobbyPage'
import GamePage from './pages/GamePage'
import { ToastContainer } from './components/ToastContainer'
import { useGameStore } from './store/gameStore'
import { useAuthStore } from './store/authStore'
import { authApi, ApiError } from './services/api'
import SoundControl from './components/shared/SoundControl'
import AuthModal from './components/auth/AuthModal'

export default function App() {
  const { token, setAuth, logout } = useAuthStore()

  const finishedRoundId = useGameStore(state => state.roundFinished?.id)
  useEffect(() => {
    let disposed = false
    const refresh = () => {
    if (token) {
      authApi.getMe().then(user => {
        if (!disposed) setAuth(token, user)
      }).catch(error => {
        if (!disposed && error instanceof ApiError && error.status === 401) logout()
      })
    }
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { disposed = true; window.removeEventListener('focus', refresh) }
  }, [token, finishedRoundId])

  return (
    <BrowserRouter>
      <ToastContainer />
      {token && <SoundControl />}
      {!token && <AuthModal />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lobby/:roomCode" element={<LobbyPage />} />
        <Route path="/game/:roomCode" element={<GamePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
