import { Reading, isShake } from '../../src/domain/shake';

const still = (at: number): Reading => ({ x: 0, y: 0, z: 1, at });
const jolt = (at: number): Reading => ({ x: 2.5, y: 0.5, z: 1, at });

describe('isShake', () => {
  it('shouldNotDetectShake_whenPhoneIsStill', () => {
    const readings = [still(0), still(100), still(200), still(300)];

    expect(isShake(readings)).toBe(false);
  });

  it('shouldDetectShake_whenThreeJoltsWithinOneSecond', () => {
    const readings = [still(0), jolt(100), still(200), jolt(400), still(500), jolt(800)];

    expect(isShake(readings)).toBe(true);
  });

  it('shouldNotDetectShake_whenJoltsAreTooFarApart', () => {
    const readings = [jolt(0), still(500), jolt(900), still(1200), jolt(1600)];

    expect(isShake(readings)).toBe(false);
  });

  it('shouldNotDetectShake_whenOnlyTwoJolts', () => {
    const readings = [still(0), jolt(100), still(200), jolt(300)];

    expect(isShake(readings)).toBe(false);
  });

  it('shouldDetectShake_whenBurstFollowsLoneJolt', () => {
    const readings = [jolt(0), still(800), jolt(1500), jolt(1700), jolt(1900)];

    expect(isShake(readings)).toBe(true);
  });

  it('shouldNotDetectShake_whenOneLongBump', () => {
    const readings = [still(0), jolt(50), jolt(100), jolt(150), still(200)];

    expect(isShake(readings)).toBe(false);
  });
});
