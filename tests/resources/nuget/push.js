const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    buildName: 'NuGet Test',
    buildNumber: '3',
    command: 'push',
    targetDeployRepo: testUtils.getRepoKeys().nugetLocalRepo,
    targetDeployPath: 'custom/path',
    pathToNupkg: path.join(testUtils.getLocalTestDir(TEST_NAME), 'nugetTest*.nupkg'),
    collectBuildInfo: true
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'push');
testUtils.runArtifactoryTask(testUtils.nuget, {}, inputs);
