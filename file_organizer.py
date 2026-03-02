#!/usr/bin/env python3
"""
File Organizer CLI Tool
Automatically organize files by type, date, or custom rules
"""

import os
import shutil
from pathlib import Path
from datetime import datetime
import argparse
import json
import sys
from typing import Dict, List, Optional
import hashlib
from collections import defaultdict


class FileOrganizer:
    def __init__(self, config_file: str = "organizer_config.json"):
        self.config_file = config_file
        self.file_types = {
            'images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.tiff'],
            'videos': ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'],
            'audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
            'documents': ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.pages'],
            'spreadsheets': ['.xls', '.xlsx', '.csv', '.ods', '.numbers'],
            'presentations': ['.ppt', '.pptx', '.odp', '.key'],
            'archives': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'],
            'code': ['.py', '.js', '.html', '.css', '.cpp', '.java', '.c', '.php', '.rb'],
            'executables': ['.exe', '.msi', '.dmg', '.pkg', '.deb', '.rpm', '.appimage']
        }
        self.load_config()
    
    def load_config(self):
        """Load configuration from JSON file."""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    self.file_types.update(config.get('file_types', {}))
                print(f"📁 Loaded configuration from {self.config_file}")
            except Exception as e:
                print(f"❌ Error loading config: {e}")
    
    def save_config(self):
        """Save current configuration to JSON file."""
        try:
            config = {'file_types': self.file_types}
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
            print(f"💾 Saved configuration to {self.config_file}")
        except Exception as e:
            print(f"❌ Error saving config: {e}")
    
    def get_file_type(self, file_path: Path) -> str:
        """Determine file type based on extension."""
        extension = file_path.suffix.lower()
        
        for file_type, extensions in self.file_types.items():
            if extension in extensions:
                return file_type
        
        return 'others'
    
    def get_file_hash(self, file_path: Path) -> str:
        """Calculate MD5 hash of file for duplicate detection."""
        hash_md5 = hashlib.md5()
        try:
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception:
            return ""
    
    def organize_by_type(self, source_dir: str, target_dir: str, dry_run: bool = False) -> Dict:
        """Organize files by type into subfolders."""
        source_path = Path(source_dir)
        target_path = Path(target_dir)
        
        if not source_path.exists():
            raise FileNotFoundError(f"Source directory '{source_dir}' does not exist")
        
        if not dry_run:
            target_path.mkdir(parents=True, exist_ok=True)
        
        stats = defaultdict(int)
        moved_files = []
        
        for file_path in source_path.rglob('*'):
            if file_path.is_file():
                file_type = self.get_file_type(file_path)
                
                # Create type-specific directory
                type_dir = target_path / file_type
                if not dry_run:
                    type_dir.mkdir(exist_ok=True)
                
                # Handle filename conflicts
                target_file = type_dir / file_path.name
                counter = 1
                base_name = file_path.stem
                extension = file_path.suffix
                
                while target_file.exists() and not dry_run:
                    target_file = type_dir / f"{base_name}_{counter}{extension}"
                    counter += 1
                
                stats[file_type] += 1
                moved_files.append({
                    'source': str(file_path),
                    'target': str(target_file),
                    'type': file_type,
                    'size': file_path.stat().st_size
                })
                
                if not dry_run:
                    try:
                        shutil.move(str(file_path), str(target_file))
                        print(f"📁 {file_type}: {file_path.name} → {target_file}")
                    except Exception as e:
                        print(f"❌ Error moving {file_path.name}: {e}")
        
        return {
            'stats': dict(stats),
            'moved_files': moved_files,
            'total_files': len(moved_files)
        }
    
    def organize_by_date(self, source_dir: str, target_dir: str, date_format: str = "%Y/%m", dry_run: bool = False) -> Dict:
        """Organize files by creation/modification date."""
        source_path = Path(source_dir)
        target_path = Path(target_dir)
        
        if not source_path.exists():
            raise FileNotFoundError(f"Source directory '{source_dir}' does not exist")
        
        if not dry_run:
            target_path.mkdir(parents=True, exist_ok=True)
        
        stats = defaultdict(int)
        moved_files = []
        
        for file_path in source_path.rglob('*'):
            if file_path.is_file():
                # Get file creation/modification date
                stat = file_path.stat()
                file_date = datetime.fromtimestamp(stat.st_mtime)
                date_folder = file_date.strftime(date_format)
                
                # Create date-specific directory
                date_dir = target_path / date_folder
                if not dry_run:
                    date_dir.mkdir(parents=True, exist_ok=True)
                
                # Handle filename conflicts
                target_file = date_dir / file_path.name
                counter = 1
                base_name = file_path.stem
                extension = file_path.suffix
                
                while target_file.exists() and not dry_run:
                    target_file = date_dir / f"{base_name}_{counter}{extension}"
                    counter += 1
                
                stats[date_folder] += 1
                moved_files.append({
                    'source': str(file_path),
                    'target': str(target_file),
                    'date': file_date.isoformat(),
                    'size': file_path.stat().st_size
                })
                
                if not dry_run:
                    try:
                        shutil.move(str(file_path), str(target_file))
                        print(f"📅 {date_folder}: {file_path.name} → {target_file}")
                    except Exception as e:
                        print(f"❌ Error moving {file_path.name}: {e}")
        
        return {
            'stats': dict(stats),
            'moved_files': moved_files,
            'total_files': len(moved_files)
        }
    
    def find_duplicates(self, directory: str) -> Dict:
        """Find duplicate files based on content hash."""
        dir_path = Path(directory)
        
        if not dir_path.exists():
            raise FileNotFoundError(f"Directory '{directory}' does not exist")
        
        file_hashes = defaultdict(list)
        duplicates = {}
        
        print(f"🔍 Scanning for duplicates in {directory}...")
        
        for file_path in dir_path.rglob('*'):
            if file_path.is_file():
                file_hash = self.get_file_hash(file_path)
                if file_hash:
                    file_hashes[file_hash].append(file_path)
        
        # Find files with same hash
        for file_hash, files in file_hashes.items():
            if len(files) > 1:
                duplicates[file_hash] = [
                    {
                        'path': str(f),
                        'size': f.stat().st_size,
                        'modified': datetime.fromtimestamp(f.stat().st_mtime).isoformat()
                    }
                    for f in files
                ]
        
        return duplicates
    
    def remove_duplicates(self, directory: str, keep_newest: bool = True, dry_run: bool = False) -> Dict:
        """Remove duplicate files, keeping newest or oldest."""
        duplicates = self.find_duplicates(directory)
        removed_files = []
        saved_space = 0
        
        for file_hash, files in duplicates.items():
            if len(files) > 1:
                # Sort by modification time
                sorted_files = sorted(files, key=lambda x: x['modified'], reverse=keep_newest)
                
                # Keep first file, remove others
                to_keep = sorted_files[0]
                to_remove = sorted_files[1:]
                
                print(f"\n🔍 Duplicate set (hash: {file_hash[:8]}...):")
                print(f"✅ Keeping: {to_keep['path']}")
                
                for file_info in to_remove:
                    file_path = Path(file_info['path'])
                    if file_path.exists():
                        print(f"🗑️ Removing: {file_info['path']}")
                        
                        if not dry_run:
                            try:
                                file_path.unlink()
                                removed_files.append(file_info)
                                saved_space += file_info['size']
                            except Exception as e:
                                print(f"❌ Error removing {file_info['path']}: {e}")
        
        return {
            'removed_files': removed_files,
            'saved_space_bytes': saved_space,
            'saved_space_mb': saved_space / (1024 * 1024),
            'total_removed': len(removed_files)
        }
    
    def clean_empty_folders(self, directory: str, dry_run: bool = False) -> List[str]:
        """Remove empty folders."""
        dir_path = Path(directory)
        removed_folders = []
        
        # Walk directory tree bottom-up to handle nested empty folders
        for folder_path in sorted(dir_path.rglob('*'), key=lambda x: len(x.parts), reverse=True):
            if folder_path.is_dir() and not any(folder_path.iterdir()):
                print(f"📁 Empty folder: {folder_path}")
                if not dry_run:
                    try:
                        folder_path.rmdir()
                        removed_folders.append(str(folder_path))
                        print(f"🗑️ Removed: {folder_path}")
                    except Exception as e:
                        print(f"❌ Error removing {folder_path}: {e}")
        
        return removed_folders
    
    def get_directory_stats(self, directory: str) -> Dict:
        """Get detailed statistics about directory contents."""
        dir_path = Path(directory)
        
        if not dir_path.exists():
            raise FileNotFoundError(f"Directory '{directory}' does not exist")
        
        stats = {
            'total_files': 0,
            'total_size': 0,
            'file_types': defaultdict(int),
            'file_type_sizes': defaultdict(int),
            'largest_files': [],
            'oldest_files': [],
            'newest_files': []
        }
        
        all_files = []
        
        for file_path in dir_path.rglob('*'):
            if file_path.is_file():
                file_size = file_path.stat().st_size
                file_mtime = file_path.stat().st_mtime
                file_type = self.get_file_type(file_path)
                
                stats['total_files'] += 1
                stats['total_size'] += file_size
                stats['file_types'][file_type] += 1
                stats['file_type_sizes'][file_type] += file_size
                
                all_files.append({
                    'path': str(file_path),
                    'size': file_size,
                    'modified': file_mtime,
                    'type': file_type
                })
        
        # Get largest files
        stats['largest_files'] = sorted(all_files, key=lambda x: x['size'], reverse=True)[:10]
        
        # Get oldest and newest files
        stats['oldest_files'] = sorted(all_files, key=lambda x: x['modified'])[:10]
        stats['newest_files'] = sorted(all_files, key=lambda x: x['modified'], reverse=True)[:10]
        
        return stats


