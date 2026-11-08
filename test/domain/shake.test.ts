import { Reading, isShake } from '../../src/domain/shake';

const still = (at: number): Reading => ({ x: 0, y: 0, z: 1, at });

describe('isShake', () => {
  it('shouldNotDetectShake_whenPhoneIsStill', () => {
    const readings = [still(0), still(100), still(200), still(300)];

    expect(isShake(readings)).toBe(false);
  });
});
