(function () {
'use strict';

const storageKey = 'spellbound.inventory.v1';
const hotbar = document.getElementById('hotbar');
const dialog = document.getElementById('chest-inventory');
const status = document.getElementById('chest-status');
const hotbarButtons = Array.from(hotbar.querySelectorAll('[data-slot]'));
const items = { staff: { name: 'toverstaf', draw: WIZARD.drawStaffIcon } };
const chestSize = 32;

function loadInventory() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved?.hotbar) && saved.hotbar.length === hotbarButtons.length &&
        Array.isArray(saved.chest) && saved.chest.length === chestSize) {
      const contents = [...saved.hotbar, ...saved.chest];
      if (contents.every(item => item === null || Object.hasOwn(items, item)) &&
          contents.filter(item => item === 'staff').length === 1) return saved;
    }
  } catch {
    // Ook zonder browseropslag blijft de inventaris tijdens het spelen beschikbaar.
  }
  return { hotbar: ['staff', ...Array(hotbarButtons.length - 1).fill(null)], chest: Array(chestSize).fill(null) };
}

const inventory = loadInventory();
let selectedSlot = inventory.hotbar[0] === 'staff' ? 0 : null;
let source = null;

function drawSlot(button, item, label, pressed) {
  button.setAttribute('aria-label', `${label}, ${item ? items[item].name : 'leeg'}`);
  button.setAttribute('aria-pressed', String(pressed));
  const oldIcon = button.querySelector('canvas');
  if (oldIcon?.dataset.item === item) return;
  oldIcon?.remove();
  if (!item) return;
  const icon = document.createElement('canvas');
  icon.width = icon.height = 32;
  icon.className = 'item-icon';
  icon.dataset.item = item;
  icon.setAttribute('aria-hidden', 'true');
  items[item].draw(icon.getContext('2d'));
  button.append(icon);
}

function render() {
  for (const [index, button] of hotbarButtons.entries()) {
    drawSlot(button, inventory.hotbar[index], `Hotbarplek ${index + 1}`, selectedSlot === index);
  }
  hotbar.dataset.selectedSlot = selectedSlot === null ? '' : String(selectedSlot + 1);
  WIZARD.staffEquipped = inventory.hotbar[selectedSlot] === 'staff';
  for (const slot of chestButtons) {
    drawSlot(slot.button, inventory[slot.area][slot.index], slot.label, source === slot);
  }
}

function storeInventory() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(inventory));
  } catch {
    // Verplaatsen blijft werken als de browser opslag blokkeert.
  }
}

function useChestSlot(slot) {
  const item = inventory[slot.area][slot.index];
  if (source === slot) {
    source = null;
    status.textContent = 'Selectie opgeheven.';
  } else if (source) {
    const moved = inventory[source.area][source.index];
    inventory[slot.area][slot.index] = moved;
    inventory[source.area][source.index] = item;
    source = null;
    storeInventory();
    status.textContent = `${items[moved].name} verplaatst naar ${slot.label}.`;
  } else if (item) {
    source = slot;
    status.textContent = `${items[item].name} geselecteerd. Kies een vakje.`;
  }
  render();
}

function makeSlots(area, container) {
  return inventory[area].map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inventory-slot';
    const label = `${area === 'chest' ? 'Kistvak' : 'Hotbarplek'} ${index + 1}`;
    const slot = { area, index, button, label };
    button.addEventListener('click', () => useChestSlot(slot));
    container.append(button);
    return slot;
  });
}

const chestButtons = [
  ...makeSlots('chest', document.getElementById('chest-slots')),
  ...makeSlots('hotbar', document.getElementById('chest-hotbar'))
];

function selectSlot(index) {
  selectedSlot = selectedSlot === index ? null : index;
  render();
}

for (const [index, button] of hotbarButtons.entries()) {
  button.addEventListener('click', () => selectSlot(index));
}

addEventListener('keydown', event => {
  if (dialog.open || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const match = /^(?:Digit|Numpad)([1-6])$/.exec(event.code);
  if (!match) return;
  event.preventDefault();
  selectSlot(Number(match[1]) - 1);
});

dialog.addEventListener('close', () => {
  source = null;
  status.textContent = '';
  render();
  document.getElementById('scene').focus({ preventScroll: true });
});

render();
})();
