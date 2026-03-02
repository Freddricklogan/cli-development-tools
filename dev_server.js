#!/usr/bin/env node

/**
 * Development Server CLI Tool
 * Auto-reload dev server with file watching and live reload
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const chokidar = require('chokidar');
const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');

class DevServer {
    constructor(options = {}) {
        this.port = options.port || 3000;
        this.directory = options.directory || process.cwd();
        this.watch = options.watch !== false;
        this.cors = options.cors !== false;
        this.spa = options.spa || false;
        this.app = express();
        this.server = null;
        this.watcher = null;
        this.clients = new Set();
        
        this.setupServer();
    }
    
    setupServer() {
        // Enable CORS if requested
        if (this.cors) {
            this.app.use(cors());
        }
        
        // Serve static files
        this.app.use(express.static(this.directory, {
            index: ['index.html', 'index.htm'],
            extensions: ['html', 'htm']
        }));
        
        // API endpoint for file listing
        this.app.get('/api/files', (req, res) => {
            this.getFileTree(this.directory)
                .then(tree => res.json(tree))
                .catch(err => res.status(500).json({ error: err.message }));
        });
        
        // Server info endpoint
        this.app.get('/api/info', (req, res) => {
            res.json({
                port: this.port,
                directory: this.directory,
                watch: this.watch,
                cors: this.cors,
                spa: this.spa,
                uptime: process.uptime(),
                version: require('./package.json').version
            });
        });
        
        // Live reload endpoint (Server-Sent Events)
        this.app.get('/api/live-reload', (req, res) => {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });
            
            // Add client to set
            this.clients.add(res);
            
            // Send initial connection message
            res.write('data: {"type":"connected","message":"Live reload connected"}\n\n');
            
            // Remove client when connection closes
            req.on('close', () => {
                this.clients.delete(res);
            });
        });
        
        // SPA fallback - serve index.html for all non-API routes
        if (this.spa) {
            this.app.get('*', (req, res) => {
                const indexPath = path.join(this.directory, 'index.html');
                if (fs.existsSync(indexPath)) {
                    res.sendFile(indexPath);
                } else {
                    res.status(404).send('index.html not found');
                }
            });
        }
        
        // Error handler
        this.app.use((err, req, res, next) => {
            console.error(chalk.red('Server Error:'), err.message);
            res.status(500).json({ error: 'Internal Server Error' });
        });
    }
    
    async getFileTree(dir, relativePath = '') {
        const items = [];
        
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue; // Skip hidden files
                
                const fullPath = path.join(dir, entry.name);
                const relPath = path.join(relativePath, entry.name);
                
                if (entry.isDirectory()) {
                    const children = await this.getFileTree(fullPath, relPath);
                    items.push({
                        name: entry.name,
                        type: 'directory',
                        path: relPath,
                        children
                    });
                } else {
                    const stats = await fs.stat(fullPath);
                    items.push({
                        name: entry.name,
                        type: 'file',
                        path: relPath,
                        size: stats.size,
                        modified: stats.mtime.toISOString(),
                        extension: path.extname(entry.name)
                    });
                }
            }
        } catch (error) {
            console.error(chalk.red('Error reading directory:'), error.message);
        }
        
        return items.sort((a, b) => {
            // Directories first, then files
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
    }
    
    setupFileWatcher() {
        if (!this.watch) return;
        
        const watchPaths = [
            path.join(this.directory, '**/*.html'),
            path.join(this.directory, '**/*.css'),
            path.join(this.directory, '**/*.js'),
            path.join(this.directory, '**/*.json')
        ];
        
        this.watcher = chokidar.watch(watchPaths, {
            ignored: /node_modules|\.git/,
            persistent: true,
            ignoreInitial: true
        });
        
        this.watcher.on('change', (filePath) => {
            const relativePath = path.relative(this.directory, filePath);
            const message = {
                type: 'file-changed',
                file: relativePath,
                timestamp: new Date().toISOString()
            };
            
            console.log(chalk.blue('File changed:'), chalk.cyan(relativePath));
            this.broadcastToClients(message);
        });
        
        this.watcher.on('add', (filePath) => {
            const relativePath = path.relative(this.directory, filePath);
            const message = {
                type: 'file-added',
                file: relativePath,
                timestamp: new Date().toISOString()
            };
            
            console.log(chalk.green('File added:'), chalk.cyan(relativePath));
            this.broadcastToClients(message);
        });
        
        this.watcher.on('unlink', (filePath) => {
            const relativePath = path.relative(this.directory, filePath);
            const message = {
                type: 'file-removed',
                file: relativePath,
                timestamp: new Date().toISOString()
            };
            
            console.log(chalk.red('File removed:'), chalk.cyan(relativePath));
            this.broadcastToClients(message);
        });
        
        console.log(chalk.yellow('👀 File watcher active'));
    }
    
    broadcastToClients(message) {
        const data = `data: ${JSON.stringify(message)}\n\n`;
        
        this.clients.forEach(client => {
            try {
                client.write(data);
            } catch (error) {
                this.clients.delete(client);
            }
        });
    }
    
    async start() {
        const spinner = ora('Starting development server...').start();
        
        try {
            // Check if directory exists
            const dirExists = await fs.pathExists(this.directory);
            if (!dirExists) {
                spinner.fail(`Directory ${this.directory} does not exist`);
                return;
            }
            
            // Start server
            this.server = this.app.listen(this.port, () => {
                spinner.succeed('Development server started!');
                
                console.log('\n' + chalk.bold.blue('🚀 Development Server Running'));
                console.log(chalk.gray('─'.repeat(40)));
                console.log(chalk.green('Local:'), chalk.cyan(`http://localhost:${this.port}`));
                console.log(chalk.green('Directory:'), chalk.cyan(this.directory));
                console.log(chalk.green('Watch:'), this.watch ? chalk.cyan('enabled') : chalk.gray('disabled'));
                console.log(chalk.green('CORS:'), this.cors ? chalk.cyan('enabled') : chalk.gray('disabled'));
                console.log(chalk.green('SPA:'), this.spa ? chalk.cyan('enabled') : chalk.gray('disabled'));
                console.log(chalk.gray('─'.repeat(40)));
                console.log(chalk.yellow('Press Ctrl+C to stop\n'));
                
                // Setup file watcher
                if (this.watch) {
                    this.setupFileWatcher();
                }
            });
            
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    spinner.fail(`Port ${this.port} is already in use`);
                } else {
                    spinner.fail(`Server error: ${error.message}`);
                }
            });
            
        } catch (error) {
            spinner.fail(`Failed to start server: ${error.message}`);
        }
    }
    
    async stop() {
        const spinner = ora('Stopping server...').start();
        
        try {
            // Close file watcher
            if (this.watcher) {
                await this.watcher.close();
            }
            
            // Close all SSE connections
            this.clients.forEach(client => {
                try {
                    client.end();
                } catch (error) {
                    // Ignore errors when closing connections
                }
            });
            this.clients.clear();
            
            // Close server
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(resolve);
                });
            }
            
            spinner.succeed('Server stopped');
        } catch (error) {
            spinner.fail(`Error stopping server: ${error.message}`);
        }
    }
}

