#!/usr/bin/env node

/**
 * Project Generator CLI Tool
 * Scaffold new projects with templates and boilerplate code
 */

const fs = require('fs-extra');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const figlet = require('figlet');

class ProjectGenerator {
    constructor() {
        this.templates = {
            'node-cli': {
                name: 'Node.js CLI Application',
                description: 'Command-line tool with Commander.js',
                files: this.getNodeCliTemplate()
            },
            'express-api': {
                name: 'Express.js API',
                description: 'REST API with Express and middleware',
                files: this.getExpressApiTemplate()
            },
            'react-app': {
                name: 'React Application',
                description: 'Modern React app with hooks',
                files: this.getReactAppTemplate()
            },
            'vue-app': {
                name: 'Vue.js Application',
                description: 'Vue 3 app with Composition API',
                files: this.getVueAppTemplate()
            },
            'python-cli': {
                name: 'Python CLI Application',
                description: 'Command-line tool with argparse',
                files: this.getPythonCliTemplate()
            },
            'static-site': {
                name: 'Static Website',
                description: 'HTML, CSS, and vanilla JavaScript',
                files: this.getStaticSiteTemplate()
            }
        };
    }
    
    getNodeCliTemplate() {
        return {
            'package.json': {
                content: JSON.stringify({
                    "name": "{{project_name}}",
                    "version": "1.0.0",
                    "description": "{{description}}",
                    "main": "index.js",
                    "bin": {
                        "{{project_name}}": "./index.js"
                    },
                    "scripts": {
                        "start": "node index.js",
                        "dev": "nodemon index.js",
                        "test": "jest"
                    },
                    "keywords": ["cli", "tool"],
                    "author": "{{author}}",
                    "license": "MIT",
                    "dependencies": {
                        "commander": "^9.4.1",
                        "chalk": "^4.1.2",
                        "ora": "^5.4.1",
                        "inquirer": "^8.2.5"
                    },
                    "devDependencies": {
                        "nodemon": "^2.0.22",
                        "jest": "^29.5.0"
                    }
                }, null, 2)
            },
            'index.js': {
                content: `#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');

program
    .name('{{project_name}}')
    .description('{{description}}')
    .version('1.0.0');

program
    .command('hello <name>')
    .description('Say hello to someone')
    .option('-u, --uppercase', 'uppercase the output')
    .action((name, options) => {
        const spinner = ora('Processing...').start();
        
        setTimeout(() => {
            const message = \`Hello, \${name}!\`;
            const output = options.uppercase ? message.toUpperCase() : message;
            
            spinner.succeed(chalk.green(output));
        }, 1000);
    });

program.parse();`
            },
            'README.md': {
                content: `# {{project_name}}

{{description}}

## Installation

\`\`\`bash
npm install -g {{project_name}}
\`\`\`

## Usage

\`\`\`bash
{{project_name}} hello World
{{project_name}} hello World --uppercase
\`\`\`

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## License

MIT`
            },
            '.gitignore': {
                content: `node_modules/
*.log
.env
dist/
coverage/`
            }
        };
    }
    
