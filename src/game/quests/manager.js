function createQuestManager(definitions, storage) {
  const key = 'spellbound.quests.v1';
  const states = Object.create(null);
  try {
    const saved = storage.getItem(key);
    if (saved === null) {
      const legacy = storage.getItem('spellbound.quest.cauldron.v1');
      if (['active', 'ready', 'complete'].includes(legacy)) {
        states[CAULDRON_QUEST] = {
          goals: legacy === 'active' ? [] : ['cauldron-heated'],
          completed: legacy === 'complete'
        };
        save();
      }
    } else {
      const data = JSON.parse(saved);
      if (data?.version === 1) {
        for (const quest of definitions) {
          const entry = data.quests?.[quest.id];
          if (Array.isArray(entry?.goals)) {
            const goals = quest.goals.filter(goal => entry.goals.includes(goal));
            states[quest.id] = { goals, completed: entry.completed === true && goals.length === quest.goals.length };
          }
        }
      }
    }
  } catch {
    // Play this session even if storage is unavailable.
  }

  function save() {
    try { storage.setItem(key, JSON.stringify({ version: 1, quests: states })); } catch { /* Session only. */ }
  }

  function status(quest) {
    if (!quest || !quest.requires.every(id => status(definitions.find(item => item.id === id)) === 'complete')) return 'locked';
    const state = states[quest.id];
    if (!state) return 'available';
    if (state.completed) return 'complete';
    return quest.goals.every(goal => state.goals.includes(goal)) ? 'ready' : 'active';
  }

  function accept(quest) {
    if (status(quest) !== 'available') return false;
    states[quest.id] = { goals: [], completed: false };
    save();
    return true;
  }

  function record(event) {
    let changed = false;
    for (const quest of definitions) {
      if (status(quest) !== 'active' || !quest.goals.includes(event) || states[quest.id].goals.includes(event)) continue;
      states[quest.id].goals.push(event);
      changed = true;
    }
    if (changed) save();
    return changed;
  }

  function complete(quest) {
    if (status(quest) !== 'ready') return false;
    states[quest.id].completed = true;
    save();
    return true;
  }

  function reset(quest) {
    delete states[quest.id];
    save();
  }

  function forGiver(giver) {
    const quests = definitions.filter(quest => quest.giver === giver);
    for (const stage of ['ready', 'active', 'available', 'complete']) {
      const quest = quests.find(item => status(item) === stage);
      if (quest) return quest;
    }
    return undefined;
  }

  return { status, accept, record, complete, reset, forGiver };
}
