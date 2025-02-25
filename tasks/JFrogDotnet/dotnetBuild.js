const tl = require('azure-pipelines-task-lib/task');
const fs = require('fs');
const utils = require('@jfrog/tasks-utils/utils.js');
const path = require('path');
const solutionPathUtil = require('@jfrog/tasks-utils/solutionPathUtil');
const cliDotnetCoreRestoreCommand = 'dotnet restore';
const cliUploadCommand = 'rt u';
const dotnetConfigCommand = 'dotnetc';

// The .NET Core CLI is included in all Azure-hosted agents
function RunTaskCbk(cliPath) {
    let dotnetCommand = tl.getInput('command', true);
    switch (dotnetCommand) {
        case 'restore':
            performDotnetRestore(cliPath);
            break;
        case 'push':
            performDotnetNugetPush(cliPath);
            break;
    }
}

function performDotnetRestore(cliPath) {
    let sourcesPattern = tl.getInput('rootPath');
    let filesList = solutionPathUtil.resolveFilterSpec(sourcesPattern, tl.getVariable('System.DefaultWorkingDirectory') || process.cwd());
    // A source file is a solution or csproj file.
    filesList.forEach(sourceFile => {
        let sourcePath;
        if (!fs.lstatSync(sourceFile).isDirectory()) {
            sourcePath = path.dirname(sourceFile);
        } else {
            sourcePath = sourceFile;
        }
        let resolverServerId = performDotnetConfig(cliPath, sourcePath, 'targetResolveRepo');
        let dotnetArguments = buildDotnetCliArgs();
        let dotnetCommand = utils.cliJoin(cliPath, cliDotnetCoreRestoreCommand, dotnetArguments);
        executeCliCommand(dotnetCommand, sourcePath, cliPath, [resolverServerId]);
    });
}

function performDotnetNugetPush(cliPath) {
    let buildDir = tl.getVariable('System.DefaultWorkingDirectory');
    let targetPath = tl.getInput('targetDeployRepo', true);
    let relativeTargetPath = tl.getInput('targetDeployPath');
    if (relativeTargetPath) {
        targetPath = utils.addTrailingSlashIfNeeded(targetPath) + utils.addTrailingSlashIfNeeded(relativeTargetPath);
    }

    let nupkgPath = utils.fixWindowsPaths(tl.getPathInput('pathToNupkg', true, false));
    let uploadCommand = utils.cliJoin(cliPath, cliUploadCommand, utils.quote(nupkgPath), utils.quote(targetPath));
    let serverId = utils.configureDefaultArtifactoryServer('dotnet_nuget_push', cliPath, buildDir);
    uploadCommand = utils.addServerIdOption(uploadCommand, serverId);
    uploadCommand = utils.cliJoin(uploadCommand, '--flat=' + utils.quote('true'));
    executeCliCommand(uploadCommand, buildDir, cliPath, [serverId]);
}

function executeCliCommand(cliCmd, buildDir, cliPath, configuredServerIdsArray) {
    let collectBuildInfo = tl.getBoolInput('collectBuildInfo');
    if (collectBuildInfo) {
        let buildName = tl.getInput('buildName', true);
        let buildNumber = tl.getInput('buildNumber', true);
        cliCmd = utils.cliJoin(cliCmd, '--build-name=' + utils.quote(buildName), '--build-number=' + utils.quote(buildNumber));
        cliCmd = utils.addProjectOption(cliCmd);
    }
    try {
        utils.executeCliCommand(cliCmd, buildDir, null);
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        utils.taskDefaultCleanup(cliPath, buildDir, configuredServerIdsArray);
    }
}

// Create dotnet config
function performDotnetConfig(cliPath, requiredWorkDir, repoResolve) {
    let cliCommand = utils.cliJoin(cliPath, dotnetConfigCommand);

    // Create serverId
    const resolverServerId = utils.configureDefaultArtifactoryServer('dotnet_resolver', cliPath, requiredWorkDir);

    // Add serverId and repo to config command
    cliCommand = utils.cliJoin(cliCommand, '--server-id-resolve=' + utils.quote(resolverServerId));
    cliCommand = utils.addStringParam(cliCommand, repoResolve, 'repo-resolve', true);

    // Using Nuget protocol v3 by default.
    let nugetProtocolVersion = tl.getInput('nugetProtocolVersion', false);
    if (nugetProtocolVersion && nugetProtocolVersion === 'v2') {
        cliCommand = utils.cliJoin(cliCommand, '--nuget-v2');
    }

    // Execute cli.
    try {
        utils.executeCliCommand(cliCommand, requiredWorkDir, null);
        return resolverServerId;
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}

// Creates the .NET Core CLI arguments
function buildDotnetCliArgs() {
    let nugetArguments = '';

    let noNuGetCache = tl.getBoolInput('noNuGetCache');
    if (noNuGetCache) {
        nugetArguments = utils.cliJoin(nugetArguments, '--no-cache');
    }

    let packagesDirectory = tl.getPathInput('packagesDirectory');
    if (!tl.filePathSupplied('packagesDirectory')) {
        packagesDirectory = null;
    }
    if (packagesDirectory) {
        nugetArguments = utils.cliJoin(nugetArguments, '--packages', utils.quote(packagesDirectory));
    }

    let verbosity = tl.getInput('verbosityRestore');
    if (verbosity && verbosity !== 'None') {
        nugetArguments = utils.cliJoin(nugetArguments, '--verbosity', utils.quote(verbosity));
    }

    let additionalArguments = tl.getInput('arguments');
    if (additionalArguments) {
        nugetArguments = utils.cliJoin(nugetArguments, additionalArguments);
    }
    return nugetArguments;
}

utils.executeCliTask(RunTaskCbk);
