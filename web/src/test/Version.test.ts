import Version from '../model/Version';

test('minimal', () => {
  expect(Version.parse('3.0')).toStrictEqual({
      preamble: '',
      major: 3,
      minor: 0,
      patch: undefined,
      postamble: ''
  });
});

test('minimal with v', () => {
  expect(Version.parse('v3.0')).toStrictEqual({
      preamble: 'v',
      major: 3,
      minor: 0,
      patch: undefined,
      postamble: ''
  });
});

test('minimal with postamble', () => {
  expect(Version.parse('v3.0-alpha')).toStrictEqual({
      preamble: 'v',
      major: 3,
      minor: 0,
      patch: undefined,
      postamble: '-alpha'
  });
});

test('full', () => {
  expect(Version.parse('v3.2.1-beta')).toStrictEqual({
      preamble: 'v',
      major: 3,
      minor: 2,
      patch: 1,
      postamble: '-beta'
  });
});
