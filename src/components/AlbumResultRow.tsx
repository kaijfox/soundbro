import type { ReactNode } from 'react'
import { Flex, Text } from '@radix-ui/themes'

interface AlbumResultRowProps {
  name: string
  artist: string
  year: number | null
  action: ReactNode
}

// One row of an album search/result list: title + artist + year on the
// left, a caller-supplied action (button or status) on the right. Shared by
// Find on Spotify and Add Album, which search the same data and act on it
// the same way.
export default function AlbumResultRow({ name, artist, year, action }: AlbumResultRowProps) {
  return (
    <Flex align="center" justify="between" gap="3" py="2">
      <Flex direction="column">
        <Text size="2" weight="medium">{name}</Text>
        <Text size="1" color="gray">{artist}{year ? ` · ${year}` : ''}</Text>
      </Flex>
      {action}
    </Flex>
  )
}
