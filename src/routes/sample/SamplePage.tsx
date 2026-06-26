import { useEffect, useState } from 'react'
import { Box, Button, Callout, Flex, Heading, Skeleton, Text } from '@radix-ui/themes'
import { RefreshCw } from 'lucide-react'
import { PlayerGateway } from '../../gateways/player'
import AuthGate from '../../components/AuthGate'
import { useAlbumsStore } from '../../state/albums'
import { queueAlbum } from '../../model/spotify'
import { useSpotifyDevicesStore, resolveQueueTarget } from '../../state/spotifyDevices'
import { useSpotifySettings } from '../../state/spotify'
import { useDrawAnimation } from './useDrawAnimation'
import type { Album } from '../../model/types'

export default function SamplePage() {
  return (
    <AuthGate loading={
      <Flex direction="column" align="center" gap="3" p="9">
        <Skeleton><Heading size="8">Loading albums…</Heading></Skeleton>
      </Flex>
    }>
      <Sample />
    </AuthGate>
  )
}

function Sample() {
  const albums = useAlbumsStore(s => s.albums)
  const drawSampleAction = useAlbumsStore(s => s.drawSample)
  const markListen = useAlbumsStore(s => s.markListen)
  const { animState, startAnimation } = useDrawAnimation()

  const spotifyAccessToken = useSpotifySettings(s => s.spotifyAccessToken)
  const savedDeviceIds = useSpotifyDevicesStore(s => s.savedDeviceIds)
  const savedLoaded = useSpotifyDevicesStore(s => s.savedLoaded)
  const availableDevices = useSpotifyDevicesStore(s => s.availableDevices)
  const loadSaved = useSpotifyDevicesStore(s => s.loadSaved)
  const refreshAvailable = useSpotifyDevicesStore(s => s.refreshAvailable)
  const queueTarget = resolveQueueTarget(savedDeviceIds, availableDevices)

  useEffect(() => {
    if (!savedLoaded) loadSaved()
  }, [savedLoaded, loadSaved])

  useEffect(() => {
    if (spotifyAccessToken) refreshAvailable()
  }, [spotifyAccessToken])

  const [drawing, setDrawing] = useState(false)
  const [drawn, setDrawn] = useState<Album | null>(null)
  const [marking, setMarking] = useState(false)
  const [queueing, setQueueing] = useState(false)
  const [queued, setQueued] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleSample = async () => {
    if (!albums || albums.length === 0) return
    setActionError(null)
    setQueued(false)
    setDrawing(true)
    const { drawn: newDrawn, topK } = await drawSampleAction()
    setDrawing(false)
    if (newDrawn) {
      setDrawn(newDrawn)
      startAnimation(newDrawn, topK)
    }
  }

  const handleMarkListen = async () => {
    if (!drawn) return
    setMarking(true)
    try {
      await markListen(drawn.id)
    } finally {
      setMarking(false)
    }
  }

  const handleAddToQueue = async () => {
    if (!drawn || !drawn.spotifyId) return
    setQueueing(true)
    setActionError(null)
    try {
      await queueAlbum(PlayerGateway.getInstance(), drawn.spotifyId, queueTarget.deviceId)
      await markListen(drawn.id)
      setQueued(true)
    } catch (err) {
      setActionError(String(err))
    } finally {
      setQueueing(false)
    }
  }

  if (!albums || albums.length === 0) {
    return (
      <Box p="6">
        <Text as="p" size="2" color="gray">No albums yet. Add one to start sampling.</Text>
      </Box>
    )
  }

  return (
    <Flex direction="column" align="center" justify="center" gap="6" p="9" style={{ minHeight: '60vh' }}>
      {drawn ? (
        <Flex direction="column" align="center" gap="2">
          <Heading size="8" align="center">{animState.displayTitle}</Heading>
          {!animState.isAnimating && (
            <Text size="4" color="gray">{drawn.artist}{drawn.year ? ` · ${drawn.year}` : ''}</Text>
          )}
        </Flex>
      ) : (
        <Text size="4" color="gray">Press Sample to draw an album.</Text>
      )}

      {drawn && (
        <Flex gap="3">
          <Button
            variant="outline"
            disabled={!drawn.spotifyId || queueing || queued || queueTarget.disabled}
            onClick={handleAddToQueue}
          >
            {queueing ? <RefreshCw size={14} className="animate-spin-slow" /> : queued ? 'Queued' : 'Add to Queue'}
          </Button>
          <Button variant="outline" onClick={handleMarkListen} disabled={marking}>
            {marking ? <RefreshCw size={14} className="animate-spin-slow" /> : 'Mark Listen'}
          </Button>
        </Flex>
      )}

      <Button size="3" onClick={handleSample} disabled={drawing}>
        {drawing ? 'Drawing…' : 'Sample'}
      </Button>

      {actionError && (
        <Callout.Root color="red"><Callout.Text>{actionError}</Callout.Text></Callout.Root>
      )}
    </Flex>
  )
}
