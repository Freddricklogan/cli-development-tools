# CLI Development Tools

A collection of five command-line tools for common development tasks, built with Node.js and Python.

## Tools

### API Tester (`api_tester.js`)
Interactive HTTP client for testing REST APIs. Supports GET, POST, PUT, PATCH, DELETE with custom headers, request body, authentication, and response history.

```bash
node api_tester.js test https://api.example.com/users --method GET
node api_tester.js test https://api.example.com/users --method POST --body '{"name":"Fred"}'
node api_tester.js history   # View past requests
```

### Dev Server (`dev_server.js`)
Local development server with live reload, CORS support, and directory listing. Serves static files with automatic file watching.

```bash
node dev_server.js start --port 3000 --dir ./public
node dev_server.js start --cors --watch
```

### File Organizer (`file_organizer.py`)
Sorts files into folders by type or date. Includes duplicate detection (MD5 hash), empty folder cleanup, and directory statistics.

```bash
python3 file_organizer.py type ~/Downloads ~/Organized
python3 file_organizer.py date ~/Photos ~/Photos-by-date --format "%Y/%m"
python3 file_organizer.py duplicates ~/Documents
python3 file_organizer.py stats ~/Downloads
```

### Git Helper (`git_helper.js`)
Streamlines common git workflows -- interactive staging, commit message generation, branch management, and status overview.

```bash
node git_helper.js status
node git_helper.js commit -m "Add feature"
node git_helper.js branch list
```

### Project Generator (`project_generator.js`)
Scaffolds new projects from templates. Includes Node.js, React, Express, Python CLI, and static site templates with boilerplate files and directory structure.

```bash
node project_generator.js generate react-app my-project
node project_generator.js list          # Show available templates
node project_generator.js interactive   # Guided setup
```

## Setup

```bash
git clone https://github.com/Freddricklogan/cli-development-tools.git
cd cli-development-tools
npm install
```

**Requirements:** Node.js 14+, Python 3.6+

## Dependencies

- **chalk** -- Terminal colors
- **commander** -- CLI argument parsing
- **inquirer** -- Interactive prompts
- **axios** -- HTTP requests
- **express** -- Dev server
- **ora** -- Loading spinners
- **chokidar** -- File watching
- **fs-extra** -- File operations
- **figlet** -- ASCII art headers

## License

MIT
