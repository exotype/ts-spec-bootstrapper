import { tsquery } from '@phenomnomnominal/tsquery';
import { PRIVATE_METHOD_MODIFIER, SPACER, PROTECTED_METHOD_MODIFIER } from './constants';
import { Renderer } from './renderer';
import { ASTNode, TestBranch, FunctionToTest, ScriptConfiguration, Statistics } from './types';
import { ConfigReader } from './config-reader';
import { FileFinder } from './file-finder';

const fs = require('fs');

const CONFIG: ScriptConfiguration = ConfigReader.getScriptConfig();
const STATS: Statistics = {
  filesRead: 0,
  arrowFunctions: 0,
  functions: 0,
  methods: 0,

  thenBranches: 0,
  elseBranches: 0,
  elseIfBranches: 0,
  implicitElseBranches: 0,

  filesWritten: 0,
  testsWritten: 0,

  skipsBecausePrivate: 0,
  skipsBecauseProtected: 0,
  skipsBecauseTested: 0,

  started: Date.now(),
};

const deepTraverseBlock = (node: ASTNode, indent: string, conditions: Array<string>, lastCondition: string): Array<TestBranch> => {
  const branches: Array<TestBranch> = [];

  tsquery
    .query(node, 'IfStatement > Block > IfStatement')
    .map((match: ASTNode) => {
      const nestedBranches: Array<TestBranch> = deepTraverseConditionals(match, indent, conditions);
      branches.push({ condition: lastCondition, branches: nestedBranches });
    });

  return branches;
};

const deepTraverseConditionals = (node: ASTNode, previousIndent: string, previousConditions: Array<string>): Array<TestBranch> => {
  const indent = previousIndent + SPACER;
  const conditions: Array<string> = [ ...previousConditions ];
  const condition = node.expression.text;
  const negatedCondition: string = `!(${ condition })`;
  const hasElseStatement = Boolean(node.elseStatement);
  const hasThenStatement = Boolean(node.thenStatement);
  const branches: Array<TestBranch> = [];

  if (hasThenStatement) {
    // THEN BRANCH
    STATS.thenBranches++;
    const branchesInThen: Array<TestBranch> = deepTraverseBlock(node.thenStatement, indent, [ ...conditions, condition ], condition);
    branches.push({ condition: condition, branches: branchesInThen });
  }

  if (hasElseStatement) {
    if (node.elseStatement.kindName === 'IfStatement') {
      // ELSE BRANCH TYPE: ELSE IF
      STATS.elseIfBranches++;
      const branchesInElseIf: Array<TestBranch> = deepTraverseConditionals(node.elseStatement, indent, [ ...conditions, negatedCondition ]);
      branches.push({ condition: negatedCondition, branches: branchesInElseIf });
    } else if (node.elseStatement.kindName === 'Block') {
      // ELSE BRANCH TYPE: ELSE
      STATS.elseBranches++;
      const branchesInElse: Array<TestBranch> = deepTraverseBlock(node.elseStatement, indent, [ ...conditions, negatedCondition ], negatedCondition);
      branches.push({ condition: negatedCondition, branches: branchesInElse });
    }
  } else {
    // ELSE BRANCH TYPE: IMPLICIT ELSE
    STATS.implicitElseBranches++;
    branches.push({ condition: negatedCondition, branches: [] });
  }

  return branches;
};

const functionTestExistsInSpecContent = (fnName: string, specContent: string): boolean => {
  const expression = `[x,f]{0,1}describe\\\([',",\\\`]{1}[#]{0,1}(${ fnName })`;
  const regExp = new RegExp(expression, 'i');
  return specContent.match(regExp) !== null;
};

const findInFunction = (node: ASTNode, ifStatementSelector: string): Array<TestBranch> => {
  const branches: Array<TestBranch> = [];

  tsquery
    .query(node, ifStatementSelector)
    .forEach((match: ASTNode) => {
      const branchesInNode: Array<TestBranch> = deepTraverseConditionals(match, '', []);
      branches.push(...branchesInNode);
    });

  return branches;
};

