const fs = require('fs');

const mainFilePath = './dist/main.js';
const shebangContent = '#!/usr/bin/env node\n';
const mainContent = fs.readFileSync(mainFilePath);

fs.writeFileSync(mainFilePath, shebangContent + mainContent);
