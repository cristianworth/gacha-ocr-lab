import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWeapon } from '../src/parse-weapon.js';

// These strings exercise interpretation rules, not OCR accuracy on game screenshots.
test('extracts explicit Portuguese labels and preserves accented names', () => {
  const fields = parseWeapon('Nome da arma: Espada de Estudo\nNível 80/90\nRank de Refinamento 3');
  assert.equal(fields.name.status, 'recognized');
  assert.equal(fields.name.value, 'Espada de Estudo');
  assert.deepEqual(fields.level.value, { current: 80, max: 90 });
  assert.equal(fields.refinement.value, 3);
  assert.equal(fields.refinement.candidates[0].evidence[0].line, 3);
});

test('extracts English labels without assuming an invisible maximum level', () => {
  const fields = parseWeapon('Weapon Name: Test Sword\nLv. 80\nRefinement Rank\n2');
  assert.deepEqual(fields.level.value, { current: 80, max: null });
  assert.equal(fields.refinement.value, 2);
  assert.equal(fields.refinement.candidates[0].evidence.length, 2);
});

test('suggests visible name before weapon type only as uncertain', () => {
  const fields = parseWeapon('Espada de Estudo\nEspada\nATQ Básico 510\nNv. 80/90');
  assert.equal(fields.name.status, 'uncertain');
  assert.equal(fields.name.value, null);
  assert.equal(fields.name.candidates[0].value, 'Espada de Estudo');
  assert.equal(fields.level.value.current, 80);
  assert.equal(fields.refinement.status, 'absent');
});

test('does not promote a menu label or generic first line to a weapon name', () => {
  assert.equal(parseWeapon('Armas\nEspada').name.status, 'absent');
  assert.equal(parseWeapon('Mystery header\nATK 500').name.status, 'absent');
});

test('empty and unrelated text produce absent fields', () => {
  for (const input of ['', 'ATQ Básico 510\nTaxa Crítica 27.6%\nUID 123456789']) {
    assert.deepEqual(Object.values(parseWeapon(input)).map((field) => field.status), ['absent', 'absent', 'absent']);
  }
});

test('conflicting values stay uncertain; repeated identical values are allowed', () => {
  const fields = parseWeapon('Lv. 80/90\nLv. 70/80\nRefinement Rank 2\nRefinement Rank 4');
  assert.equal(fields.level.status, 'uncertain');
  assert.equal(fields.level.value, null);
  assert.equal(fields.refinement.status, 'uncertain');
  assert.equal(parseWeapon('Lv. 80/90\nLv. 80/90').level.status, 'recognized');
});

test('ambiguous OCR digits are preserved, never repaired into invented numbers', () => {
  for (const value of ['8O/90', '90/9O', '90/', '0/90', '91/90', '80/70']) {
    const field = parseWeapon(`Lv. ${value}`).level;
    assert.equal(field.status, 'uncertain', value);
    assert.equal(field.value, null);
    assert.equal(field.candidates[0].evidence[0].text, `Lv. ${value}`);
  }
  for (const value of ['S', '0', '6', '']) {
    assert.equal(parseWeapon(`Refinement Rank ${value}`).refinement.status, 'uncertain');
  }
});

test('supports CRLF, blank lines and labels on separate lines', () => {
  const fields = parseWeapon('\r\nNív.\r\n\r\n80 / 90\r\nGrau de Refinamento: 5');
  assert.deepEqual(fields.level.value, { current: 80, max: 90 });
  assert.equal(fields.refinement.value, 5);
  assert.equal(fields.level.candidates[0].evidence[1].line, 4);
});

test('name conflicts and empty name label remain uncertain', () => {
  assert.equal(parseWeapon('Weapon Name: Alpha\nWeapon Name: Beta').name.status, 'uncertain');
  assert.equal(parseWeapon('Nome da arma:').name.status, 'uncertain');
});

test('English weapon panel without a name label preserves name as an uncertain candidate', () => {
  const fields = parseWeapon('Test Sword\nSword\nBase ATK 510\nLv. 80/90\nRefinement Rank 3');
  assert.equal(fields.name.status, 'uncertain');
  assert.equal(fields.name.value, null);
  assert.equal(fields.name.candidates[0].value, 'Test Sword');
  assert.deepEqual(fields.level.value, { current: 80, max: 90 });
  assert.equal(fields.refinement.value, 3);
});