    getExpressApiTemplate() {
        return {
            'package.json': {
                content: JSON.stringify({
                    "name": "{{project_name}}",
                    "version": "1.0.0",
                    "description": "{{description}}",
                    "main": "server.js",
                    "scripts": {
                        "start": "node server.js",
                        "dev": "nodemon server.js",
                        "test": "jest"
                    },
                    "keywords": ["express", "api", "rest"],
                    "author": "{{author}}",
                    "license": "MIT",
                    "dependencies": {
                        "express": "^4.18.2",
                        "cors": "^2.8.5",
                        "helmet": "^6.1.5",
                        "morgan": "^1.10.0",
                        "dotenv": "^16.1.4"
                    },
                    "devDependencies": {
                        "nodemon": "^2.0.22",
                        "jest": "^29.5.0",
                        "supertest": "^6.3.3"
                    }
                }, null, 2)
            },
            'server.js': {
                content: `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to {{project_name}} API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Example API endpoints
app.get('/api/users', (req, res) => {
    res.json([
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ]);
});

app.post('/api/users', (req, res) => {
    const { name, email } = req.body;
    
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }
    
    const newUser = {
        id: Date.now(),
        name,
        email,
        createdAt: new Date().toISOString()
    };
    
    res.status(201).json(newUser);
});

// Error handling
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(\`🚀 Server running on port \${PORT}\`);
});

module.exports = app;`
            },
            '.env': {
                content: `PORT=3000
NODE_ENV=development`
            },
            'README.md': {
                content: `# {{project_name}}

{{description}}

## Quick Start

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Start development server:
\`\`\`bash
npm run dev
\`\`\`

3. Test the API:
\`\`\`bash
curl http://localhost:3000/api/health
\`\`\`

## API Endpoints

- \`GET /\` - API info
- \`GET /api/health\` - Health check
- \`GET /api/users\` - Get all users
- \`POST /api/users\` - Create new user

## Environment Variables

- \`PORT\` - Server port (default: 3000)
- \`NODE_ENV\` - Environment (development/production)

## License

MIT`
            },
            '.gitignore': {
                content: `node_modules/
*.log
.env
dist/
coverage/`
            }
        };
    }
    
    getReactAppTemplate() {
        return {
            'package.json': {
                content: JSON.stringify({
                    "name": "{{project_name}}",
                    "version": "0.1.0",
                    "description": "{{description}}",
                    "private": true,
                    "dependencies": {
                        "react": "^18.2.0",
                        "react-dom": "^18.2.0",
                        "react-scripts": "5.0.1"
                    },
                    "scripts": {
                        "start": "react-scripts start",
                        "build": "react-scripts build",
                        "test": "react-scripts test",
                        "eject": "react-scripts eject"
                    },
                    "eslintConfig": {
                        "extends": ["react-app"]
                    },
                    "browserslist": {
                        "production": [">0.2%", "not dead", "not op_mini all"],
                        "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
                    }
                }, null, 2)
            },
            'public/index.html': {
                content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{{project_name}}</title>
</head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
</body>
</html>`
            },
            'src/index.js': {
                content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`
            },
            'src/App.js': {
                content: `import React, { useState } from 'react';
import './App.css';

function App() {
    const [count, setCount] = useState(0);
    
    return (
        <div className="App">
            <header className="App-header">
                <h1>{{project_name}}</h1>
                <p>{{description}}</p>
                
                <div className="counter">
                    <button onClick={() => setCount(count - 1)}>-</button>
                    <span>{count}</span>
                    <button onClick={() => setCount(count + 1)}>+</button>
                </div>
                
                <p>
                    Edit <code>src/App.js</code> and save to reload.
                </p>
            </header>
        </div>
    );
}

export default App;`
            },
            'src/App.css': {
                content: `.App {
    text-align: center;
}

.App-header {
    background-color: #282c34;
    padding: 20px;
    color: white;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: calc(10px + 2vmin);
}

.counter {
    display: flex;
    align-items: center;
    gap: 20px;
    margin: 20px 0;
}

.counter button {
    font-size: 24px;
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    background: #61dafb;
    color: #282c34;
    cursor: pointer;
}

.counter button:hover {
    background: #21a0c4;
}

.counter span {
    font-size: 32px;
    min-width: 50px;
}`
            },
            'src/index.css': {
                content: `body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

code {
    font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
        monospace;
}`
            },
            'README.md': {
                content: `# {{project_name}}

{{description}}

## Available Scripts

In the project directory, you can run:

### \`npm start\`
Runs the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### \`npm test\`
Launches the test runner in the interactive watch mode.

### \`npm run build\`
Builds the app for production to the \`build\` folder.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).`
            }
        };
    }
    
