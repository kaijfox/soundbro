import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Card, Flex, Heading, IconButton, Text } from '@radix-ui/themes'
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import AuthGate from '../../components/AuthGate'
import RatingBubbles from '../../components/RatingBubbles'
import { useAlbumsStore } from '../../state/albums'

export default function ListensPage() {
  return (
    <Box p="6">
      <Flex align="center" gap="3" mb="4">
        <IconButton asChild variant="ghost">
          <Link to="/" aria-label="Back"><ArrowLeft size={18} /></Link>
        </IconButton>
        <Heading size="5">Recent Listens</Heading>
      </Flex>
      <AuthGate>
        <ListensList />
      </AuthGate>
    </Box>
  )
}

function formatDate(stamp: string): string {
  if (stamp.length !== 8) return stamp
  const date = new Date(
    parseInt(stamp.slice(0, 4)),
    parseInt(stamp.slice(4, 6)) - 1,
    parseInt(stamp.slice(6, 8))
  )
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' })
  const day = date.getDate()
  const month = date.toLocaleDateString('en-GB', { month: 'long' })
  return `${weekday} ${day} ${month}`
}

function SyncingRatingBubbles({
  rating,
  onRate,
}: {
  rating: string
  onRate: (r: string) => Promise<void>
}) {
  const [localRating, setLocalRating] = useState(rating)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(false)

  useEffect(() => { setLocalRating(rating) }, [rating])

  const handleRate = async (r: string) => {
    setLocalRating(r)
    setSyncing(true)
    setSyncError(false)
    try {
      await onRate(r)
    } catch {
      setSyncError(true)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Flex align="center" gap="2">
      {syncing && <RefreshCw size={12} className="animate-spin-slow" color="var(--gray-9)" />}
      {syncError && <AlertTriangle size={12} color="var(--red-9)" />}
      <RatingBubbles rating={localRating} onRate={handleRate} />
    </Flex>
  )
}

function ListensList() {
  const albums = useAlbumsStore(s => s.albums) ?? []
  const listens = useAlbumsStore(s => s.listens) ?? []
  const rateListen = useAlbumsStore(s => s.rateListen)

  const albumsById = new Map(albums.map(a => [a.id, a]))
  const sorted = [...listens].sort((a, b) => (a.date === b.date ? b.index - a.index : b.date.localeCompare(a.date)))

  if (sorted.length === 0) {
    return <Text size="2" color="gray">No listens logged yet.</Text>
  }

  return (
    <Flex direction="column" gap="2">
      {sorted.map(listen => {
        const album = albumsById.get(listen.albumId)
        return (
          <Card key={`${listen.albumId}-${listen.index}`}>
            <Flex align="center" justify="between" gap="3">
              <Flex direction="column">
                <Text size="2" weight="medium">{album?.name ?? listen.albumId}</Text>
                <Flex gap="2" align="center">
                  <Text size="1" color="gray">{album?.artist}</Text>
                  <Text size="1" color="gray">{formatDate(listen.date)}</Text>
                </Flex>
              </Flex>
              <SyncingRatingBubbles
                rating={listen.rating}
                onRate={r => rateListen(listen.albumId, listen.index, r)}
              />
            </Flex>
          </Card>
        )
      })}
    </Flex>
  )
}
