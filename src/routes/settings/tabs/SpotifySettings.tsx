import { useEffect, useState } from 'react'
import { Button, Callout, Flex, Box, Text, TextArea, IconButton, Separator, TextField } from '@radix-ui/themes'
import { RadioTower, RefreshCw, Star, Check, Copy } from 'lucide-react'
import { PlayerGateway } from '../../../gateways/player'
import { useSpotifySettings } from '../../../state/spotify'
import { useSpotifyDevicesStore, resolveQueueTarget } from '../../../state/spotifyDevices'
import { useGoogleAuth } from '../../../state/googleAuth'

export default function SpotifySettings() {
  const {
    spotifyClientId,
    spotifyAccessToken,
    spotifyProfileName,
    setSpotifyClientId,
  } = useSpotifySettings()
  const [authError, setAuthError] = useState<string | null>(null)

  const googleAccessToken = useGoogleAuth(s => s.googleAccessToken)
  const googleAuthed = googleAccessToken !== null
  const spotifyAuthed = spotifyAccessToken !== null

  const savedDeviceIds = useSpotifyDevicesStore(s => s.savedDeviceIds)
  const savedLoaded = useSpotifyDevicesStore(s => s.savedLoaded)
  const availableDevices = useSpotifyDevicesStore(s => s.availableDevices)
  const saving = useSpotifyDevicesStore(s => s.saving)
  const refreshing = useSpotifyDevicesStore(s => s.refreshing)
  const devicesError = useSpotifyDevicesStore(s => s.error)
  const loadSaved = useSpotifyDevicesStore(s => s.loadSaved)
  const saveSaved = useSpotifyDevicesStore(s => s.saveSaved)
  const refreshAvailable = useSpotifyDevicesStore(s => s.refreshAvailable)

  const [deviceText, setDeviceText] = useState('')

  useEffect(() => {
    if (googleAuthed && !savedLoaded) loadSaved()
  }, [googleAuthed, savedLoaded, loadSaved])

  useEffect(() => {
    if (spotifyAuthed) refreshAvailable()
  }, [spotifyAuthed])

  // Sync textarea when saved IDs load for the first time.
  useEffect(() => {
    if (savedLoaded) setDeviceText(savedDeviceIds.join('\n'))
  }, [savedLoaded])

  const handleAuthorize = () => {
    setAuthError(null)
    PlayerGateway.getInstance().initialize(spotifyClientId)
    PlayerGateway.getInstance()
      .authorize()
      .catch(err => setAuthError(String(err)))
  }

  const handleSaveDevices = () => {
    const ids = deviceText.split('\n').map(s => s.trim()).filter(Boolean)
    saveSaved(ids)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  const queueTarget = resolveQueueTarget(savedDeviceIds, availableDevices)
  const nonRestrictedAvailable = (availableDevices ?? []).filter(d => !d.is_restricted)

  return (
    <Box maxWidth="448px">
      <Flex direction="column" gap="4">
        <Box>
          <Text as="label" size="2" weight="medium">Client ID</Text>
          <TextField.Root value={spotifyClientId} onChange={e => setSpotifyClientId(e.target.value)} />
        </Box>
        <Flex align="center" gap="3" pt="2">
          <Button onClick={handleAuthorize} disabled={!spotifyClientId}>
            Authorize
          </Button>
          {spotifyAccessToken && (
            <Flex align="center" gap="2">
              <RadioTower size={20} />
              <Text size="2">We're in.{spotifyProfileName ? ` (${spotifyProfileName})` : ''}</Text>
            </Flex>
          )}
        </Flex>
        {authError && (
          <Callout.Root color="red">
            <Callout.Text>{authError}</Callout.Text>
          </Callout.Root>
        )}

        <Separator size="4" mt="2" />

        <Box>
          <Text as="label" size="2" weight="medium">Devices</Text>
          <Text as="p" size="1" color="gray" mb="2">
            One device ID per line, in priority order. Queuing targets the highest-priority active device.
          </Text>
          <TextArea
            value={deviceText}
            onChange={e => setDeviceText(e.target.value)}
            placeholder="Paste device IDs here, one per line"
            rows={4}
            disabled={!googleAuthed}
          />
          <Flex gap="2" mt="2">
            <Button
              size="1"
              variant="outline"
              onClick={handleSaveDevices}
              disabled={!googleAuthed || saving}
            >
              {saving ? <RefreshCw size={12} className="animate-spin-slow" /> : 'Save'}
            </Button>
          </Flex>
        </Box>

        <Box>
          <Flex align="center" justify="between" mb="2">
            <Text size="2" weight="medium">Available devices</Text>
            <Button
              size="1"
              variant="ghost"
              onClick={refreshAvailable}
              disabled={!spotifyAuthed || refreshing}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin-slow' : undefined} />
              Refresh
            </Button>
          </Flex>
          {availableDevices === null ? (
            <Text size="1" color="gray">
              {spotifyAuthed ? 'Press Refresh to load devices.' : 'Authorize Spotify to see devices.'}
            </Text>
          ) : nonRestrictedAvailable.length === 0 ? (
            <Text size="1" color="gray">No devices found.</Text>
          ) : (
            <Flex direction="column" gap="2">
              {nonRestrictedAvailable.map(device => {
                const isTarget = queueTarget.deviceId === device.id
                const isSaved = savedDeviceIds.includes(device.id)
                return (
                  <Flex key={device.id} align="center" gap="2" py="1" style={{ borderBottom: '1px solid var(--gray-a3)' }}>
                    <Box style={{ width: 16, flexShrink: 0 }}>
                      {isTarget ? (
                        <Star size={13} color="var(--amber-9)" fill="var(--amber-9)" />
                      ) : isSaved ? (
                        <Check size={13} color="var(--green-9)" />
                      ) : null}
                    </Box>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="2" weight={isSaved ? 'medium' : 'regular'}>{device.name}</Text>
                      <Flex align="center" gap="1">
                        <Text size="1" color="gray" style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {device.id}
                        </Text>
                        <IconButton
                          size="1"
                          variant="ghost"
                          onClick={() => handleCopy(device.id)}
                          title="Copy ID"
                          style={{ flexShrink: 0 }}
                        >
                          <Copy size={11} />
                        </IconButton>
                      </Flex>
                    </Box>
                    {device.is_active && (
                      <Text size="1" color="green">active</Text>
                    )}
                  </Flex>
                )
              })}
            </Flex>
          )}
        </Box>

        {devicesError && (
          <Callout.Root color="red">
            <Callout.Text>{devicesError}</Callout.Text>
          </Callout.Root>
        )}
      </Flex>
    </Box>
  )
}