const handleMethodDeclaration = (node: ASTNode, specContent: string): FunctionToTest => {
  STATS.methods++;

  const isPrivate = Boolean(node.modifiers && node.modifiers.find((m: ASTNode) => m.kindName === PRIVATE_METHOD_MODIFIER));
  const isProtected = Boolean(node.modifiers && node.modifiers.find((m: ASTNode) => m.kindName === PROTECTED_METHOD_MODIFIER));
  const isTested = functionTestExistsInSpecContent(node.name.name, specContent);

  let branches: Array<TestBranch> = [];

  if (isPrivate && !CONFIG.testPrivate) {
    STATS.skipsBecausePrivate++;
  } else if (isProtected && !CONFIG.testProtected) {
    STATS.skipsBecauseProtected++;
  } else {
    branches = findInFunction(node, 'MethodDeclaration > Block > IfStatement');
  }

  return {
    name: node.name.name,
    isPrivate,
    isTested,
    branches,
  };
};

const handleArrowFunction = (node: ASTNode, specContent: string): FunctionToTest | null => {
  STATS.arrowFunctions++;

  const isValidArrowFunctionContext = Boolean(
    node.parent.kindName === 'VariableDeclaration'
    || node.parent.kindName === 'PropertyDeclaration'
  );

  if (!isValidArrowFunctionContext) {
    return null;
  }

  const isPrivate = Boolean(node.parent.modifiers && node.parent.modifiers.find((m: ASTNode) => m.kindName === PRIVATE_METHOD_MODIFIER));
  const isProtected = Boolean(node.parent.modifiers && node.parent.modifiers.find((m: ASTNode) => m.kindName === PROTECTED_METHOD_MODIFIER));
  const isTested = functionTestExistsInSpecContent(node.parent.name.name, specContent);

  let branches: Array<TestBranch> = [];

  if (isPrivate && !CONFIG.testPrivate) {
    STATS.skipsBecausePrivate++;
  } else if (isProtected && !CONFIG.testProtected) {
    STATS.skipsBecauseProtected++;
  } else {
    branches = findInFunction(node, 'ArrowFunction > Block > IfStatement');
  }

  return {
    name: node.parent.name.name,
    isPrivate,
    isTested,
    branches,
  };
};

const handleFunctionDeclaration = (node: ASTNode, specContent: string): FunctionToTest => {
  STATS.functions++;

  // note: functions outside classes. no private/public modifier possible

  const branches: Array<TestBranch> = findInFunction(node, 'FunctionDeclaration > Block > IfStatement');
  const isTested = functionTestExistsInSpecContent(node.name.name, specContent);

  return {
    name: node.name.name,
    isPrivate: false,
    isTested,
    branches,
  };
};

const sanitizeBranch = (branch: TestBranch): TestBranch => {
  // note: branches in duplicated conditions will be merged down one level
  // this is necessary because the generated tree creates these nested duplicated conditions in some cases

  // "branches": [
  //   {
  //     "condition": "this.c1",
  //     "branches": [
  //       {
  //         "condition": "this.c1", // DUPLICATED CONDITION
  //         "branches": [
  //           { "condition": "this.c2", "branches": [] },
  //           { "condition": "!(this.c2)", "branches": [] }
  //         ]
  //       }
  //     ]

  const validBranches: Array<TestBranch> = [];

  branch.branches
    .forEach((b: TestBranch) => {
      if (b.condition === branch.condition) {
        validBranches.push(...b.branches);

        if (CONFIG.verboseMode) {
          Renderer.warn(`Sanitized duplicated condition: ${ branch.condition }`);
        }
      } else {
        validBranches.push(b);
      }
    });

  return {
    ...branch,
    branches: validBranches.map((b: TestBranch) => sanitizeBranch(b)),
  };
};