    getVueAppTemplate() {
        return {
            'package.json': {
                content: JSON.stringify({
                    "name": "{{project_name}}",
                    "version": "0.1.0",
                    "description": "{{description}}",
                    "scripts": {
                        "serve": "vue-cli-service serve",
                        "build": "vue-cli-service build",
                        "lint": "vue-cli-service lint"
                    },
                    "dependencies": {
                        "core-js": "^3.8.3",
                        "vue": "^3.2.13"
                    },
                    "devDependencies": {
                        "@babel/core": "^7.12.16",
                        "@babel/eslint-parser": "^7.12.16",
                        "@vue/cli-plugin-babel": "~5.0.0",
                        "@vue/cli-plugin-eslint": "~5.0.0",
                        "@vue/cli-service": "~5.0.0",
                        "eslint": "^7.32.0",
                        "eslint-plugin-vue": "^8.0.3"
                    }
                }, null, 2)
            },
            'public/index.html': {
                content: `<!DOCTYPE html>
<html lang="">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>{{project_name}}</title>
</head>
<body>
    <noscript>
        <strong>We're sorry but {{project_name}} doesn't work properly without JavaScript enabled. Please enable it to continue.</strong>
    </noscript>
    <div id="app"></div>
</body>
</html>`
            },
            'src/main.js': {
                content: `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')`
            },
            'src/App.vue': {
                content: `<template>
    <div id="app">
        <header>
            <h1>{{ title }}</h1>
            <p>{{ description }}</p>
        </header>
        
        <main>
            <div class="counter">
                <button @click="decrement">-</button>
                <span>{{ count }}</span>
                <button @click="increment">+</button>
            </div>
            
            <p>
                Edit <code>src/App.vue</code> and save to reload.
            </p>
        </main>
    </div>
</template>

<script>
import { ref } from 'vue'

export default {
    name: 'App',
    setup() {
        const title = '{{project_name}}'
        const description = '{{description}}'
        const count = ref(0)
        
        const increment = () => {
            count.value++
        }
        
        const decrement = () => {
            count.value--
        }
        
        return {
            title,
            description,
            count,
            increment,
            decrement
        }
    }
}
</script>

<style>
#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
}

header {
    background-color: #42b883;
    padding: 20px;
    color: white;
}

main {
    padding: 20px;
}

.counter {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    margin: 20px 0;
}

.counter button {
    font-size: 24px;
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    background: #42b883;
    color: white;
    cursor: pointer;
}

.counter button:hover {
    background: #369870;
}

.counter span {
    font-size: 32px;
    min-width: 50px;
}
</style>`
            },
            'README.md': {
                content: `# {{project_name}}

{{description}}

## Project setup
\`\`\`
npm install
\`\`\`

### Compiles and hot-reloads for development
\`\`\`
npm run serve
\`\`\`

### Compiles and minifies for production
\`\`\`
npm run build
\`\`\`

### Lints and fixes files
\`\`\`
npm run lint
\`\`\`

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).`
            }
        };
    }
    
    getPythonCliTemplate() {
        return {
            'main.py': {
                content: `#!/usr/bin/env python3
"""
{{project_name}} - {{description}}
"""

import argparse
import sys
from typing import Optional

def main():
    parser = argparse.ArgumentParser(description='{{description}}')
    parser.add_argument('--version', action='version', version='{{project_name}} 1.0.0')
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Hello command
    hello_parser = subparsers.add_parser('hello', help='Say hello')
    hello_parser.add_argument('name', help='Name to greet')
    hello_parser.add_argument('-u', '--uppercase', action='store_true', help='Uppercase output')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    if args.command == 'hello':
        message = f"Hello, {args.name}!"
        if args.uppercase:
            message = message.upper()
        print(message)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\\nGoodbye!")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)`
            },
            'requirements.txt': {
                content: `# Add your Python dependencies here
click>=8.0.0
requests>=2.25.0`
            },
            'README.md': {
                content: `# {{project_name}}

{{description}}

## Installation

\`\`\`bash
pip install -r requirements.txt
\`\`\`

## Usage

\`\`\`bash
python main.py hello World
python main.py hello World --uppercase
\`\`\`

## Development

\`\`\`bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python main.py --help
\`\`\`

## License

MIT`
            },
            '.gitignore': {
                content: `__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/`
            }
        };
    }
    
