// Migration script to import CSV data into SQLite database
import * as db from './db.js'
import fs from 'fs'
import { parse } from 'csv-parse'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REQUESTS_CSV = path.join(__dirname, 'requests.csv')
const BUDGET_CSV = path.join(__dirname, 'budget.csv')
const URLS_CSV = path.join(__dirname, 'urls.csv')
const CRED_CSV = path.join(__dirname, 'cred.csv')

function parseCSV(filePath) {
	return new Promise((resolve, reject) => {
		if (!fs.existsSync(filePath)) {
			console.log(`File ${filePath} does not exist, skipping...`)
			resolve([])
			return
		}

		const content = fs.readFileSync(filePath, 'utf8')
		parse(content, {
			columns: true,
			skip_empty_lines: true
		}, (err, records) => {
			if (err) {
				reject(err)
			} else {
				resolve(records)
			}
		})
	})
}

async function migrateRequests() {
	try {
		const records = await parseCSV(REQUESTS_CSV)
		if (records.length === 0) {
			console.log('No requests to migrate')
			return
		}

		console.log(`Migrating ${records.length} requests...`)
		let count = 0

		for (const record of records) {
			try {
				const requestData = {
					timestamp: record['Timestamp'] || record['timestamp'],
					email_address: record['Email Address'] || record['email_address'] || null,
					title_of_article: record['Title of Article / Chapter / Book'] || record['title_of_article'] || null,
					amount_requested: record['Amount requested'] || record['amount_requested'] || null,
					corresponding_author_name: record['Corresponding Author Name'] || record['corresponding_author_name'] || null,
					corresponding_author_orcid: record['Corresponding Author ORCiD'] || record['corresponding_author_orcid'] || null,
					collaborating_author_list: record['Collaborating Author List'] || record['collaborating_author_list'] || null,
					collaborating_author_orcid_list: record['Collaborating Author ORCiD List (Optional)'] || record['collaborating_author_orcid_list'] || null,
					title_of_journal: record['Title of Journal'] || record['title_of_journal'] || null,
					journal_issn: record['Journal ISSN'] || record['journal_issn'] || null,
					publisher: record['Publisher'] || record['publisher'] || null,
					article_status: record['Article Status'] || record['article_status'] || null,
					publication_type: record['Publication Type'] || record['publication_type'] || null,
					doi: record['DOI (if applicable)'] || record['doi'] || null,
					comment: record['Comment to library publishing team'] || record['comment'] || null,
					oa_fund_status: record['OA fund status'] || record['oa_fund_status'] || 'submitted'
				}

				await db.createRequest(requestData)
				count++
			} catch (error) {
				console.error(`Error migrating request ${record['Timestamp'] || record['timestamp']}:`, error.message)
			}
		}

		console.log(`Successfully migrated ${count} requests`)
	} catch (error) {
		console.error('Error migrating requests:', error)
	}
}

async function migrateBudget() {
	try {
		const records = await parseCSV(BUDGET_CSV)
		if (records.length === 0) {
			console.log('No budget records to migrate')
			return
		}

		console.log(`Migrating ${records.length} budget records...`)
		let count = 0

		for (const record of records) {
			try {
				const budgetData = {
					timestamp: record['Timestamp'] || record['timestamp'],
					total_amount: parseFloat(record['Total Amount'] || record['total_amount'] || 0),
					change_amount: parseFloat(record['Change'] || record['change_amount'] || 0),
					reason: record['Reason'] || record['reason'] || null,
					running_total: parseFloat(record['RunningTotal'] || record['running_total'] || 0),
					running_total_change: parseFloat(record['RunningTotalChange'] || record['running_total_change'] || 0)
				}

				await db.addBudgetRecord(budgetData)
				count++
			} catch (error) {
				console.error(`Error migrating budget record ${record['Timestamp'] || record['timestamp']}:`, error.message)
			}
		}

		console.log(`Successfully migrated ${count} budget records`)
	} catch (error) {
		console.error('Error migrating budget:', error)
	}
}

async function migrateURLs() {
	try {
		const records = await parseCSV(URLS_CSV)
		if (records.length === 0) {
			console.log('No URLs to migrate')
			return
		}

		console.log(`Migrating ${records.length} URLs...`)
		let count = 0

		for (const record of records) {
			try {
				const url = record['URL'] || record['url'] || record['Url']
				const email = record['Email'] || record['email'] || record['Email Address']
				const timestamp = record['Timestamp'] || record['timestamp']

				if (url && email) {
					// Use existing timestamp if available, otherwise use current time
					await db.runQueryHelper(`
						INSERT INTO urls (timestamp, url, email)
						VALUES (?, ?, ?)
					`, [timestamp || new Date().toISOString(), url, email])
					count++
				}
			} catch (error) {
				console.error(`Error migrating URL:`, error.message)
			}
		}

		console.log(`Successfully migrated ${count} URLs`)
	} catch (error) {
		console.error('Error migrating URLs:', error)
	}
}

async function migrateCredentials() {
	try {
		const records = await parseCSV(CRED_CSV)
		if (records.length === 0) {
			console.log('No credentials to migrate')
			return
		}

		console.log(`Migrating ${records.length} credentials...`)
		let count = 0

		for (const record of records) {
			try {
				const id = record['id'] || record['Id']
				const passHash = record['pass_hashed'] || record['pass_hashed']

				if (id && passHash) {
					await db.addUser(id, passHash)
					count++
				}
			} catch (error) {
				console.error(`Error migrating credential for ${record['id']}:`, error.message)
			}
		}

		console.log(`Successfully migrated ${count} credentials`)
	} catch (error) {
		console.error('Error migrating credentials:', error)
	}
}

async function main() {
	console.log('Starting migration from CSV to SQLite...')
	console.log('')

	// Initialize database
	try {
		await db.initDatabase()
		console.log('Database initialized')
	} catch (error) {
		console.error('Error initializing database:', error)
		process.exit(1)
	}

	// Migrate data
	await migrateRequests()
	console.log('')
	await migrateBudget()
	console.log('')
	await migrateURLs()
	console.log('')
	await migrateCredentials()
	console.log('')

	console.log('Migration completed!')
	console.log('You can now use the SQLite database instead of CSV files.')
	console.log('Note: The original CSV files are preserved for backup.')
}

main().catch((error) => {
	console.error('Migration failed:', error)
	process.exit(1)
})

