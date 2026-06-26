import { SegmentedControl } from '@radix-ui/themes'

const LETTERS = ['S', 'A', 'B', 'C', 'D']

interface RatingBubblesProps {
  rating: string
  onRate: (rating: string) => void
}

// SABCD bubbles, left to right, best to worst.
export default function RatingBubbles({ rating, onRate }: RatingBubblesProps) {
  return (
    <SegmentedControl.Root size="1" value={rating} onValueChange={onRate}>
      {LETTERS.map(letter => (
        <SegmentedControl.Item key={letter} value={letter}>{letter}</SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  )
}
