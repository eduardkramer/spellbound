const CAULDRON_QUEST = 'fire-beneath-the-cauldron';
const PAGE_QUEST = 'the-missing-page';
// Keep IDs stable. A goal ID must match the event reported by the scene.
const QUEST_DEFINITIONS = [
  {
    id: CAULDRON_QUEST,
    giver: 'skeleton-mage',
    title: 'Fire Beneath the Cauldron',
    requires: [],
    goals: ['cauldron-heated'],
    offer: 'The cauldron has gone cold. Retrieve your wand from the chest in the main room, then use your fire spell to heat it.',
    remind: ({ hasWand }) => hasWand
      ? 'Equip your wand, face the cauldron and hold Q until the flames catch.'
      : 'Your wand is in the chest in the main room. Move it into your hotbar.',
    objective: ({ hasWand }) => hasWand
      ? 'Equip your wand and hold Q to heat the cauldron.'
      : 'Retrieve your wand from the chest in the main room.',
    turnIn: 'The fire has caught! Now I can finish the brew. Thank you, wizard.',
    returnTo: 'Speak to the Skeleton Mage.'
  },
  {
    id: PAGE_QUEST,
    giver: 'skeleton-mage',
    title: 'The Missing Page',
    requires: [CAULDRON_QUEST],
    goals: ['missing-page-found'],
    offer: 'The cauldron is warm, but the last page of my recipe is missing. Look for a stack of books beside an old chair near the far end of the stockroom.',
    remind: () => 'Look for a stack of books beside an old chair near the far end of the stockroom. Search the stack for a loose page.',
    objective: () => 'Search the book stack beside the old chair in the stockroom.',
    turnIn: 'There it is! I can put this page back in the recipe book and finish the brew.',
    returnTo: 'Return the missing page to the Skeleton Mage.'
  }
];