// CLI Configuration
program
    .name('dev-server')
    .description('Development server with live reload and file watching')
    .version('1.0.0')
    .option('-p, --port <number>', 'port to run server on', '3000')
    .option('-d, --directory <path>', 'directory to serve', '.')
    .option('--no-watch', 'disable file watching')
    .option('--no-cors', 'disable CORS')
    .option('--spa', 'enable SPA mode (serve index.html for all routes)')
    .action(async (options) => {
        const server = new DevServer({
            port: parseInt(options.port),
            directory: path.resolve(options.directory),
            watch: options.watch,
            cors: options.cors,
            spa: options.spa
        });
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n');
            await server.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            await server.stop();
            process.exit(0);
        });
        
        await server.start();
    });

// Add subcommands
program
    .command('info')
    .description('Show server information for running instance')
    .option('-p, --port <number>', 'server port', '3000')
    .action(async (options) => {
        const axios = require('axios');
        
        try {
            const response = await axios.get(`http://localhost:${options.port}/api/info`);
            const info = response.data;
            
            console.log(chalk.bold.blue('📊 Server Information'));
            console.log(chalk.gray('─'.repeat(30)));
            console.log(chalk.green('Port:'), chalk.cyan(info.port));
            console.log(chalk.green('Directory:'), chalk.cyan(info.directory));
            console.log(chalk.green('Watch:'), info.watch ? chalk.cyan('enabled') : chalk.gray('disabled'));
            console.log(chalk.green('CORS:'), info.cors ? chalk.cyan('enabled') : chalk.gray('disabled'));
            console.log(chalk.green('SPA:'), info.spa ? chalk.cyan('enabled') : chalk.gray('disabled'));
            console.log(chalk.green('Uptime:'), chalk.cyan(`${Math.floor(info.uptime)}s`));
            console.log(chalk.green('Version:'), chalk.cyan(info.version));
            
        } catch (error) {
            console.log(chalk.red('❌ Server not running or not accessible'));
        }
    });

program
    .command('files')
    .description('List files being served')
    .option('-p, --port <number>', 'server port', '3000')
    .action(async (options) => {
        const axios = require('axios');
        
        try {
            const response = await axios.get(`http://localhost:${options.port}/api/files`);
            const files = response.data;
            
            console.log(chalk.bold.blue('📁 Server Files'));
            console.log(chalk.gray('─'.repeat(30)));
            
            function printTree(items, indent = '') {
                items.forEach((item, index) => {
                    const isLast = index === items.length - 1;
                    const connector = isLast ? '└── ' : '├── ';
                    const icon = item.type === 'directory' ? '📁' : '📄';
                    
                    console.log(chalk.gray(indent + connector) + icon + ' ' + chalk.cyan(item.name));
                    
                    if (item.children) {
                        const nextIndent = indent + (isLast ? '    ' : '│   ');
                        printTree(item.children, nextIndent);
                    }
                });
            }
            
            printTree(files);
            
        } catch (error) {
            console.log(chalk.red('❌ Server not running or not accessible'));
        }
    });

// Parse command line arguments
if (require.main === module) {
    program.parse();
}