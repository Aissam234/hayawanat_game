import { ReactNode, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import './pages/FriendsTheme.css'
import HomePage from './pages/HomePage'
import ModeMenu from './pages/ModeMenu'
import AiPage from './features/ai-mode/AiPage'
import LobbyPage from './pages/LobbyPage'
import GamePage from './pages/GamePage'
import { ToastContainer } from './components/ToastContainer'
import { useGameStore } from './store/gameStore'
import { useAuthStore } from './store/authStore'
import { authApi, ApiError, cancelOnlineRequests } from './services/api'
import SoundControl from './components/shared/SoundControl'
import AuthModal from './components/auth/AuthModal'

// Only mounted on online routes. AI and the mode menu never validate accounts.
function OnlineAccount({children}:{children:ReactNode}) {
  const {token,setAuth,logout}=useAuthStore()
  useEffect(() => () => { cancelOnlineRequests(); useGameStore.getState().disconnectWs() }, [])
  const finishedRoundId=useGameStore(state=>state.roundFinished?.id)
  useEffect(()=>{
    let disposed=false
    let controller:AbortController|undefined
    const refresh=()=>{
      if(!token)return
      controller?.abort();controller=new AbortController()
      authApi.getMe(controller.signal).then(user=>{if(!disposed)setAuth(token,user)}).catch(error=>{
        if(!disposed&&error instanceof ApiError&&error.status===401)logout()
      })
    }
    refresh();window.addEventListener('focus',refresh)
    return ()=>{disposed=true;controller?.abort();window.removeEventListener('focus',refresh)}
  },[token,finishedRoundId])
  return <MotionConfig reducedMotion="user"><div className="friends-world" dir="rtl">{!token&&<AuthModal/>}{children}</div></MotionConfig>
}
export default function App(){
  return <BrowserRouter><ToastContainer/><SoundControl/><Routes>
    <Route path="/" element={<ModeMenu/>}/>
    <Route path="/ai" element={<AiPage/>}/>
    <Route path="/friends" element={<OnlineAccount><HomePage/></OnlineAccount>}/>
    <Route path="/lobby/:roomCode" element={<OnlineAccount><LobbyPage/></OnlineAccount>}/>
    <Route path="/game/:roomCode" element={<OnlineAccount><GamePage/></OnlineAccount>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></BrowserRouter>
}
