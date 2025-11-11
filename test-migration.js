// Quick test script to verify migration worked correctly
import * as db from './db.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function testMigration() {
	console.log('Testing SQLite migration...\n')

	try {
		// Test 1: Check if database file exists
		const dbPath = path.join(__dirname, 'oafrwp.db')
		if (!fs.existsSync(dbPath)) {
			console.error('ERROR: Database file (oafrwp.db) does not exist!')
			console.log('Run: node migrate.js first')
			process.exit(1)
		}
		console.log('✓ Database file exists')

		// Test 2: Check requests table
		const requests = await db.getAllRequests()
		console.log(`✓ Requests table: ${requests.length} records`)

		// Test 3: Check budget table
		const budgetRecords = await db.getAllBudgetRecords()
		console.log(`✓ Budget history table: ${budgetRecords.length} records`)

		// Test 4: Check latest budget record
		const latestBudget = await db.getLatestBudget()
		console.log(`✓ Latest budget: Total=${latestBudget.total_amount}, Running=${latestBudget.running_total}`)

		// Test 5: Check credentials table
		const users = await db.getAllUsers()
		console.log(`✓ Credentials table: ${users.length} users`)

		// Test 6: Check URLs table
		const urls = await db.getAllURLs()
		console.log(`✓ URLs table: ${urls.length} records`)

		// Test 7: Verify sample data structure
		if (requests.length > 0) {
			const sample = requests[0]
			console.log('\nSample request fields:')
			console.log(`  - Timestamp: ${sample['Timestamp']}`)
			console.log(`  - Email: ${sample['Email Address'] || 'N/A'}`)
			console.log(`  - Status: ${sample['OA fund status'] || 'N/A'}`)
		}

		if (budgetRecords.length > 0) {
			const latest = budgetRecords[0]
			console.log('\nLatest budget record:')
			console.log(`  - Total Amount: ${latest['Total Amount']}`)
			console.log(`  - Running Total: ${latest['RunningTotal']}`)
			console.log(`  - Reason: ${latest['Reason'] || 'N/A'}`)
		}

		if (users.length > 0) {
			console.log('\nMigrated users:')
			users.forEach(user => {
				console.log(`  - ${user.id}`)
			})
		}

		console.log('\n✓ All tests passed! Migration successful.')
		console.log('\nYou can now start the application with: npm start')

	} catch (error) {
		console.error('\n✗ Test failed:', error.message)
		console.error(error.stack)
		process.exit(1)
	}
}

testMigration()