    getStaticSiteTemplate() {
        return {
            'index.html': {
                content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{project_name}}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <nav>
            <h1>{{project_name}}</h1>
            <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>
    
    <main>
        <section id="home">
            <h2>Welcome</h2>
            <p>{{description}}</p>
            <button id="counter-btn">Click me! (0)</button>
        </section>
        
        <section id="about">
            <h2>About</h2>
            <p>This is a static website template.</p>
        </section>
        
        <section id="contact">
            <h2>Contact</h2>
            <p>Get in touch with us!</p>
        </section>
    </main>
    
    <footer>
        <p>&copy; 2024 {{project_name}}. All rights reserved.</p>
    </footer>
    
    <script src="script.js"></script>
</body>
</html>`
            },
            'styles.css': {
                content: `/* Reset and base styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Arial', sans-serif;
    line-height: 1.6;
    color: #333;
}

/* Header styles */
header {
    background: #007acc;
    color: white;
    padding: 1rem 0;
    position: fixed;
    width: 100%;
    top: 0;
    z-index: 1000;
}

nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
}

nav h1 {
    font-size: 1.5rem;
}

nav ul {
    display: flex;
    list-style: none;
    gap: 2rem;
}

nav a {
    color: white;
    text-decoration: none;
    transition: opacity 0.3s;
}

nav a:hover {
    opacity: 0.8;
}

/* Main content */
main {
    margin-top: 80px;
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
    padding: 2rem;
}

section {
    margin-bottom: 3rem;
    padding: 2rem;
    background: #f9f9f9;
    border-radius: 8px;
}

h2 {
    margin-bottom: 1rem;
    color: #007acc;
}

button {
    background: #007acc;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
    margin-top: 1rem;
}

button:hover {
    background: #005a9e;
}

/* Footer */
footer {
    background: #333;
    color: white;
    text-align: center;
    padding: 2rem;
    margin-top: 3rem;
}

/* Responsive design */
@media (max-width: 768px) {
    nav {
        flex-direction: column;
        gap: 1rem;
    }
    
    nav ul {
        gap: 1rem;
    }
    
    main {
        margin-top: 120px;
        padding: 1rem;
    }
}`
            },
            'script.js': {
                content: `// Simple JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    let count = 0;
    const button = document.getElementById('counter-btn');
    
    button.addEventListener('click', function() {
        count++;
        button.textContent = \`Click me! (\${count})\`;
    });
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    console.log('{{project_name}} initialized!');
});`
            },
            'README.md': {
                content: `# {{project_name}}

{{description}}

## Features

- Responsive design
- Smooth scrolling navigation
- Interactive elements with JavaScript
- Clean, modern styling

## Usage

1. Open \`index.html\` in your web browser
2. Or serve with a local server:

\`\`\`bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server
\`\`\`

## File Structure

- \`index.html\` - Main HTML file
- \`styles.css\` - CSS styles
- \`script.js\` - JavaScript functionality

## Customization

Edit the HTML, CSS, and JavaScript files to customize the website for your needs.

## License

MIT`
            }
        };
    }
    
