var { exec } = require('child_process');
var fs = require('fs');

const TEST_DIR = 'test/';
const ACTUAL_FILE_NAME = '/actual.spec.ts';
const EXPECTED_FILE_NAME = '/expected.spec.ts';

const TEST_CASES = [
  'arrow-function',
  'deep-nesting',
  'else-if',
  'function-explicit-else',
  'function-implicit-else',
  'implicit-public-method',
  'member-arrow-function',
  'multiple-functions',
  'private-method',
  'protected-method',
  'public-method',
];

// REMOVE PREVIOUSLY GENERATED FILES

TEST_CASES
  .forEach(testCase => {
    try {
      fs.unlinkSync(TEST_DIR + testCase + ACTUAL_FILE_NAME);
    } catch (_) {}
  });

// GENERATE AGAIN

exec('node ./dist/main.js -- --test-private --test-protected --root=\'test/\'', (_err, _stdout, _stderr) => {

  // ASSERTIONS

  TEST_CASES
    .forEach(testCase => {
      let actualContent = '';
      let expectedContent = '';
      
      try {
        actualContent = fs.readFileSync(TEST_DIR + testCase + ACTUAL_FILE_NAME, 'utf-8');
      } catch (_) {}

      try {
        expectedContent = fs.readFileSync(TEST_DIR + testCase + EXPECTED_FILE_NAME, 'utf-8');
      } catch (_) {}

      const isTestSuccessful = actualContent === expectedContent;

      console.log(`${ isTestSuccessful ? '✅' : '❌' }  ${ testCase }`);
    });
});
