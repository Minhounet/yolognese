import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { Reading, isShake } from '../domain/shake';

const SAMPLE_EVERY_MS = 50;
const KEPT_FOR_MS = 1000;
const QUIET_AFTER_SHAKE_MS = 1500;

/** Calls onShake when the phone is shaken; does nothing where there is no accelerometer (web). */
export function useShake(onShake: () => void): void {
  const latest = useRef(onShake);
  latest.current = onShake;

  useEffect(() => {
    let readings: readonly Reading[] = [];
    let quietUntil = 0;
    let subscription: { remove(): void } | undefined;
    let stopped = false;

    Accelerometer.isAvailableAsync().then((available) => {
      if (!available || stopped) return;
      Accelerometer.setUpdateInterval(SAMPLE_EVERY_MS);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const at = Date.now();
        readings = [...readings.filter((reading) => at - reading.at < KEPT_FOR_MS), { x, y, z, at }];
        if (at < quietUntil || !isShake(readings)) return;
        quietUntil = at + QUIET_AFTER_SHAKE_MS;
        readings = [];
        latest.current();
      });
    });

    return () => {
      stopped = true;
      subscription?.remove();
    };
  }, []);
}
