// Database backup and cleanup script
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, 'oafrwp.db')
const BACKUPS_DIR = path.join(__dirname, 'backups')
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

// Ensure backups directory exists
async function ensureBackupsDir() {
	try {
		await fsp.mkdir(BACKUPS_DIR, { recursive: true })
	} catch (error) {
		if (error.code !== 'EEXIST') {
			throw error
		}
	}
}

// Create a backup of the database
async function createBackup() {
	try {
		// Check if database exists
		if (!fs.existsSync(DB_PATH)) {
			console.error(`Database file not found: ${DB_PATH}`)
			return false
		}

		// Ensure backups directory exists
		await ensureBackupsDir()

		// Create backup filename with timestamp
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
			new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0]
		const backupFilename = `oafrwp-backup-${timestamp}.db`
		const backupPath = path.join(BACKUPS_DIR, backupFilename)

		// Copy database file to backup location
		await fsp.copyFile(DB_PATH, backupPath)

		console.log(`Backup created: ${backupPath}`)
		return backupPath
	} catch (error) {
		console.error('Error creating backup:', error)
		return false
	}
}

// Remove backups older than 1 month
async function removeOldBackups() {
	try {
		// Ensure backups directory exists
		await ensureBackupsDir()

		// Read all files in backups directory
		const files = await fsp.readdir(BACKUPS_DIR)
		const now = Date.now()
		let removedCount = 0

		for (const file of files) {
			// Only process .db backup files
			if (!file.startsWith('oafrwp-backup-') || !file.endsWith('.db')) {
				continue
			}

			const filePath = path.join(BACKUPS_DIR, file)
			
			try {
				const stats = await fsp.stat(filePath)
				const fileAge = now - stats.mtime.getTime()

				// Remove files older than 1 month
				if (fileAge > ONE_MONTH_MS) {
					await fsp.unlink(filePath)
					console.log(`Removed old backup: ${file} (${Math.round(fileAge / (24 * 60 * 60 * 1000))} days old)`)
					removedCount++
				}
			} catch (error) {
				console.error(`Error processing backup file ${file}:`, error.message)
			}
		}

		if (removedCount === 0) {
			console.log('No old backups to remove')
		} else {
			console.log(`Removed ${removedCount} old backup(s)`)
		}

		return removedCount
	} catch (error) {
		console.error('Error removing old backups:', error)
		return 0
	}
}

// Main function
async function main() {
	console.log('Starting database backup and cleanup...')
	console.log(`Database: ${DB_PATH}`)
	console.log(`Backups directory: ${BACKUPS_DIR}`)
	console.log('')

	// Create backup
	const backupPath = await createBackup()
	if (!backupPath) {
		console.error('Backup failed')
		process.exit(1)
	}

	console.log('')

	// Remove old backups
	await removeOldBackups()

	console.log('')
	console.log('Backup and cleanup completed successfully')
}

// Run main function when script is executed
main().catch((error) => {
	console.error('Backup script failed:', error)
	process.exit(1)
})

export { createBackup, removeOldBackups, ensureBackupsDir }

