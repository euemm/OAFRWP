#!/bin/bash

# Script to set up cron job for weekly database backups
# This script will add a cron job to run the backup script every week

# Get the absolute path to the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${PROJECT_DIR}/backup-db.js"
NODE_PATH="$(which node)"

# Check if Node.js is installed
if [ -z "$NODE_PATH" ]; then
	echo "Error: Node.js is not installed or not in PATH"
	exit 1
fi

# Check if backup script exists
if [ ! -f "$BACKUP_SCRIPT" ]; then
	echo "Error: Backup script not found at $BACKUP_SCRIPT"
	exit 1
fi

# Create cron job entry (runs every Sunday at 2:00 AM)
# Format: minute hour day-of-month month day-of-week command
CRON_JOB="0 2 * * 0 cd ${PROJECT_DIR} && ${NODE_PATH} ${BACKUP_SCRIPT} >> ${PROJECT_DIR}/backup.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
	echo "Cron job for backup script already exists"
	echo "Current crontab:"
	crontab -l | grep "$BACKUP_SCRIPT"
	echo ""
	echo "To remove the existing job, run:"
	echo "crontab -e"
	echo "Then delete the line containing: $BACKUP_SCRIPT"
	exit 0
fi

# Add cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "Cron job added successfully!"
echo "The backup will run every Sunday at 2:00 AM"
echo ""
echo "To view your crontab, run: crontab -l"
echo "To edit your crontab, run: crontab -e"
echo "To remove the cron job, run: crontab -e and delete the line"

