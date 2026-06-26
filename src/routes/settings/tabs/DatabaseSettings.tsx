import { useState } from 'react'
import { Button, TextField, Callout, Flex, Box, Text } from '@radix-ui/themes'
import { RadioTower } from 'lucide-react'
import { DocumentGateway } from '../../../gateways/document'
import { useSettings } from '../../../state/settings'
import { useGoogleAuth } from '../../../state/googleAuth'
import { initializeSheet } from '../../../model/migrations'

export default function DatabaseSettings() {
  const {
    clientId,
    clientSecret,
    apiKey,
    spreadsheetId,
    googleUser,
    setClientId,
    setClientSecret,
    setApiKey,
    setSpreadsheetId,
    setGoogleUser,
  } = useSettings()
  const googleAccessToken = useGoogleAuth(s => s.googleAccessToken)
  const clearGoogleAuth = useGoogleAuth(s => s.clearGoogleAuth)
  const authed = googleAccessToken !== null

  const [authError, setAuthError] = useState<string | null>(null)
  const [initPending, setInitPending] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  const handleAuthorize = () => {
    setAuthError(null)
    const gateway = DocumentGateway.getInstance()
    if (!gateway.isReady()) {
      setAuthError('Gateway not ready — save Client ID first.')
      return
    }
    gateway.authorize(googleUser || undefined).catch(err => setAuthError(String(err)))
  }

  const handleInitialize = () => {
    setInitPending(true)
    setInitError(null)
    initializeSheet(DocumentGateway.getInstance(), spreadsheetId)
      .catch(err => setInitError(String(err)))
      .finally(() => setInitPending(false))
  }

  return (
    <Box maxWidth="448px">
      <Flex direction="column" gap="4">
        <Box>
          <Text as="label" size="2" weight="medium">Client ID</Text>
          <TextField.Root value={clientId} onChange={e => setClientId(e.target.value)} />
        </Box>
        <Box>
          <Text as="label" size="2" weight="medium">Client Secret</Text>
          <TextField.Root type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} />
        </Box>
        <Box>
          <Text as="label" size="2" weight="medium">API Key</Text>
          <Text as="p" size="1" color="gray" mb="1">Optional — only needed for unauthenticated requests.</Text>
          <TextField.Root value={apiKey} onChange={e => setApiKey(e.target.value)} />
        </Box>
        <Box>
          <Text as="label" size="2" weight="medium">Spreadsheet ID</Text>
          <TextField.Root value={spreadsheetId} onChange={e => setSpreadsheetId(e.target.value)} />
        </Box>
        <Box>
          <Text as="label" size="2" weight="medium">Google Account (optional)</Text>
          <Text as="p" size="1" color="gray" mb="1">Pre-fills the account selector during authorization.</Text>
          <TextField.Root value={googleUser} onChange={e => setGoogleUser(e.target.value)} />
        </Box>
        <Flex align="center" gap="3" pt="2">
          {authed ? (
            <>
              <Flex align="center" gap="2">
                <RadioTower size={20} />
                <Text size="2">We're in.</Text>
              </Flex>
              <Button variant="outline" size="1" onClick={clearGoogleAuth}>Re-authorize</Button>
            </>
          ) : (
            <Button onClick={handleAuthorize} disabled={!clientId}>
              Authorize
            </Button>
          )}
        </Flex>
        {authError && (
          <Callout.Root color="red">
            <Callout.Text>{authError}</Callout.Text>
          </Callout.Root>
        )}
        <Box>
          <Button
            variant="outline"
            onClick={handleInitialize}
            disabled={!authed || !spreadsheetId || initPending}
          >
            Initialize Database
          </Button>
        </Box>
        {initError && (
          <Callout.Root color="red">
            <Callout.Text>{initError}</Callout.Text>
          </Callout.Root>
        )}
      </Flex>
    </Box>
  )
}