    async generateProject(templateKey, projectName, targetDir, options = {}) {
        const template = this.templates[templateKey];
        if (!template) {
            throw new Error(`Template '${templateKey}' not found`);
        }
        
        const spinner = ora(`Generating ${template.name} project...`).start();
        
        try {
            // Create project directory
            const projectPath = path.join(targetDir, projectName);
            await fs.ensureDir(projectPath);
            
            // Template variables
            const vars = {
                project_name: projectName,
                description: options.description || template.description,
                author: options.author || 'Developer'
            };
            
            // Generate files
            for (const [filePath, fileInfo] of Object.entries(template.files)) {
                const fullPath = path.join(projectPath, filePath);
                const dir = path.dirname(fullPath);
                
                // Ensure directory exists
                await fs.ensureDir(dir);
                
                // Replace template variables
                let content = fileInfo.content;
                for (const [key, value] of Object.entries(vars)) {
                    const regex = new RegExp(`{{${key}}}`, 'g');
                    content = content.replace(regex, value);
                }
                
                // Write file
                await fs.writeFile(fullPath, content);
            }
            
            spinner.succeed(`Project '${projectName}' created successfully!`);
            
            // Show next steps
            console.log('\n' + chalk.bold.blue('🎉 Next Steps:'));
            console.log(chalk.gray('─'.repeat(40)));
            console.log(chalk.green(`cd ${projectName}`));
            
            if (templateKey.includes('node') || templateKey.includes('react') || templateKey.includes('vue') || templateKey.includes('express')) {
                console.log(chalk.green('npm install'));
                console.log(chalk.green('npm start'));
            } else if (templateKey === 'python-cli') {
                console.log(chalk.green('pip install -r requirements.txt'));
                console.log(chalk.green('python main.py --help'));
            } else if (templateKey === 'static-site') {
                console.log(chalk.green('open index.html'));
            }
            
            return projectPath;
            
        } catch (error) {
            spinner.fail(`Failed to generate project: ${error.message}`);
            throw error;
        }
    }
    
    async interactiveGenerate() {
        console.log(chalk.blue(figlet.textSync('Project Gen', { horizontalLayout: 'fitted' })));
        console.log(chalk.gray('Generate new projects from templates\n'));
        
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'template',
                message: 'Choose a project template:',
                choices: Object.entries(this.templates).map(([key, template]) => ({
                    name: `${template.name} - ${template.description}`,
                    value: key
                }))
            },
            {
                type: 'input',
                name: 'projectName',
                message: 'Project name:',
                validate: (input) => {
                    if (!input.trim()) return 'Project name is required';
                    if (!/^[a-zA-Z0-9-_]+$/.test(input)) return 'Use only letters, numbers, hyphens, and underscores';
                    return true;
                }
            },
            {
                type: 'input',
                name: 'description',
                message: 'Project description:',
                default: (answers) => this.templates[answers.template].description
            },
            {
                type: 'input',
                name: 'author',
                message: 'Author name:',
                default: 'Developer'
            },
            {
                type: 'input',
                name: 'targetDir',
                message: 'Target directory:',
                default: '.'
            }
        ]);
        
        await this.generateProject(
            answers.template,
            answers.projectName,
            answers.targetDir,
            {
                description: answers.description,
                author: answers.author
            }
        );
    }
    
    listTemplates() {
        console.log('\n' + chalk.bold.blue('📝 Available Templates'));
        console.log(chalk.gray('─'.repeat(50)));
        
        Object.entries(this.templates).forEach(([key, template]) => {
            console.log(chalk.green(`${key.padEnd(15)} - ${template.name}`));
            console.log(chalk.gray(`${' '.repeat(18)}${template.description}`));
        });
    }
}

// CLI Configuration
program
    .name('project-gen')
    .description('Project Generator - Scaffold new projects with templates')
    .version('1.0.0');

// Generate command
program
    .command('generate <template> <name>')
    .alias('gen')
    .description('Generate a project from template')
    .option('-d, --dir <directory>', 'target directory', '.')
    .option('--description <desc>', 'project description')
    .option('--author <author>', 'author name', 'Developer')
    .action(async (template, name, options) => {
        const generator = new ProjectGenerator();
        try {
            await generator.generateProject(template, name, options.dir, {
                description: options.description,
                author: options.author
            });
        } catch (error) {
            console.log(chalk.red(`❌ ${error.message}`));
            process.exit(1);
        }
    });

// Interactive mode
program
    .command('interactive')
    .alias('i')
    .description('Interactive project generation')
    .action(async () => {
        const generator = new ProjectGenerator();
        try {
            await generator.interactiveGenerate();
        } catch (error) {
            console.log(chalk.red(`❌ ${error.message}`));
            process.exit(1);
        }
    });

// List templates
program
    .command('list')
    .alias('ls')
    .description('List available templates')
    .action(() => {
        const generator = new ProjectGenerator();
        generator.listTemplates();
    });

// Parse command line arguments
if (require.main === module) {
    program.parse();
}

module.exports = ProjectGenerator;