import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Button, Callout, Flex, Heading, IconButton, Text, TextField } from '@radix-ui/themes'
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import AuthGate from '../../components/AuthGate'
import AlbumResultRow from '../../components/AlbumResultRow'
import { useAlbumsStore } from '../../state/albums'
import { useSamplingSettings } from '../../state/sampling'
import { averageRating } from '../../logic/sampling'
import { queueAlbum, searchAlbums } from '../../model/spotify'
import { PlayerGateway } from '../../gateways/player'
import { useSpotifyDevicesStore, resolveQueueTarget } from '../../state/spotifyDevices'
import { useSpotifySettings } from '../../state/spotify'
import type { SpotifyAlbumResult } from '../../gateways/player'
import type { Album } from '../../model/types'

const RATING_BUCKETS = ['S', 'A', 'B', 'C', 'D', 'Unrated'] as const
const RATING_LETTERS: Record<number, string> = { 5: 'S', 4: 'A', 3: 'B', 2: 'C', 1: 'D' }

function bucketFor(avg: number | null): string {
  if (avg === null) return 'Unrated'
  return RATING_LETTERS[Math.max(1, Math.min(5, Math.round(avg)))] ?? 'Unrated'
}

export default function AlbumsPage() {
  const [filter, setFilter] = useState('')
  return (
    <Box p="6">
      <Flex align="center" gap="3" mb="4">
        <IconButton asChild variant="ghost">
          <Link to="/" aria-label="Back"><ArrowLeft size={18} /></Link>
        </IconButton>
        <Heading size="5" style={{ flex: 1 }}>Albums</Heading>
        <Button asChild variant="outline" size="1">
          <Link to="/albums/add">Add Album</Link>
        </Button>
      </Flex>
      <TextField.Root
        placeholder="Filter by title or artist"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        mb="4"
      />
      <AuthGate>
        <AlbumList filter={filter} />
      </AuthGate>
    </Box>
  )
}

function AlbumList({ filter }: { filter: string }) {
  const albums = useAlbumsStore(s => s.albums) ?? []
  const listens = useAlbumsStore(s => s.listens) ?? []
  const ratingDecay = useSamplingSettings(s => s.ratingDecay)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const lowerFilter = filter.trim().toLowerCase()
  const filtered = albums.filter(
    a => !lowerFilter || a.name.toLowerCase().includes(lowerFilter) || a.artist.toLowerCase().includes(lowerFilter)
  )

  const groups = new Map<string, Album[]>()
  for (const album of filtered) {
    const bucket = bucketFor(averageRating(album.id, listens, ratingDecay))
    if (!groups.has(bucket)) groups.set(bucket, [])
    groups.get(bucket)!.push(album)
  }
  for (const group of groups.values()) {
    group.sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity) || a.artist.localeCompare(b.artist))
  }

  if (filtered.length === 0) {
    return <Text size="2" color="gray">No albums match.</Text>
  }

  return (
    <Flex direction="column" gap="5">
      {RATING_BUCKETS.filter(b => groups.has(b)).map(bucket => (
        <Box key={bucket}>
          <Text size="1" weight="bold" color="gray">{bucket}</Text>
          <Box mt="1" style={{ borderTop: '1px solid var(--gray-a5)' }}>
            {groups.get(bucket)!.map(album => (
              <AlbumRow
                key={album.id}
                album={album}
                expanded={expandedId === album.id}
                onToggle={() => setExpandedId(expandedId === album.id ? null : album.id)}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Flex>
  )
}

function useDeviceTarget() {
  const spotifyAccessToken = useSpotifySettings(s => s.spotifyAccessToken)
  const savedDeviceIds = useSpotifyDevicesStore(s => s.savedDeviceIds)
  const savedLoaded = useSpotifyDevicesStore(s => s.savedLoaded)
  const availableDevices = useSpotifyDevicesStore(s => s.availableDevices)
  const loadSaved = useSpotifyDevicesStore(s => s.loadSaved)
  const refreshAvailable = useSpotifyDevicesStore(s => s.refreshAvailable)

  useEffect(() => {
    if (!savedLoaded) loadSaved()
  }, [savedLoaded, loadSaved])

  useEffect(() => {
    if (spotifyAccessToken) refreshAvailable()
  }, [spotifyAccessToken])

  return resolveQueueTarget(savedDeviceIds, availableDevices)
}

function AlbumRow({ album, expanded, onToggle }: { album: Album; expanded: boolean; onToggle: () => void }) {
  const toggleMuted = useAlbumsStore(s => s.toggleMuted)
  const mergeSpotifyMetadata = useAlbumsStore(s => s.mergeSpotifyMetadata)
  const markListen = useAlbumsStore(s => s.markListen)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SpotifyAlbumResult[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [queueing, setQueueing] = useState(false)
  const [queued, setQueued] = useState(false)
  const [queueError, setQueueError] = useState<string | null>(null)
  const queueTarget = useDeviceTarget()

  const handleAddToQueue = async () => {
    if (!album.spotifyId) return
    setQueueing(true)
    setQueueError(null)
    try {
      await queueAlbum(PlayerGateway.getInstance(), album.spotifyId, queueTarget.deviceId)
      await markListen(album.id)
      setQueued(true)
    } catch (err) {
      setQueueError(String(err))
    } finally {
      setQueueing(false)
    }
  }

  const handleFindOnSpotify = async () => {
    setSearching(true)
    setSearchError(null)
    setResults(null)
    try {
      const found = await searchAlbums(PlayerGateway.getInstance(), {
        name: album.name,
        artist: album.artist,
        year: album.year,
      })
      setResults(found.slice(0, 5))
    } catch (err) {
      setSearchError(String(err))
    } finally {
      setSearching(false)
    }
  }

  return (
    <Box py="2" style={{ borderBottom: '1px solid var(--gray-a3)' }}>
      <Flex align="center" gap="2" onClick={onToggle} style={{ cursor: 'pointer' }}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Text size="2" weight="medium">{album.name}</Text>
        <Text size="1" color="gray">{album.artist}{album.year ? ` · ${album.year}` : ''}</Text>
        {album.muted && <Text size="1" color="gray">(muted)</Text>}
      </Flex>
      {expanded && (
        <Box pl="5" pt="2">
          <Flex gap="2" wrap="wrap">
            <Button size="1" variant="outline" disabled={!album.spotifyId || queueing || queued || queueTarget.disabled} onClick={handleAddToQueue}>
              {queueing ? <RefreshCw size={14} className="animate-spin-slow" /> : queued ? 'Queued' : 'Add to Queue'}
            </Button>
            {!album.spotifyId && (
              <Button size="1" variant="outline" onClick={handleFindOnSpotify} disabled={searching}>
                {searching ? <RefreshCw size={14} className="animate-spin-slow" /> : 'Find on Spotify'}
              </Button>
            )}
            <Button size="1" variant="outline" onClick={() => toggleMuted(album.id, !album.muted)}>
              {album.muted ? 'Unmute' : 'Mute'}
            </Button>
          </Flex>
          {(searchError || queueError) && (
            <Callout.Root color="red" mt="2"><Callout.Text>{searchError ?? queueError}</Callout.Text></Callout.Root>
          )}
          {results && (
            <Box mt="2">
              {results.length === 0 ? (
                <Text size="1" color="gray">No matches found.</Text>
              ) : (
                results.map(result => (
                  <AlbumResultRow
                    key={result.spotifyId}
                    name={result.name}
                    artist={result.artist}
                    year={result.year}
                    action={
                      <Button size="1" onClick={() => mergeSpotifyMetadata(album.id, result)}>Use this</Button>
                    }
                  />
                ))
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
