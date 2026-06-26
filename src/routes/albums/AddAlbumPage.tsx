import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Button, Callout, Flex, Heading, IconButton, Text, TextField } from '@radix-ui/themes'
import { ArrowLeft, Check, Disc3, Plus, RefreshCw } from 'lucide-react'
import AuthGate from '../../components/AuthGate'
import AlbumResultRow from '../../components/AlbumResultRow'
import { useAlbumsStore } from '../../state/albums'
import { searchAlbums } from '../../model/spotify'
import { PlayerGateway } from '../../gateways/player'
import type { SpotifyAlbumResult } from '../../gateways/player'

export default function AddAlbumPage() {
  return (
    <AuthGate>
      <AddAlbum />
    </AuthGate>
  )
}

function AddAlbum() {
  const addAlbum = useAlbumsStore(s => s.addAlbum)
  const albums = useAlbumsStore(s => s.albums) ?? []
  const existingSpotifyIds = new Set(albums.map(a => a.spotifyId).filter(Boolean))

  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [artist, setArtist] = useState('')
  const [year, setYear] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SpotifyAlbumResult[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())
  const [addError, setAddError] = useState<string | null>(null)

  const handleSearch = async () => {
    setSearching(true)
    setSearchError(null)
    setResults(null)
    try {
      const found = await searchAlbums(PlayerGateway.getInstance(), {
        raw: query || undefined,
        name: name || undefined,
        artist: artist || undefined,
        year: year ? parseInt(year, 10) : null,
      })
      setResults(found.slice(0, 5))
    } catch (err) {
      setSearchError(String(err))
    } finally {
      setSearching(false)
    }
  }

  const handleAdd = async (result: SpotifyAlbumResult) => {
    setAddError(null)
    setAddingIds(prev => new Set(prev).add(result.spotifyId))
    try {
      await addAlbum({
        name: result.name,
        artist: result.artist,
        year: result.year,
        spotifyId: result.spotifyId,
        groups: [],
      })
      setAddedIds(prev => new Set(prev).add(result.spotifyId))
    } catch (err) {
      setAddError(String(err))
    } finally {
      setAddingIds(prev => { const s = new Set(prev); s.delete(result.spotifyId); return s })
    }
  }

  return (
    <Box p="6" maxWidth="480px">
      <Flex align="center" gap="3" mb="4">
        <IconButton asChild variant="ghost">
          <Link to="/albums" aria-label="Back"><ArrowLeft size={18} /></Link>
        </IconButton>
        <Heading size="5">Add Album</Heading>
      </Flex>
      <Flex direction="column" gap="3">
        <Box>
          <Text as="label" size="2" weight="medium">Spotify ID or search query</Text>
          <TextField.Root value={query} onChange={e => setQuery(e.target.value)} />
        </Box>
        <Box>
          <Text as="label" size="2" weight="medium">Name</Text>
          <TextField.Root value={name} onChange={e => setName(e.target.value)} />
        </Box>
        <Box>
          <Text as="label" size="2" weight="medium">Artist</Text>
          <TextField.Root value={artist} onChange={e => setArtist(e.target.value)} />
        </Box>
        <Box>
          <Text as="label" size="2" weight="medium">Year</Text>
          <TextField.Root value={year} onChange={e => setYear(e.target.value)} />
        </Box>
        <Flex align="center" gap="3">
          <Button onClick={handleSearch} disabled={searching}>Search</Button>
          {results !== null && (
            <Text size="2" color="gray">
              {results.length === 0 ? 'No matches found.' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
            </Text>
          )}
        </Flex>
      </Flex>

      {searchError && (
        <Callout.Root color="red" mt="4"><Callout.Text>{searchError}</Callout.Text></Callout.Root>
      )}
      {addError && (
        <Callout.Root color="red" mt="4"><Callout.Text>{addError}</Callout.Text></Callout.Root>
      )}

      {results && results.length > 0 && (
        <Box mt="4">
          {results.map(result => {
            const added = addedIds.has(result.spotifyId)
            const adding = addingIds.has(result.spotifyId)
            const alreadyInList = existingSpotifyIds.has(result.spotifyId)
            return (
              <AlbumResultRow
                key={result.spotifyId}
                name={result.name}
                artist={result.artist}
                year={result.year}
                action={
                  added ? (
                    <Flex align="center" gap="2">
                      <Disc3 size={16} />
                      <Text size="2">Crant.</Text>
                    </Flex>
                  ) : adding ? (
                    <RefreshCw size={16} className="animate-spin-slow" color="var(--gray-9)" />
                  ) : alreadyInList ? (
                    <Flex align="center" gap="1">
                      <Check size={14} color="var(--gray-9)" />
                      <Text size="1" color="gray">I know</Text>
                    </Flex>
                  ) : (
                    <IconButton size="1" variant="ghost" onClick={() => handleAdd(result)} aria-label="Add album">
                      <Plus size={16} />
                    </IconButton>
                  )
                }
              />
            )
          })}
        </Box>
      )}
    </Box>
  )
}
