#!/usr/bin/env node

/**
 * API Tester CLI Tool
 * Test REST APIs with various methods and configurations
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');

class ApiTester {
    constructor() {
        this.history = [];
        this.collections = new Map();
        this.historyFile = 'api-test-history.json';
        this.collectionsFile = 'api-collections.json';
        this.loadHistory();
        this.loadCollections();
    }
    
    async loadHistory() {
        try {
            if (await fs.pathExists(this.historyFile)) {
                const data = await fs.readJson(this.historyFile);
                this.history = data || [];
            }
        } catch (error) {
            console.log(chalk.yellow('⚠️ Could not load history'));
        }
    }
    
    async saveHistory() {
        try {
            await fs.writeJson(this.historyFile, this.history.slice(-100)); // Keep last 100 requests
        } catch (error) {
            console.log(chalk.yellow('⚠️ Could not save history'));
        }
    }
    
    async loadCollections() {
        try {
            if (await fs.pathExists(this.collectionsFile)) {
                const data = await fs.readJson(this.collectionsFile);
                this.collections = new Map(Object.entries(data || {}));
            }
        } catch (error) {
            console.log(chalk.yellow('⚠️ Could not load collections'));
        }
    }
    
    async saveCollections() {
        try {
            const data = Object.fromEntries(this.collections);
            await fs.writeJson(this.collectionsFile, data, { spaces: 2 });
        } catch (error) {
            console.log(chalk.yellow('⚠️ Could not save collections'));
        }
    }
    
    parseHeaders(headerStrings) {
        const headers = {};
        if (headerStrings) {
            headerStrings.forEach(header => {
                const [key, ...valueParts] = header.split(':');
                if (key && valueParts.length > 0) {
                    headers[key.trim()] = valueParts.join(':').trim();
                }
            });
        }
        return headers;
    }
    
    parseData(dataString) {
        if (!dataString) return null;
        
        try {
            // Try to parse as JSON
            return JSON.parse(dataString);
        } catch {
            // If not JSON, treat as form data
            const params = new URLSearchParams();
            dataString.split('&').forEach(pair => {
                const [key, value] = pair.split('=');
                if (key) {
                    params.append(decodeURIComponent(key), decodeURIComponent(value || ''));
                }
            });
            return params;
        }
    }
    
    async makeRequest(options) {
        const {
            method = 'GET',
            url,
            headers = {},
            data = null,
            timeout = 30000,
            auth = null,
            verbose = false
        } = options;
        
        const spinner = ora(`${method} ${url}`).start();
        const startTime = Date.now();
        
        try {
            // Prepare axios config
            const config = {
                method: method.toLowerCase(),
                url,
                headers,
                timeout,
                validateStatus: () => true // Don't throw on HTTP error status
            };
            
            // Add auth if provided
            if (auth) {
                if (auth.type === 'basic') {
                    config.auth = {
                        username: auth.username,
                        password: auth.password
                    };
                } else if (auth.type === 'bearer') {
                    config.headers.Authorization = `Bearer ${auth.token}`;
                }
            }
            
            // Add data for POST/PUT/PATCH
            if (['post', 'put', 'patch'].includes(method.toLowerCase()) && data) {
                config.data = data;
            }
            
            // Add query params for GET/DELETE
            if (['get', 'delete'].includes(method.toLowerCase()) && data) {
                config.params = data;
            }
            
            const response = await axios(config);
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            spinner.succeed(`${response.status} ${response.statusText} (${duration}ms)`);
            
            // Save to history
            const historyEntry = {
                timestamp: new Date().toISOString(),
                method,
                url,
                status: response.status,
                duration,
                headers: response.headers,
                size: JSON.stringify(response.data).length
            };
            this.history.unshift(historyEntry);
            await this.saveHistory();
            
            return {
                success: true,
                response,
                duration
            };
            
        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            spinner.fail(`Request failed (${duration}ms)`);
            
            return {
                success: false,
                error: error.message,
                duration
            };
        }
    }
    
    formatResponse(response, format = 'pretty') {
        const { status, statusText, headers, data } = response;
        
        console.log('\n' + chalk.bold.blue('📡 Response'));
        console.log(chalk.gray('─'.repeat(50)));
        
        // Status
        const statusColor = status >= 200 && status < 300 ? 'green' : 
                           status >= 300 && status < 400 ? 'yellow' : 'red';
        console.log(chalk[statusColor](`Status: ${status} ${statusText}`));
        
        // Headers
        if (format === 'full' || format === 'headers') {
            console.log('\n' + chalk.bold('📋 Headers:'));
            Object.entries(headers).forEach(([key, value]) => {
                console.log(chalk.cyan(`${key}: `) + chalk.white(value));
            });
        }
        
        // Body
        if (format !== 'headers') {
            console.log('\n' + chalk.bold('📄 Body:'));
            
            if (format === 'raw') {
                console.log(JSON.stringify(data));
            } else {
                try {
                    console.log(JSON.stringify(data, null, 2));
                } catch {
                    console.log(data);
                }
            }
        }
        
        // Size info
        const size = JSON.stringify(data).length;
        console.log(chalk.gray(`\n📊 Response size: ${size} bytes`));
    }
    
    async testEndpoint(method, url, options = {}) {
        console.log(chalk.bold.blue(`🔄 Testing ${method.toUpperCase()} ${url}`));
        
        const result = await this.makeRequest({
            method,
            url,
            ...options
        });
        
        if (result.success) {
            this.formatResponse(result.response, options.format);
        } else {
            console.log(chalk.red(`❌ Error: ${result.error}`));
        }
        
        return result;
    }
    
    async runCollection(collectionName) {
        const collection = this.collections.get(collectionName);
        if (!collection) {
            console.log(chalk.red(`❌ Collection '${collectionName}' not found`));
            return;
        }
        
        console.log(chalk.bold.blue(`🗂️ Running collection: ${collectionName}`));
        console.log(chalk.gray(`📝 ${collection.description || 'No description'}`));
        console.log(chalk.gray('─'.repeat(50)));
        
        const results = [];
        
        for (const [index, request] of collection.requests.entries()) {
            console.log(chalk.bold(`\n${index + 1}. ${request.name || 'Unnamed Request'}`));
            
            const result = await this.makeRequest({
                method: request.method,
                url: request.url,
                headers: request.headers,
                data: request.data,
                auth: request.auth
            });
            
            results.push({
                name: request.name,
                success: result.success,
                status: result.success ? result.response.status : null,
                duration: result.duration,
                error: result.error
            });
            
            if (result.success) {
                console.log(chalk.green(`✅ ${result.response.status} ${result.response.statusText}`));
            } else {
                console.log(chalk.red(`❌ ${result.error}`));
            }
        }
        
        // Summary
        const successful = results.filter(r => r.success).length;
        const total = results.length;
        
        console.log('\n' + chalk.bold.blue('📊 Collection Summary'));
        console.log(chalk.gray('─'.repeat(30)));
        console.log(chalk.green(`✅ Successful: ${successful}/${total}`));
        console.log(chalk.red(`❌ Failed: ${total - successful}/${total}`));
        
        const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / total;
        console.log(chalk.blue(`⏱️ Average duration: ${Math.round(avgDuration)}ms`));
    }
    
    async interactiveTest() {
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'method',
                message: 'HTTP Method:',
                choices: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
            },
            {
                type: 'input',
                name: 'url',
                message: 'URL:',
                validate: (input) => {
                    try {
                        new URL(input);
                        return true;
                    } catch {
                        return 'Please enter a valid URL';
                    }
                }
            },
            {
                type: 'input',
                name: 'headers',
                message: 'Headers (key:value, separated by commas):'
            },
            {
                type: 'input',
                name: 'data',
                message: 'Request body (JSON or form data):',
                when: (answers) => ['POST', 'PUT', 'PATCH'].includes(answers.method)
            },
            {
                type: 'list',
                name: 'format',
                message: 'Response format:',
                choices: ['pretty', 'raw', 'headers', 'full'],
                default: 'pretty'
            }
        ]);
        
        const headers = this.parseHeaders(answers.headers ? answers.headers.split(',') : []);
        const data = this.parseData(answers.data);
        
        await this.testEndpoint(answers.method, answers.url, {
            headers,
            data,
            format: answers.format
        });
    }
    
    showHistory(limit = 10) {
        if (this.history.length === 0) {
            console.log(chalk.yellow('📝 No request history'));
            return;
        }
        
        console.log('\n' + chalk.bold.blue('📜 Request History'));
        console.log(chalk.gray('─'.repeat(80)));
        
        this.history.slice(0, limit).forEach((entry, index) => {
            const timestamp = new Date(entry.timestamp).toLocaleString();
            const statusColor = entry.status >= 200 && entry.status < 300 ? 'green' : 
                               entry.status >= 300 && entry.status < 400 ? 'yellow' : 'red';
            
            console.log(
                chalk.gray(`${index + 1}.`.padEnd(3)) +
                chalk.blue(entry.method.padEnd(6)) +
                chalk.white(entry.url.padEnd(40)) +
                chalk[statusColor](entry.status.toString().padEnd(5)) +
                chalk.yellow(`${entry.duration}ms`.padEnd(8)) +
                chalk.gray(timestamp)
            );
        });
    }
    
    listCollections() {
        if (this.collections.size === 0) {
            console.log(chalk.yellow('📂 No collections saved'));
            return;
        }
        
        console.log('\n' + chalk.bold.blue('📂 API Collections'));
        console.log(chalk.gray('─'.repeat(50)));
        
        this.collections.forEach((collection, name) => {
            console.log(chalk.green(`📋 ${name}`));
            console.log(chalk.gray(`   ${collection.description || 'No description'}`));
            console.log(chalk.blue(`   ${collection.requests.length} request(s)`));
        });
    }
    
    async saveCollection(name, requests, description = '') {
        this.collections.set(name, {
            name,
            description,
            requests,
            created: new Date().toISOString()
        });
        
        await this.saveCollections();
        console.log(chalk.green(`✅ Collection '${name}' saved with ${requests.length} request(s)`));
    }
}

// CLI Configuration
program
    .name('api-tester')
    .description('API Tester - Test REST APIs with various methods and configurations')
    .version('1.0.0');

// Test command
program
    .command('test <method> <url>')
    .description('Test an API endpoint')
    .option('-H, --header <headers...>', 'request headers (key:value)')
    .option('-d, --data <data>', 'request body data')
    .option('-t, --timeout <ms>', 'request timeout in milliseconds', '30000')
    .option('-f, --format <format>', 'response format (pretty|raw|headers|full)', 'pretty')
    .option('-a, --auth <type>', 'authentication type (basic|bearer)')
    .option('-u, --user <credentials>', 'basic auth credentials (user:pass)')
    .option('-T, --token <token>', 'bearer token')
    .action(async (method, url, options) => {
        const tester = new ApiTester();
        
        const headers = tester.parseHeaders(options.header || []);
        const data = tester.parseData(options.data);
        
        let auth = null;
        if (options.auth === 'basic' && options.user) {
            const [username, password] = options.user.split(':');
            auth = { type: 'basic', username, password };
        } else if (options.auth === 'bearer' && options.token) {
            auth = { type: 'bearer', token: options.token };
        }
        
        await tester.testEndpoint(method.toUpperCase(), url, {
            headers,
            data,
            timeout: parseInt(options.timeout),
            format: options.format,
            auth
        });
    });

// Interactive mode
program
    .command('interactive')
    .alias('i')
    .description('Interactive API testing')
    .action(async () => {
        const tester = new ApiTester();
        await tester.interactiveTest();
    });

// History command
program
    .command('history')
    .description('Show request history')
    .option('-n, --number <count>', 'number of entries to show', '10')
    .action((options) => {
        const tester = new ApiTester();
        tester.showHistory(parseInt(options.number));
    });

// Collections
program
    .command('collections')
    .alias('col')
    .description('List saved collections')
    .action(() => {
        const tester = new ApiTester();
        tester.listCollections();
    });

program
    .command('run <collection>')
    .description('Run a saved collection')
    .action(async (collection) => {
        const tester = new ApiTester();
        await tester.runCollection(collection);
    });

// Quick test commands
program
    .command('get <url>')
    .description('Quick GET request')
    .option('-H, --header <headers...>', 'request headers')
    .option('-f, --format <format>', 'response format', 'pretty')
    .action(async (url, options) => {
        const tester = new ApiTester();
        const headers = tester.parseHeaders(options.header || []);
        await tester.testEndpoint('GET', url, { headers, format: options.format });
    });

program
    .command('post <url>')
    .description('Quick POST request')
    .option('-d, --data <data>', 'request body data')
    .option('-H, --header <headers...>', 'request headers')
    .option('-f, --format <format>', 'response format', 'pretty')
    .action(async (url, options) => {
        const tester = new ApiTester();
        const headers = tester.parseHeaders(options.header || []);
        const data = tester.parseData(options.data);
        await tester.testEndpoint('POST', url, { headers, data, format: options.format });
    });

// Load test command
program
    .command('load <url>')
    .description('Simple load test')
    .option('-n, --requests <count>', 'number of requests', '10')
    .option('-c, --concurrent <count>', 'concurrent requests', '1')
    .action(async (url, options) => {
        const tester = new ApiTester();
        const requests = parseInt(options.requests);
        const concurrent = parseInt(options.concurrent);
        
        console.log(chalk.bold.blue(`🔥 Load testing: ${requests} requests, ${concurrent} concurrent`));
        
        const startTime = Date.now();
        const results = [];
        
        for (let i = 0; i < requests; i += concurrent) {
            const batch = [];
            for (let j = 0; j < concurrent && i + j < requests; j++) {
                batch.push(tester.makeRequest({ method: 'GET', url }));
            }
            
            const batchResults = await Promise.all(batch);
            results.push(...batchResults);
            
            const progress = Math.round(((i + batch.length) / requests) * 100);
            process.stdout.write(`\r${chalk.blue('Progress:')} ${progress}%`);
        }
        
        console.log('\n');
        
        const totalTime = Date.now() - startTime;
        const successful = results.filter(r => r.success).length;
        const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
        
        console.log('\n' + chalk.bold.blue('📊 Load Test Results'));
        console.log(chalk.gray('─'.repeat(30)));
        console.log(chalk.green(`✅ Successful: ${successful}/${requests}`));
        console.log(chalk.red(`❌ Failed: ${requests - successful}/${requests}`));
        console.log(chalk.blue(`⏱️ Total time: ${totalTime}ms`));
        console.log(chalk.blue(`📈 Average response: ${Math.round(avgDuration)}ms`));
        console.log(chalk.blue(`🚀 Requests/sec: ${Math.round(requests / (totalTime / 1000))}`));
    });

// Parse command line arguments
if (require.main === module) {
    program.parse();
}

module.exports = ApiTester;