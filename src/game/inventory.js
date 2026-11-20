(function () {
'use strict';

const storageKey = 'spellbound.inventory.v1';
const hotbar = document.getElementById('hotbar');
const dialog = document.getElementById('chest-inventory');
const status = document.getElementById('chest-status');
const hotbarButtons = Array.from(hotbar.querySelectorAll('[data-slot]'));
const items = {
  staff: { name: 'wand', draw: WIZARD.drawStaffIcon },
  greenPotion: { name: 'Green Potion', draw: drawGreenPotion }
};
const stockLoot = ['greenPotion'];

function drawGreenPotion(g) {
  for (const [color, x, y, width, height] of [
    ['#232337', 10, 4, 12, 5], ['#232337', 12, 9, 8, 5], ['#232337', 8, 14, 16, 13],
    ['#b88752', 12, 5, 8, 3], ['#99c7b3', 13, 9, 6, 6], ['#99c7b3', 9, 15, 14, 10],
    ['#44865a', 10, 18, 12, 7], ['#82c966', 10, 18, 12, 2], ['#c9f5bc', 11, 16, 2, 6]
  ]) {
    g.fillStyle = color;
    g.fillRect(x, y, width, height);
  }
}
const chestSize = 40;

function loadInventory() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved?.hotbar) && saved.hotbar.length === hotbarButtons.length &&
        Array.isArray(saved.chest) && (saved.chest.length === 32 || saved.chest.length === chestSize)) {
      const contents = [...saved.hotbar, ...saved.chest];
      if (contents.every(item => item === null || Object.hasOwn(items, item)) &&
          contents.filter(item => item === 'staff').length === 1) {
        return {
          hotbar: saved.hotbar,
          chest: [...saved.chest, ...Array(chestSize - saved.chest.length).fill(null)],
          stock: stockLoot.map((item, index) => saved.stock?.[index] === null ? null : item)
        };
      }
    }
  } catch {
    // Ook zonder browseropslag blijft de inventaris tijdens het spelen beschikbaar.
  }
  return { hotbar: Array(hotbarButtons.length).fill(null), chest: ['staff', ...Array(chestSize - 1).fill(null)], stock: [...stockLoot] };
}

const inventory = loadInventory();
let selectedSlot = inventory.hotbar[0] === 'staff' ? 0 : null;
let source = null;
const isStockChest = () => dialog.dataset.stockChest === 'true';
const hasStockLoot = () => inventory.stock.some(Boolean);

function drawSlot(button, item, label, pressed) {
  button.setAttribute('aria-label', `${label}, ${item ? items[item].name : 'empty'}`);
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
    drawSlot(button, inventory.hotbar[index], `Hotbar slot ${index + 1}`, selectedSlot === index);
  }
  hotbar.dataset.selectedSlot = selectedSlot === null ? '' : String(selectedSlot + 1);
  hotbar.dataset.hasWand = String(inventory.hotbar.includes('staff'));
  WIZARD.staffEquipped = inventory.hotbar[selectedSlot] === 'staff';
  for (const slot of chestButtons) {
    const stock = isStockChest();
    slot.button.hidden = stock && (slot.area !== 'chest' || slot.index >= inventory.stock.length);
    const item = stock ? inventory.stock[slot.index] : inventory[slot.area][slot.index];
    slot.button.disabled = stock && !item;
    drawSlot(slot.button, item, stock && item ? 'Take item' : slot.label, source === slot);
  }
  document.getElementById('chest-title').textContent = isStockChest() ? 'Stockroom Chest' : 'Chest';
  if (isStockChest()) status.textContent = hasStockLoot() ? 'Select an item to take it.' : 'The chest is empty.';
}

function storeInventory() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(inventory));
  } catch {
    // Verplaatsen blijft werken als de browser opslag blokkeert.
  }
}

function takeStockItem(slot) {
  if (slot.area !== 'chest') return;
  const item = inventory.stock[slot.index];
  if (!item) return;
  const emptySlot = inventory.hotbar.indexOf(null);
  if (emptySlot === -1) {
    status.textContent = 'Your hotbar is full.';
    return;
  }
  inventory.hotbar[emptySlot] = item;
  inventory.stock[slot.index] = null;
  storeInventory();
  render();
  const message = hasStockLoot() ? '' : ' The chest is empty.';
  status.textContent = `${items[item].name} added to your hotbar.${message}`;
  document.getElementById('close-chest-inventory').focus();
}

function useChestSlot(slot) {
  if (isStockChest()) {
    takeStockItem(slot);
    return;
  }
  const item = inventory[slot.area][slot.index];
  if (source === slot) {
    source = null;
    status.textContent = 'Selection cleared.';
  } else if (source) {
    const moved = inventory[source.area][source.index];
    inventory[slot.area][slot.index] = moved;
    inventory[source.area][source.index] = item;
    source = null;
    storeInventory();
    status.textContent = `${items[moved].name} moved to ${slot.label}.`;
  } else if (item) {
    source = slot;
    status.textContent = `${items[item].name} selected. Choose a slot.`;
  }
  render();
}

function makeSlots(area, container) {
  return inventory[area].map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inventory-slot';
    const label = `${area === 'chest' ? 'Chest slot' : 'Hotbar slot'} ${index + 1}`;
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
  if (dialog.open && event.key === 'Escape') {
    event.preventDefault();
    dialog.close();
    return;
  }
  if (dialog.open || document.getElementById('quest-dialogue').open || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const match = /^(?:Digit|Numpad)([1-6])$/.exec(event.code);
  if (!match) return;
  event.preventDefault();
  selectSlot(Number(match[1]) - 1);
});

document.getElementById('close-chest-inventory').addEventListener('click', () => dialog.close());

dialog.addEventListener('close', () => {
  if (dialog.open) return;
  source = null;
  status.textContent = '';
  render();
  document.getElementById('scene').focus({ preventScroll: true });
});

window.CHEST_INVENTORY = {
  hasStockLoot,
  open(stockChest) {
    source = null;
    dialog.dataset.stockChest = String(stockChest);
    status.textContent = '';
    render();
    dialog.show();
  }
};

render();
})();
