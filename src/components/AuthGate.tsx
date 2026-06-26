import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Button, Callout, Text } from '@radix-ui/themes'
import { DocumentGateway } from '../gateways/document'
import { useSettings } from '../state/settings'
import { useGoogleAuth } from '../state/googleAuth'
import { useGatewayReady } from '../state/gatewayReady'
import { useAlbumsStore } from '../state/albums'

interface AuthGateProps {
  children: ReactNode
  loading?: ReactNode
}

export default function AuthGate({ children, loading }: AuthGateProps) {
  const googleUser = useSettings(s => s.googleUser)
  const googleAccessToken = useGoogleAuth(s => s.googleAccessToken)
  const authed = googleAccessToken !== null
  const gatewayReady = useGatewayReady(s => s.ready)

  const albums = useAlbumsStore(s => s.albums)
  const storeLoading = useAlbumsStore(s => s.loading)
  const storeError = useAlbumsStore(s => s.error)
  const load = useAlbumsStore(s => s.load)

  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (!authed || !gatewayReady || storeLoading || albums !== null || storeError) return
    load()
  }, [authed, gatewayReady, albums, storeLoading, storeError, load])

  const handleAuthorize = () => {
    setAuthError(null)
    const gateway = DocumentGateway.getInstance()
    if (!gateway.isReady()) {
      setAuthError('Gateway not ready — save Client ID in Settings first.')
      return
    }
    gateway.authorize(googleUser || undefined).catch(err => setAuthError(String(err)))
  }

  if (!authed) {
    return (
      <Box p="3">
        <Text as="p" size="2" color="gray" mb="3">Authorize to continue.</Text>
        <Button onClick={handleAuthorize}>Authorize</Button>
        {authError && (
          <Callout.Root color="red" mt="3">
            <Callout.Text>{authError}</Callout.Text>
          </Callout.Root>
        )}
      </Box>
    )
  }

  if (storeError) {
    return (
      <Box p="3">
        <Callout.Root color="red"><Callout.Text>{storeError}</Callout.Text></Callout.Root>
      </Box>
    )
  }

  if (storeLoading || albums === null) {
    return <>{loading ?? <Box p="3"><Text size="2" color="gray">Loading…</Text></Box>}</>
  }

  return <>{children}</>
}
