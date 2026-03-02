#!/usr/bin/env node

/**
 * Git Helper CLI Tool
 * Automate common Git workflows and operations
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');

class GitHelper {
    constructor() {
        this.isGitRepo = this.checkGitRepo();
    }
    
    checkGitRepo() {
        try {
            execSync('git rev-parse --git-dir', { stdio: 'ignore' });
            return true;
        } catch (error) {
            return false;
        }
    }
    
    executeCommand(command, options = {}) {
        try {
            const result = execSync(command, { 
                encoding: 'utf8', 
                stdio: options.silent ? 'pipe' : 'inherit',
                ...options 
            });
            return { success: true, output: result };
        } catch (error) {
            return { success: false, error: error.message, output: error.stdout };
        }
    }
    
    async getStatus() {
        if (!this.isGitRepo) {
            console.log(chalk.red('❌ Not a Git repository'));
            return null;
        }
        
        const result = this.executeCommand('git status --porcelain', { silent: true });
        if (!result.success) {
            console.log(chalk.red('❌ Failed to get Git status'));
            return null;
        }
        
        const lines = result.output.trim().split('\n').filter(line => line);
        const status = {
            staged: [],
            modified: [],
            untracked: [],
            deleted: []
        };
        
        lines.forEach(line => {
            const statusCode = line.substr(0, 2);
            const file = line.substr(3);
            
            if (statusCode[0] === 'A' || statusCode[0] === 'M' || statusCode[0] === 'D') {
                status.staged.push(file);
            }
            if (statusCode[1] === 'M') {
                status.modified.push(file);
            }
            if (statusCode[1] === 'D') {
                status.deleted.push(file);
            }
            if (statusCode === '??') {
                status.untracked.push(file);
            }
        });
        
        return status;
    }
    
    async displayStatus() {
        const spinner = ora('Getting Git status...').start();
        
        try {
            const status = await this.getStatus();
            if (!status) {
                spinner.fail('Failed to get status');
                return;
            }
            
            spinner.succeed('Git status retrieved');
            
            console.log('\n' + chalk.bold.blue('📊 Git Repository Status'));
            console.log(chalk.gray('─'.repeat(40)));
            
            if (status.staged.length > 0) {
                console.log(chalk.green('\n✅ Staged files:'));
                status.staged.forEach(file => console.log(chalk.green(`   + ${file}`)));
            }
            
            if (status.modified.length > 0) {
                console.log(chalk.yellow('\n📝 Modified files:'));
                status.modified.forEach(file => console.log(chalk.yellow(`   ~ ${file}`)));
            }
            
            if (status.deleted.length > 0) {
                console.log(chalk.red('\n🗑️ Deleted files:'));
                status.deleted.forEach(file => console.log(chalk.red(`   - ${file}`)));
            }
            
            if (status.untracked.length > 0) {
                console.log(chalk.cyan('\n❓ Untracked files:'));
                status.untracked.forEach(file => console.log(chalk.cyan(`   ? ${file}`)));
            }
            
            if (status.staged.length === 0 && status.modified.length === 0 && 
                status.deleted.length === 0 && status.untracked.length === 0) {
                console.log(chalk.green('\n✨ Working tree clean'));
            }
            
        } catch (error) {
            spinner.fail(`Error: ${error.message}`);
        }
    }
    
    async quickCommit(message, addAll = false) {
        if (!this.isGitRepo) {
            console.log(chalk.red('❌ Not a Git repository'));
            return;
        }
        
        const spinner = ora('Preparing commit...').start();
        
        try {
            // Add files if requested
            if (addAll) {
                const addResult = this.executeCommand('git add .', { silent: true });
                if (!addResult.success) {
                    spinner.fail('Failed to add files');
                    return;
                }
                spinner.text = 'Files added, creating commit...';
            }
            
            // Check if there are staged changes
            const statusResult = this.executeCommand('git diff --cached --name-only', { silent: true });
            if (!statusResult.output.trim()) {
                spinner.fail('No staged changes to commit');
                return;
            }
            
            // Create commit
            const commitResult = this.executeCommand(`git commit -m "${message}"`, { silent: true });
            if (!commitResult.success) {
                spinner.fail('Failed to create commit');
                console.log(chalk.red(commitResult.error));
                return;
            }
            
            spinner.succeed(`Commit created: "${message}"`);
            
        } catch (error) {
            spinner.fail(`Error: ${error.message}`);
        }
    }
    
    async smartPush(force = false) {
        if (!this.isGitRepo) {
            console.log(chalk.red('❌ Not a Git repository'));
            return;
        }
        
        const spinner = ora('Checking remote status...').start();
        
        try {
            // Check if we have commits to push
            const behindResult = this.executeCommand('git rev-list --count @{u}..HEAD', { silent: true });
            if (!behindResult.success) {
                spinner.fail('No upstream branch configured');
                return;
            }
            
            const commitsAhead = parseInt(behindResult.output.trim());
            if (commitsAhead === 0) {
                spinner.succeed('Already up to date');
                return;
            }
            
            spinner.text = `Pushing ${commitsAhead} commit(s)...`;
            
            // Push commits
            const pushCommand = force ? 'git push --force-with-lease' : 'git push';
            const pushResult = this.executeCommand(pushCommand);
            
            if (pushResult.success) {
                spinner.succeed(`Successfully pushed ${commitsAhead} commit(s)`);
            } else {
                spinner.fail('Push failed');
                console.log(chalk.red(pushResult.error));
            }
            
        } catch (error) {
            spinner.fail(`Error: ${error.message}`);
        }
    }
    
    async createBranch(branchName, checkout = true) {
        if (!this.isGitRepo) {
            console.log(chalk.red('❌ Not a Git repository'));
            return;
        }
        
        const spinner = ora(`Creating branch '${branchName}'...`).start();
        
        try {
            // Check if branch already exists
            const branchExists = this.executeCommand(`git rev-parse --verify ${branchName}`, { silent: true });
            if (branchExists.success) {
                spinner.fail(`Branch '${branchName}' already exists`);
                return;
            }
            
            // Create branch
            const createResult = this.executeCommand(`git branch ${branchName}`, { silent: true });
            if (!createResult.success) {
                spinner.fail('Failed to create branch');
                return;
            }
            
            // Checkout if requested
            if (checkout) {
                const checkoutResult = this.executeCommand(`git checkout ${branchName}`, { silent: true });
                if (!checkoutResult.success) {
                    spinner.fail('Branch created but failed to checkout');
                    return;
                }
                spinner.succeed(`Created and switched to branch '${branchName}'`);
            } else {
                spinner.succeed(`Created branch '${branchName}'`);
            }
            
        } catch (error) {
            spinner.fail(`Error: ${error.message}`);
        }
    }
    
    async mergeBranch(branchName, deleteAfter = false) {
        if (!this.isGitRepo) {
            console.log(chalk.red('❌ Not a Git repository'));
            return;
        }
        
        const spinner = ora(`Merging branch '${branchName}'...`).start();
        
        try {
            // Check if branch exists
            const branchExists = this.executeCommand(`git rev-parse --verify ${branchName}`, { silent: true });
            if (!branchExists.success) {
                spinner.fail(`Branch '${branchName}' does not exist`);
                return;
            }
            
            // Merge branch
            const mergeResult = this.executeCommand(`git merge ${branchName}`);
            if (!mergeResult.success) {
                spinner.fail('Merge failed - resolve conflicts manually');
                return;
            }
            
            spinner.succeed(`Successfully merged '${branchName}'`);
            
            // Delete branch if requested
            if (deleteAfter) {
                const deleteResult = this.executeCommand(`git branch -d ${branchName}`, { silent: true });
                if (deleteResult.success) {
                    console.log(chalk.green(`🗑️ Deleted branch '${branchName}'`));
                }
            }
            
        } catch (error) {
            spinner.fail(`Error: ${error.message}`);
        }
    }
    
    async getLog(count = 10, oneline = false) {
        if (!this.isGitRepo) {
            console.log(chalk.red('❌ Not a Git repository'));
            return;
        }
        
        const format = oneline ? '--oneline' : '--pretty=format:"%h - %an, %ar : %s"';
        const result = this.executeCommand(`git log ${format} -${count}`, { silent: true });
        
        if (result.success) {
            console.log('\n' + chalk.bold.blue('📜 Recent Commits'));
            console.log(chalk.gray('─'.repeat(40)));
            console.log(result.output);
        } else {
            console.log(chalk.red('❌ Failed to get commit log'));
        }
    }
    
    async cleanup() {
        if (!this.isGitRepo) {
            console.log(chalk.red('❌ Not a Git repository'));
            return;
        }
        
        const spinner = ora('Cleaning up repository...').start();
        
        try {
            // Prune remote branches
            spinner.text = 'Pruning remote branches...';
            this.executeCommand('git remote prune origin', { silent: true });
            
            // Clean untracked files (dry run first)
            spinner.text = 'Checking for untracked files...';
            const cleanCheck = this.executeCommand('git clean -n', { silent: true });
            
            if (cleanCheck.output.trim()) {
                console.log('\n' + chalk.yellow('🧹 Files that would be cleaned:'));
                console.log(cleanCheck.output);
                
                const { confirm } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Delete these untracked files?',
                    default: false
                }]);
                
                if (confirm) {
                    this.executeCommand('git clean -f', { silent: true });
                    spinner.text = 'Cleaned untracked files';
                }
            }
            
            // Garbage collection
            spinner.text = 'Running garbage collection...';
            this.executeCommand('git gc --auto', { silent: true });
            
            spinner.succeed('Repository cleanup complete');
            
        } catch (error) {
            spinner.fail(`Error: ${error.message}`);
        }
    }
    
    async initializeRepo(remote = null) {
        const spinner = ora('Initializing Git repository...').start();
        
        try {
            // Initialize repo
            const initResult = this.executeCommand('git init', { silent: true });
            if (!initResult.success) {
                spinner.fail('Failed to initialize repository');
                return;
            }
            
            // Add remote if provided
            if (remote) {
                const remoteResult = this.executeCommand(`git remote add origin ${remote}`, { silent: true });
                if (!remoteResult.success) {
                    spinner.warn('Repository initialized but failed to add remote');
                    return;
                }
            }
            
            // Create initial commit if there are files
            const files = await fs.readdir('.');
            if (files.length > 0) {
                this.executeCommand('git add .', { silent: true });
                this.executeCommand('git commit -m "Initial commit"', { silent: true });
            }
            
            this.isGitRepo = true;
            spinner.succeed('Git repository initialized successfully');
            
        } catch (error) {
            spinner.fail(`Error: ${error.message}`);
        }
    }
}

// CLI Configuration
program
    .name('git-helper')
    .description('Git Helper - Automate common Git workflows')
    .version('1.0.0');

// Status command
program
    .command('status')
    .alias('st')
    .description('Show detailed repository status')
    .action(async () => {
        const git = new GitHelper();
        await git.displayStatus();
    });

// Quick commit command
program
    .command('commit <message>')
    .alias('c')
    .description('Quick commit with message')
    .option('-a, --add-all', 'add all changes before committing')
    .action(async (message, options) => {
        const git = new GitHelper();
        await git.quickCommit(message, options.addAll);
    });

// Push command
program
    .command('push')
    .alias('p')
    .description('Smart push with status checks')
    .option('-f, --force', 'force push with lease')
    .action(async (options) => {
        const git = new GitHelper();
        await git.smartPush(options.force);
    });

// Branch management
program
    .command('branch <name>')
    .alias('b')
    .description('Create and optionally checkout branch')
    .option('--no-checkout', 'create branch without checking out')
    .action(async (name, options) => {
        const git = new GitHelper();
        await git.createBranch(name, options.checkout !== false);
    });

// Merge command
program
    .command('merge <branch>')
    .alias('m')
    .description('Merge branch into current branch')
    .option('-d, --delete', 'delete branch after merge')
    .action(async (branch, options) => {
        const git = new GitHelper();
        await git.mergeBranch(branch, options.delete);
    });

// Log command
program
    .command('log')
    .alias('l')
    .description('Show commit history')
    .option('-n, --count <number>', 'number of commits to show', '10')
    .option('--oneline', 'show commits in oneline format')
    .action(async (options) => {
        const git = new GitHelper();
        await git.getLog(parseInt(options.count), options.oneline);
    });

// Cleanup command
program
    .command('cleanup')
    .description('Clean up repository (prune, gc, clean)')
    .action(async () => {
        const git = new GitHelper();
        await git.cleanup();
    });

// Initialize command
program
    .command('init')
    .description('Initialize new Git repository')
    .option('-r, --remote <url>', 'add remote origin')
    .action(async (options) => {
        const git = new GitHelper();
        await git.initializeRepo(options.remote);
    });

// Workflow commands
program
    .command('workflow')
    .description('Interactive Git workflows')
    .action(async () => {
        const git = new GitHelper();
        
        const { workflow } = await inquirer.prompt([{
            type: 'list',
            name: 'workflow',
            message: 'Choose a workflow:',
            choices: [
                { name: '🚀 Feature branch (create, work, merge)', value: 'feature' },
                { name: '🔧 Hotfix (create, fix, merge)', value: 'hotfix' },
                { name: '📝 Quick save (add all, commit, push)', value: 'save' },
                { name: '🔄 Sync (pull, push)', value: 'sync' },
                { name: '🧹 Cleanup and organize', value: 'cleanup' }
            ]
        }]);
        
        switch (workflow) {
            case 'feature':
                const { featureName } = await inquirer.prompt([{
                    type: 'input',
                    name: 'featureName',
                    message: 'Feature branch name:'
                }]);
                await git.createBranch(`feature/${featureName}`);
                break;
                
            case 'hotfix':
                const { hotfixName } = await inquirer.prompt([{
                    type: 'input',
                    name: 'hotfixName',
                    message: 'Hotfix branch name:'
                }]);
                await git.createBranch(`hotfix/${hotfixName}`);
                break;
                
            case 'save':
                const { commitMsg } = await inquirer.prompt([{
                    type: 'input',
                    name: 'commitMsg',
                    message: 'Commit message:'
                }]);
                await git.quickCommit(commitMsg, true);
                await git.smartPush();
                break;
                
            case 'sync':
                git.executeCommand('git pull');
                await git.smartPush();
                break;
                
            case 'cleanup':
                await git.cleanup();
                break;
        }
    });

// Parse command line arguments
if (require.main === module) {
    program.parse();
}

module.exports = GitHelper;