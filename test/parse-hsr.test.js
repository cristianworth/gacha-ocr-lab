import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretHsrRegions } from '../src/parse-hsr.js';

const rectangle = { left: 10, top: 20, width: 100, height: 30 };
const region = (...texts) => ({ rectangle, attempts: texts.map((rawText, index) => ({ id: `fixed-${index}`, rawText, confidence: 50 })) });
const pathText = 'The following effects only work on characters of the Path of Destruction.';
function input() {
  return {
    name: region('Example Light Cone', 'Example Light Cone'),
    level: region('Lv. 80/80', 'Lv. 80/80'),
    superimposition: region('Superimposition 5', 'Superimposition 5'),
    path: region(pathText),
  };
}

test('HSR fields preserve independent superimposition, multiline names, and raw regional evidence', () => {
  const regions = input();
  regions.name = region('“Example\nLight Cone”', '"Example Light Cone"');
  const result = interpretHsrRegions(regions);
  assert.equal(result.layoutVerified, true);
  assert.deepEqual(Object.keys(result.fields), ['name', 'level', 'superimposition']);
  assert.equal(result.fields.name.value, '"Example Light Cone"');
  assert.deepEqual(result.fields.level.value, { current: 80, max: 80 });
  assert.equal(result.fields.superimposition.value, 5);
  assert.ok(Object.values(result.fields).every((field) => field.status === 'recognized'));
  const evidence = result.fields.name.candidates[0].evidence[0];
  assert.deepEqual(evidence, { region: 'name', attempt: 'fixed-0', rawText: '“Example\nLight Cone”', rectangle });
  assert.match(result.fields.name.reason, /revisao humana/u);
});

test('HSR absent and uncertain fields remain distinct without filling values', () => {
  const regions = input();
  regions.name = region('', '  \n');
  regions.level = region('Lv. 8O/80', 'Lv. 8O/80');
  regions.superimposition = region('Superimposition S', 'Superimposition S');
  const { fields } = interpretHsrRegions(regions);
  assert.equal(fields.name.status, 'absent');
  assert.equal(fields.level.status, 'uncertain');
  assert.equal(fields.superimposition.status, 'uncertain');
  assert.ok(Object.values(fields).every((field) => field.value === null));
  assert.equal(fields.level.candidates[0].evidence[0].rawText, 'Lv. 8O/80');
  assert.ok(fields.level.candidates.every((candidate) => candidate.valid === false));
});

test('HSR consensus requires two valid readings and never votes by confidence or majority', () => {
  for (const texts of [['Lv. 80/80', ''], ['Lv. 80/80', 'Lv. 70/80'], ['Lv. 80/80', 'Lv. 80/80', 'Lv. 70/80']]) {
    const regions = input();
    regions.level = region(...texts);
    regions.level.attempts[0].confidence = 100;
    const level = interpretHsrRegions(regions).fields.level;
    assert.equal(level.status, 'uncertain');
    assert.equal(level.value, null);
  }
  const regions = input();
  regions.name.attempts.forEach((attempt) => { attempt.confidence = 0; });
  assert.equal(interpretHsrRegions(regions).fields.name.status, 'recognized');
});

test('HSR level accepts visible limits up to 80 and preserves an invisible maximum as null', () => {
  for (const [text, expected] of [
    ['Lv. 1/20', { current: 1, max: 20 }],
    ['Lv. 80/80', { current: 80, max: 80 }],
    ['Lv. 70', { current: 70, max: null }],
    ['Lv 20 / 30', { current: 20, max: 30 }],
  ]) {
    const regions = input();
    regions.level = region(text, text);
    assert.deepEqual(interpretHsrRegions(regions).fields.level.value, expected);
  }
  for (const text of ['Lv. 90/90', 'Lv. 80/90', 'Lv. 81/81', 'Lv. 0/20', 'Lv. 80/70', 'Lv. 8O/80',
    'Lv. 80/', 'Lv. 80/80 extra', 'Lv. 80/80 3', '80/80', 'Level 80/80']) {
    const regions = input();
    regions.level = region(text, text);
    const field = interpretHsrRegions(regions).fields.level;
    assert.equal(field.status, 'uncertain', text);
    assert.equal(field.value, null, text);
  }
});

test('HSR superimposition requires its complete label and never derives values from roman icons', () => {
  for (const text of ['Superimposition 1', 'Superimposition 5']) {
    const regions = input();
    regions.superimposition = region(text, text);
    assert.equal(interpretHsrRegions(regions).fields.superimposition.value, Number(text.at(-1)));
  }
  for (const text of ['I', 'V', 'IV Superimposition 4', 'V\nSuperimposition 5', 'Superimposition V',
    'Superimposition 0', 'Superimposition 6', 'Superimposition 1/5', 'Superimposition 5 extra',
    'Refinement Rank 5', '5', 'Superimposition']) {
    const regions = input();
    regions.superimposition = region(text, text);
    assert.equal(interpretHsrRegions(regions).fields.superimposition.value, null, text);
    assert.equal(interpretHsrRegions(regions).fields.superimposition.status, 'uncertain', text);
  }
});

test('HSR superimposition does not consume a Genshin refinement region', () => {
  const regions = input();
  regions.refinement = region('Refinement Rank 5', 'Refinement Rank 5');
  regions.superimposition = region('Superimposition 2', 'Superimposition 2');
  assert.equal(interpretHsrRegions(regions).fields.superimposition.value, 2);
  delete regions.superimposition;
  const { fields } = interpretHsrRegions(regions);
  assert.equal(fields.superimposition.status, 'absent');
  assert.equal(fields.superimposition.value, null);
  assert.equal('refinement' in fields, false);
});

test('HSR path anchor requires the complete phrase but does not assume a universal path catalog', () => {
  for (const text of [pathText,
    'The following effects only work on characters\nof the Path of The Hunt.',
    'The following effects only work on characters of the Path of Future Studies.']) {
    const regions = input();
    regions.path = region(text);
    assert.equal(interpretHsrRegions(regions).layoutVerified, true, text);
  }
  for (const text of ['', 'Destruction', 'Path of Destruction',
    'The following effects only work on characters of the Path of Destruction',
    'The following effects only work on characters of the Path of .',
    'The following effects only work on characters of the Path of 5.',
    `${pathText} extra`, `Other text ${pathText}`]) {
    const regions = input();
    regions.path = region(text);
    const result = interpretHsrRegions(regions);
    assert.equal(result.layoutVerified, false, text);
    assert.ok(Object.values(result.fields).every((field) => field.status === 'uncertain' && field.value === null), text);
    assert.ok(result.fields.level.candidates.every((candidate) => candidate.valid));
  }
});

test('HSR name rules keep typography normalization and reject unsupported name characters', () => {
  const regions = input();
  regions.name = region('Écho d’Essai', "E\u0301cho d'Essai");
  assert.equal(interpretHsrRegions(regions).fields.name.value, "Écho d'Essai");
  for (const text of ['12345', '<Example>', 'Example / Cone', 'a'.repeat(121)]) {
    regions.name = region(text, text);
    assert.equal(interpretHsrRegions(regions).fields.name.status, 'uncertain', text);
  }
});

test('HSR missing regions produce absent diagnostics without borrowing values', () => {
  const result = interpretHsrRegions({});
  assert.equal(result.layoutVerified, false);
  for (const field of Object.values(result.fields)) {
    assert.equal(field.status, 'absent');
    assert.equal(field.value, null);
    assert.deepEqual(field.candidates, []);
  }
});
