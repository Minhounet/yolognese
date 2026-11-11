import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createUseCases } from './src/compositionRoot';
import { GameScreen } from './src/ui/GameScreen';
import { Guardian } from './src/ui/Guardian';
import { Lobby } from './src/ui/Lobby';
import { THEME } from './src/ui/theme';

type Mode = 'menu' | 'solo' | 'race';

export default function App() {
  const useCases = useMemo(createUseCases, []);
  const [mode, setMode] = useState<Mode>('menu');
  const toMenu = () => setMode('menu');
  return (
    <>
      {mode === 'solo' && <GameScreen useCases={useCases} onBack={toMenu} />}
      {mode === 'race' && <Lobby useCases={useCases} onBack={toMenu} />}
      {mode === 'menu' && (
        <View style={styles.menu}>
          <Text style={styles.title}>Yolognese</Text>
          <Guardian size={160} />
          <Pressable testID="solo" accessibilityRole="button" onPress={() => setMode('solo')} style={styles.button}>
            <Text style={styles.buttonText}>Solo</Text>
          </Pressable>
          <Pressable testID="race" accessibilityRole="button" onPress={() => setMode('race')} style={styles.button}>
            <Text style={styles.buttonText}>Play friends</Text>
          </Pressable>
        </View>
      )}
      <StatusBar style="dark" />
    </>
  );
}

const styles = StyleSheet.create({
  menu: { flex: 1, backgroundColor: THEME.background, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 36, fontWeight: 'bold', color: THEME.sauce, marginBottom: 16 },
  button: { backgroundColor: THEME.sauce, borderRadius: 28, width: 220, alignItems: 'center', paddingVertical: 14, marginTop: 16 },
  buttonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
});
