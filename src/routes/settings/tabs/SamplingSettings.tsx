import { Box, Flex, Text, TextField } from '@radix-ui/themes'
import { useSamplingSettings } from '../../../state/sampling'

function NumberField({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <Box>
      <Text as="label" size="2" weight="medium">{label}</Text>
      <Text as="p" size="1" color="gray" mb="1">{description}</Text>
      <TextField.Root
        type="number"
        value={value}
        onChange={e => {
          const parsed = parseFloat(e.target.value)
          if (!Number.isNaN(parsed)) onChange(parsed)
        }}
        onWheel={e => e.currentTarget.blur()}
      />
    </Box>
  )
}

export default function SamplingSettings() {
  const {
    ratingWeight,
    priorityDecay,
    sampleTemperature,
    ratingDecay,
    unratedQuantile,
    setRatingWeight,
    setPriorityDecay,
    setSampleTemperature,
    setRatingDecay,
    setUnratedQuantile,
  } = useSamplingSettings()

  return (
    <Box maxWidth="448px">
      <Flex direction="column" gap="4">
        <NumberField
          label="Rating decay"
          description="0–1 exclusive. 0 = only most recent listen counts; higher values spread weight across more listens."
          value={ratingDecay}
          onChange={setRatingDecay}
        />
        <NumberField
          label="Rating weight"
          description="Positive. Exponent applied to the recency-weighted average rating when computing sampling weights."
          value={ratingWeight}
          onChange={setRatingWeight}
        />
        <NumberField
          label="Priority decrement"
          description="Positive value is subtracted from a chosen album's priority after a listen. Increase to push recent picks further back."
          value={priorityDecay}
          onChange={setPriorityDecay}
        />
        <NumberField
          label="Sample temperature"
          description="Positive. Controls randomness of draws — higher values make all albums more equally likely."
          value={sampleTemperature}
          onChange={setSampleTemperature}
        />
        <NumberField
          label="Unrated quantile"
          description="0–1 inclusive. Quantile of rated-album weights assigned to albums with no ratings yet."
          value={unratedQuantile}
          onChange={setUnratedQuantile}
        />
      </Flex>
    </Box>
  )
}
