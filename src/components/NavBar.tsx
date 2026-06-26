import { Link, useLocation } from 'react-router-dom'
import { Flex, IconButton } from '@radix-ui/themes'
import { Library, ListMusic, Settings } from 'lucide-react'

export default function NavBar() {
  const { pathname } = useLocation()

  return (
    <Flex p="3" align="center" justify="between" style={{ borderBottom: '1px solid var(--gray-a4)' }}>
      <Flex gap="2">
        <IconButton asChild variant={pathname === '/albums' ? 'solid' : 'ghost'} aria-label="Albums">
          <Link to="/albums"><Library size={18} /></Link>
        </IconButton>
        <IconButton asChild variant={pathname === '/listens' ? 'solid' : 'ghost'} aria-label="Listens">
          <Link to="/listens"><ListMusic size={18} /></Link>
        </IconButton>
      </Flex>
      <IconButton asChild variant={pathname === '/settings' ? 'solid' : 'ghost'} aria-label="Settings">
        <Link to="/settings"><Settings size={18} /></Link>
      </IconButton>
    </Flex>
  )
}
