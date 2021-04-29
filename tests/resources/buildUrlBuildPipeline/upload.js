const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    buildName: 'buildUrlBuildPipeline',
    buildNumber: '3',
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: '*.nothing',
                target: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME)
            }
        ]
    }),
    collectBuildInfo: true,
    failNoOp: false,
    dryRun: false,
    insecureTls: false,
    symlinks: false,
    specSource: 'taskConfiguration'
};

testUtils.runArtifactoryTask(testUtils.upload, {}, inputs);