const getTestTreeForFile = (content: string, specContent: string): Array<FunctionToTest> => {
  const tree: Array<FunctionToTest> = [];

  tsquery
    .query(tsquery.ast(content), 'MethodDeclaration, FunctionDeclaration, ArrowFunction')
    .forEach((node: ASTNode) => {
      let fn: any; // type is Fn

      if (node.kindName === 'MethodDeclaration') {
        fn = handleMethodDeclaration(node, specContent);
      } else if (node.kindName === 'ArrowFunction') {
        fn = handleArrowFunction(node, specContent);
      } else if (node.kindName === 'FunctionDeclaration') {
        fn = handleFunctionDeclaration(node, specContent);
      }

      if (fn) {
        tree.push({
          ...fn,
          branches: fn.branches.map((branch: TestBranch) => sanitizeBranch(branch)),
        });
      }
    });

  return tree;
};

const getIndentedTestString = (indent: string): string => {
  STATS.testsWritten++;

  const lines = [
    `xit(\`should be implemented\`, () => {`,
    ...CONFIG.itContent.split(`\n`).map((line: string): string => `${ SPACER }${ line }`),
    `});`,
  ];

  const indentedLines = lines.map((line: string): string => `${ indent }${ line }`);

  return `\n` + indentedLines.join(`\n`) + `\n`;
};

const getIndentedTestForBranch = (indent: string, branch: TestBranch): string => {
  let textForBranch = `\n${ indent }describe(\`when (${ branch.condition })\`, () => {`;

  if (branch.branches.length === 0) {
    textForBranch += getIndentedTestString(indent + SPACER);
  } else {
    branch.branches
      .forEach((subBranch: TestBranch) => {
        textForBranch += getIndentedTestForBranch(indent + SPACER, subBranch);
      });
  }

  textForBranch += `${ indent }});\n`;

  return textForBranch;
};

const getIndentedTestForFunction = (fn: FunctionToTest): string => {
  let textForFn = `\ndescribe(\`${ fn.name }\`, () => {`;

  if (fn.branches.length === 0) {
    textForFn += getIndentedTestString(SPACER);
  } else {
    fn.branches
      .forEach((branch: TestBranch) => {
        textForFn += getIndentedTestForBranch(SPACER, branch);
      });
  }

  textForFn += `});\n`;

  return textForFn;
};

const applySkippedTestsFilter = (fn: FunctionToTest): boolean => {
  if (fn.isTested) {
    STATS.skipsBecauseTested++;
    return false;
  } else {
    return true;
  }
};

const applyPrivateTestsFilter = (fn: FunctionToTest): boolean => {
  if (CONFIG.testPrivate) {
    return true;
  }

  if (fn.isPrivate) {
    STATS.skipsBecausePrivate++;
    return false;
  } else {
    return true;
  }
};

const writeTestTreeToFile = (tree: Array<FunctionToTest>, specContent: string, specFilePath: string): void => {
  let newSpecContent = specContent;

  tree
    .filter((fn: FunctionToTest) => applySkippedTestsFilter(fn))
    .filter((fn: FunctionToTest) => applyPrivateTestsFilter(fn))
    .forEach((fn: FunctionToTest) => newSpecContent += getIndentedTestForFunction(fn));

  if (specContent !== newSpecContent) {
    fs.writeFileSync(specFilePath, newSpecContent);
    STATS.filesWritten++;
  }
};

const generateTestsForFile = (filePath: string): void => {
  STATS.filesRead++;

  const specFilePath: string = filePath.replace('.ts', '.spec.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  const specFileExists = fs.existsSync(specFilePath);
  const specContent = specFileExists ? fs.readFileSync(specFilePath, 'utf-8') : '';
  const tree = getTestTreeForFile(content, specContent);

  if (tree.length) {
    writeTestTreeToFile(tree, specContent, specFilePath);
  }
};

// HELLO! ACTUAL LOGIC STARTS HERE

Renderer.renderWelcomeBanner(CONFIG);

FileFinder.getMatchingFiles(CONFIG.rootPath, '.ts')
  .filter((filePath: string) => (filePath.indexOf('.ts') !== -1) && filePath.indexOf('.spec.ts') === -1)
  .forEach((filePath: string) => generateTestsForFile(filePath));

Renderer.renderStats(STATS);
