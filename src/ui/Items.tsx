import { Pressable, StyleSheet, Text } from 'react-native';
import { ItemView } from '../application/views';
import { ItemKind } from '../domain/round';

export const ITEM_EMOJI: Readonly<Record<ItemKind, string>> = {
  food: '🍝',
  smoke: '💨',
  xray: '👓',
  hourglass: '⏳',
  charm: '🧿',
  present: '🎁',
};

const SIZE = 48;

/** The items on the scene, placed by fractions of its size; a tap collects one. */
export function Items({ items, width, height, onCollect }: {
  readonly items: readonly ItemView[];
  readonly width: number;
  readonly height: number;
  readonly onCollect: (id: number) => void;
}) {
  return (
    <>
      {items.map((item) => (
        <Pressable
          key={item.id}
          testID={`item-${item.kind}`}
          accessibilityLabel={`${item.kind} item`}
          onPress={() => onCollect(item.id)}
          style={[styles.item, { left: item.x * width - SIZE / 2, top: item.y * height - SIZE / 2 }]}
        >
          <Text style={styles.emoji}>{ITEM_EMOJI[item.kind]}</Text>
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  item: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbe9',
    borderWidth: 2,
    borderColor: '#f9a825',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  emoji: { fontSize: 26 },
});
