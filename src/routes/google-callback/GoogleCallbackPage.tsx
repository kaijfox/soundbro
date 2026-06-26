import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Callout, Text } from '@radix-ui/themes'
import { DocumentGateway } from '../../gateways/document'
import { useSettings } from '../../state/settings'
import { useGoogleAuth } from '../../state/googleAuth'

export default function GoogleCallbackPage() {
  const navigate = useNavigate()
  const clientId = useSettings(s => s.clientId)
  const clientSecret = useSettings(s => s.clientSecret)
  const setGoogleTokens = useGoogleAuth(s => s.setGoogleTokens)
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const authError = params.get('error')

    if (authError) { setError(authError); return }
    if (!code) { setError('Missing authorization code.'); return }
    if (!clientId) { setError('Missing Google client ID.'); return }

    // Fresh page load — App.tsx effects may not have run yet, so initialize directly.
    const gateway = DocumentGateway.getInstance()
    gateway.initialize(clientId, undefined, clientSecret || undefined)
      .then(() => gateway.exchangeCodeForToken(code))
      .then(({ accessToken, refreshToken }) => {
        setGoogleTokens(accessToken, refreshToken)
        navigate('/')
      })
      .catch(err => setError(String(err)))
  }, [navigate, clientId, clientSecret, setGoogleTokens])

  if (error) {
    return (
      <Box p="6">
        <Callout.Root color="red"><Callout.Text>{error}</Callout.Text></Callout.Root>
      </Box>
    )
  }

  return (
    <Box p="6">
      <Text as="p" size="2" color="gray">Completing Google authorization…</Text>
    </Box>
  )
}
