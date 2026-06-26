import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { DocumentGateway } from './gateways/document'
import { PlayerGateway } from './gateways/player'
import { useSettings } from './state/settings'
import { useGoogleAuth } from './state/googleAuth'
import { useSpotifySettings } from './state/spotify'
import { useGatewayReady } from './state/gatewayReady'
import NavBar from './components/NavBar'
import SamplePage from './routes/sample/SamplePage'
import ListensPage from './routes/listens/ListensPage'
import AlbumsPage from './routes/albums/AlbumsPage'
import AddAlbumPage from './routes/albums/AddAlbumPage'
import SettingsPage from './routes/settings/SettingsPage'
import SpotifyCallbackPage from './routes/spotify-callback/SpotifyCallbackPage'
import GoogleCallbackPage from './routes/google-callback/GoogleCallbackPage'

function Shell() {
  const { pathname } = useLocation()
  return (
    <>
      {pathname === '/' && <NavBar />}
      <Routes>
        <Route path="/" element={<SamplePage />} />
        <Route path="/albums" element={<AlbumsPage />} />
        <Route path="/albums/add" element={<AddAlbumPage />} />
        <Route path="/listens" element={<ListensPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/spotify-callback" element={<SpotifyCallbackPage />} />
        <Route path="/google-callback" element={<GoogleCallbackPage />} />
      </Routes>
    </>
  )
}

export default function App() {
  const clientId = useSettings(s => s.clientId)
  const clientSecret = useSettings(s => s.clientSecret)
  const apiKey = useSettings(s => s.apiKey)
  const hasGoogleInit = useRef(false)

  const spotifyClientId = useSpotifySettings(s => s.spotifyClientId)
  const spotifyAccessToken = useSpotifySettings(s => s.spotifyAccessToken)
  const spotifyRefreshToken = useSpotifySettings(s => s.spotifyRefreshToken)
  const hasSpotifyInit = useRef(false)

  // Register token-refresh callbacks once.
  useEffect(() => {
    DocumentGateway.getInstance().setOnTokensRefreshed((accessToken, refreshToken) => {
      useGoogleAuth.getState().setGoogleTokens(accessToken, refreshToken)
    })
    PlayerGateway.getInstance().setOnTokensRefreshed((accessToken, refreshToken) => {
      useSpotifySettings.getState().setSpotifyTokens(accessToken, refreshToken)
    })
  }, [])

  useEffect(() => {
    if (!clientId || hasGoogleInit.current) return
    hasGoogleInit.current = true
    const gateway = DocumentGateway.getInstance()
    gateway.initialize(clientId, apiKey || undefined, clientSecret || undefined)
      .then(() => {
        const { googleAccessToken, googleRefreshToken } = useGoogleAuth.getState()
        if (googleAccessToken) gateway.setTokens(googleAccessToken, googleRefreshToken)
        useGatewayReady.getState().setReady()
      })
      .catch(console.error)
  }, [clientId, apiKey])

  useEffect(() => {
    if (!spotifyClientId || hasSpotifyInit.current) return
    hasSpotifyInit.current = true
    const gateway = PlayerGateway.getInstance()
    gateway.initialize(spotifyClientId)
    if (spotifyAccessToken) gateway.setTokens(spotifyAccessToken, spotifyRefreshToken)
  }, [spotifyClientId, spotifyAccessToken, spotifyRefreshToken])

  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
