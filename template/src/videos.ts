// Every walkthrough this project renders. scripts/new-walkthrough.ts maintains
// the marked blocks — keep the markers intact.
import type { Walkthrough } from './engine/types'

// <walkthrough-imports>
import { WALKTHROUGH as example } from '../videos/example/script'
// </walkthrough-imports>

export const WALKTHROUGHS: Walkthrough[] = [
  // <walkthrough-list>
  example,
  // </walkthrough-list>
]
