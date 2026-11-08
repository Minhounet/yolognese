import { Pressable, StyleSheet, Text } from 'react-native';
import { Item, ItemKind } from '../domain/items';

export const ITEM_ICONS: Readonly<Record<ItemKind, string>> = {
  food: '🍝',
  smoke: '💨',
  xray: '👓',
  hourglass: '⏳',
  charm: '🍀',
  present: '🎁',
};

const LEFT_MARGIN_PERCENT = 5;
const LEFT_SPAN_PERCENT = 80;
const TOP_MARGIN_PERCENT = 32; // below the secret row, so an item never covers a peg
const TOP_SPAN_PERCENT = 34;
const PERCENT = 100;

/** An item lying at its spot (percent of the play area); a tap collects it. */
export function ItemSprite({
  item,
  onCollect,
  onTouchStart,
}: {
  readonly item: Item;
  readonly onCollect: () => void;
  readonly onTouchStart?: () => void;
}) {
  const left = `${LEFT_MARGIN_PERCENT + (item.spot.x * LEFT_SPAN_PERCENT) / PERCENT}%` as const;
  const top = `${TOP_MARGIN_PERCENT + (item.spot.y * TOP_SPAN_PERCENT) / PERCENT}%` as const;
  return (
    <Pressable
      testID="item"
      accessibilityRole="button"
      accessibilityLabel={`item ${item.kind}`}
      onPress={onCollect}
      onTouchStart={onTouchStart}
      style={[styles.item, { left, top }]}
    >
      <Text style={styles.icon}>{ITEM_ICONS[item.kind]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { position: 'absolute', padding: 6, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.7)' },
  icon: { fontSize: 30 },
});
