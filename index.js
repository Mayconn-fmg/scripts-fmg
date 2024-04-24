#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const extract = require('extract-zip');
const minimist = require('minimist');

// Convert a hyphen-separated string to PascalCase
function toPascalCase(str) {
  return str
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

async function main() {
  // Parse arguments
  const args = minimist(process.argv.slice(2));
  const appName = args._[0];
  const port = args.port || '3000'; // Default to 3000 if no port is provided

  // Define paths
  const zipPath = path.resolve(process.cwd(), `${appName}.zip`);
  const appPath = path.resolve(process.cwd(), 'apps');
  const extractedFolderPath = path.resolve(appPath, 'default-app-with-routes');
  const newFolderPath = path.resolve(appPath, appName);

  // Download the zip
  const res = await fetch(
    'https://github.com/Mayconn-fmg/scripts-fmg/raw/74f438f121b527a13dfbc74e2e2188d5c1616a14/packages/default-app-with-routes.zip'
  );
  const buffer = await res.buffer();
  fs.writeFileSync(zipPath, buffer);

  // Extract the zip
  await extract(zipPath, { dir: appPath });

  // Rename the extracted folder
  fs.renameSync(extractedFolderPath, newFolderPath);

  // Delete the zip file
  fs.unlinkSync(zipPath);

  // Modify package.json
  const packageJsonPath = path.join(newFolderPath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  packageJson.name = appName;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Modify webpack.config.js
  const webpackConfigPath = path.join(newFolderPath, 'webpack.config.js');
  let webpackConfig = fs.readFileSync(webpackConfigPath, 'utf-8');
  webpackConfig = webpackConfig.replace(/port: 3009/g, `port: ${port}`);
  webpackConfig = webpackConfig.replace(/name: 'test3'/g, `name: '${appName}'`);
  webpackConfig = webpackConfig.replace(/container: 'test3'/g, `container: '${appName}'`);
  fs.writeFileSync(webpackConfigPath, webpackConfig);

  // Create app-name.tsx
  const appComponentName = toPascalCase(appName);
  const appComponentPath = path.resolve(
    process.cwd(),
    'apps',
    'platform',
    'src',
    'routes',
    `${appName}.tsx`
  );
  const appComponentContent = `import React, { Suspense } from 'react';
const RemoteApp = React.lazy(() => import('${appName}/App'));

export default function ${appComponentName}() {
  return (
    <Suspense fallback={'loading...'}>
      <RemoteApp />
    </Suspense>
  );
}
  `;
  fs.writeFileSync(appComponentPath, appComponentContent);

  // Append line to env.d.ts
  const envPath = path.resolve(process.cwd(), 'apps', 'platform', 'src', 'env.d.ts');
  fs.appendFileSync(envPath, `\ndeclare module '${appName}/App';\n`);

  // Add a new route to App.tsx
  const appTsxPath = path.resolve(process.cwd(), 'apps', 'platform', 'src', 'App.tsx');
  let appTsxContent = fs.readFileSync(appTsxPath, 'utf-8');
  const importStatement = `import ${appComponentName} from './routes/${appName}';\n`;
  appTsxContent = appTsxContent.replace(/(import .+;\n)(?!import)/g, `$1${importStatement}`);
  const childrenIndex = appTsxContent.indexOf('children:');
  const closingBracketIndex = appTsxContent.indexOf(']', childrenIndex);
  const newRoute = `        {\n          path: '/${appName}/*',\n          element: <${appComponentName} />,\n        },`;
  appTsxContent =
    appTsxContent.slice(0, closingBracketIndex) +
    '\n' +
    newRoute +
    '\n      ' +
    appTsxContent.slice(closingBracketIndex);
  fs.writeFileSync(appTsxPath, appTsxContent);

  // Modify webpack.config.js
  const webpackConfigPath2 = path.resolve(process.cwd(), 'apps', 'platform', 'webpack.config.js');
  let webpackConfig2 = fs.readFileSync(webpackConfigPath2, 'utf-8');
  const remotesIndex = webpackConfig2.indexOf('remotes: {');
  const closingBracketIndex2 = webpackConfig2.indexOf('}', remotesIndex);
  const newRemote = `  '${appName}': '${appName}@http://localhost:${port}/remoteEntry.js',\n      `;
  webpackConfig2 =
    webpackConfig2.slice(0, closingBracketIndex2) +
    newRemote +
    webpackConfig2.slice(closingBracketIndex2);

  fs.writeFileSync(webpackConfigPath2, webpackConfig2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
