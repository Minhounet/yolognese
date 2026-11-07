import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { createUseCases } from './src/compositionRoot';
import { GameScreen } from './src/ui/GameScreen';

export default function App() {
  const useCases = useMemo(createUseCases, []);
  return (
    <>
      <GameScreen useCases={useCases} />
      <StatusBar style="dark" />
    </>
  );
}
