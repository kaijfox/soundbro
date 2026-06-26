import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Callout, Text } from '@radix-ui/themes'
import { PlayerGateway } from '../../gateways/player'
import { useSpotifySettings } from '../../state/spotify'

export default function SpotifyCallbackPage() {
  const navigate = useNavigate()
  const spotifyClientId = useSpotifySettings(s => s.spotifyClientId)
  const setSpotifyTokens = useSpotifySettings(s => s.setSpotifyTokens)
  const setSpotifyProfileName = useSpotifySettings(s => s.setSpotifyProfileName)
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const authError = params.get('error')

    if (authError) {
      setError(authError)
      return
    }
    if (!code) {
      setError('Missing authorization code.')
      return
    }
    if (!spotifyClientId) {
      setError('Missing Spotify client ID.')
      return
    }

    // This page is reached via a full-page redirect, so it's a fresh load — the
    // gateway singleton hasn't been initialized by App.tsx's effect yet (child
    // effects run before parent effects), so initialize it here directly.
    const gateway = PlayerGateway.getInstance()
    gateway.initialize(spotifyClientId)
    gateway
      .exchangeCodeForToken(code)
      .then(({ accessToken, refreshToken }) => {
        setSpotifyTokens(accessToken, refreshToken)
        return gateway.getProfileName()
      })
      .then(profileName => {
        setSpotifyProfileName(profileName)
        navigate('/settings')
      })
      .catch(err => setError(String(err)))
  }, [navigate, spotifyClientId, setSpotifyTokens, setSpotifyProfileName])

  if (error) {
    return (
      <Box p="6">
        <Callout.Root color="red">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      </Box>
    )
  }

  return (
    <Box p="6">
      <Text as="p" size="2" color="gray">Completing Spotify authorization…</Text>
    </Box>
  )
}