def format_size(size_bytes: int) -> str:
    """Format file size in human readable format."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} PB"


def create_parser() -> argparse.ArgumentParser:
    """Create command line argument parser."""
    parser = argparse.ArgumentParser(description="File Organizer CLI Tool")
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Organize by type
    type_parser = subparsers.add_parser('type', help='Organize files by type')
    type_parser.add_argument('source', help='Source directory')
    type_parser.add_argument('target', help='Target directory')
    type_parser.add_argument('--dry-run', action='store_true', help='Preview without moving files')
    
    # Organize by date
    date_parser = subparsers.add_parser('date', help='Organize files by date')
    date_parser.add_argument('source', help='Source directory')
    date_parser.add_argument('target', help='Target directory')
    date_parser.add_argument('--format', default='%Y/%m', help='Date format (default: %%Y/%%m)')
    date_parser.add_argument('--dry-run', action='store_true', help='Preview without moving files')
    
    # Find duplicates
    dup_parser = subparsers.add_parser('duplicates', help='Find duplicate files')
    dup_parser.add_argument('directory', help='Directory to scan')
    
    # Remove duplicates
    clean_dup_parser = subparsers.add_parser('clean-duplicates', help='Remove duplicate files')
    clean_dup_parser.add_argument('directory', help='Directory to clean')
    clean_dup_parser.add_argument('--keep-oldest', action='store_true', help='Keep oldest instead of newest')
    clean_dup_parser.add_argument('--dry-run', action='store_true', help='Preview without removing files')
    
    # Clean empty folders
    clean_parser = subparsers.add_parser('clean-empty', help='Remove empty folders')
    clean_parser.add_argument('directory', help='Directory to clean')
    clean_parser.add_argument('--dry-run', action='store_true', help='Preview without removing folders')
    
    # Directory statistics
    stats_parser = subparsers.add_parser('stats', help='Show directory statistics')
    stats_parser.add_argument('directory', help='Directory to analyze')
    
    return parser


def main():
    """Main application entry point."""
    parser = create_parser()
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    organizer = FileOrganizer()
    
    try:
        if args.command == 'type':
            print(f"🗂️ Organizing files by type: {args.source} → {args.target}")
            if args.dry_run:
                print("👀 DRY RUN - No files will be moved")
            
            result = organizer.organize_by_type(args.source, args.target, args.dry_run)
            
            print(f"\n📊 Summary:")
            print(f"Total files: {result['total_files']}")
            for file_type, count in result['stats'].items():
                print(f"  {file_type}: {count} files")
        
        elif args.command == 'date':
            print(f"📅 Organizing files by date: {args.source} → {args.target}")
            if args.dry_run:
                print("👀 DRY RUN - No files will be moved")
            
            result = organizer.organize_by_date(args.source, args.target, args.format, args.dry_run)
            
            print(f"\n📊 Summary:")
            print(f"Total files: {result['total_files']}")
            for date_folder, count in result['stats'].items():
                print(f"  {date_folder}: {count} files")
        
        elif args.command == 'duplicates':
            print(f"🔍 Finding duplicates in: {args.directory}")
            duplicates = organizer.find_duplicates(args.directory)
            
            if not duplicates:
                print("✅ No duplicates found!")
            else:
                print(f"\n🔍 Found {len(duplicates)} sets of duplicates:")
                for file_hash, files in duplicates.items():
                    print(f"\nDuplicate set (hash: {file_hash[:8]}...):")
                    for file_info in files:
                        print(f"  📄 {file_info['path']} ({format_size(file_info['size'])})")
        
        elif args.command == 'clean-duplicates':
            print(f"🧹 Cleaning duplicates in: {args.directory}")
            if args.dry_run:
                print("👀 DRY RUN - No files will be removed")
            
            result = organizer.remove_duplicates(
                args.directory, 
                keep_newest=not args.keep_oldest, 
                dry_run=args.dry_run
            )
            
            print(f"\n📊 Summary:")
            print(f"Files removed: {result['total_removed']}")
            print(f"Space saved: {format_size(result['saved_space_bytes'])}")
        
        elif args.command == 'clean-empty':
            print(f"🧹 Cleaning empty folders in: {args.directory}")
            if args.dry_run:
                print("👀 DRY RUN - No folders will be removed")
            
            removed = organizer.clean_empty_folders(args.directory, args.dry_run)
            print(f"\n📊 Removed {len(removed)} empty folders")
        
        elif args.command == 'stats':
            print(f"📊 Analyzing directory: {args.directory}")
            stats = organizer.get_directory_stats(args.directory)
            
            print(f"\n📈 Directory Statistics:")
            print(f"Total files: {stats['total_files']:,}")
            print(f"Total size: {format_size(stats['total_size'])}")
            
            print(f"\n📁 Files by type:")
            for file_type, count in sorted(stats['file_types'].items(), key=lambda x: x[1], reverse=True):
                size = stats['file_type_sizes'][file_type]
                print(f"  {file_type}: {count:,} files ({format_size(size)})")
            
            print(f"\n📈 Largest files:")
            for file_info in stats['largest_files'][:5]:
                print(f"  {format_size(file_info['size'])}: {Path(file_info['path']).name}")
    
    except KeyboardInterrupt:
        print("\n👋 Operation cancelled")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()