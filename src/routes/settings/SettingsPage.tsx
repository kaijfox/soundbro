import { Link } from 'react-router-dom'
import { Tabs, Box, Flex, Heading, IconButton } from '@radix-ui/themes'
import { ArrowLeft } from 'lucide-react'
import DatabaseSettings from './tabs/DatabaseSettings'
import SpotifySettings from './tabs/SpotifySettings'
import SamplingSettings from './tabs/SamplingSettings'

export default function SettingsPage() {
  return (
    <Box p="6">
      <Flex align="center" gap="3" mb="4">
        <IconButton asChild variant="ghost">
          <Link to="/" aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
        </IconButton>
        <Heading size="5">Settings</Heading>
      </Flex>
      <Tabs.Root defaultValue="database">
        <Tabs.List>
          <Tabs.Trigger value="database">Database</Tabs.Trigger>
          <Tabs.Trigger value="spotify">Spotify</Tabs.Trigger>
          <Tabs.Trigger value="sampling">Sampling</Tabs.Trigger>
        </Tabs.List>
        <Box pt="6">
          <Tabs.Content value="database">
            <DatabaseSettings />
          </Tabs.Content>
          <Tabs.Content value="spotify">
            <SpotifySettings />
          </Tabs.Content>
          <Tabs.Content value="sampling">
            <SamplingSettings />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  )
}
