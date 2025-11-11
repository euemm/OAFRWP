// Database module for SQLite operations
import sqlite3 from 'sqlite3'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, 'oafrwp.db')

// Promisify database methods
function createDatabase() {
	return new Promise((resolve, reject) => {
		const db = new sqlite3.Database(DB_PATH, (err) => {
			if (err) {
				reject(err)
			} else {
				resolve(db)
			}
		})
	})
}

function runQuery(db, query, params = []) {
	return new Promise((resolve, reject) => {
		db.run(query, params, function(err) {
			if (err) {
				reject(err)
			} else {
				resolve({ lastID: this.lastID, changes: this.changes })
			}
		})
	})
}

function getQuery(db, query, params = []) {
	return new Promise((resolve, reject) => {
		db.get(query, params, (err, row) => {
			if (err) {
				reject(err)
			} else {
				resolve(row)
			}
		})
	})
}

function allQuery(db, query, params = []) {
	return new Promise((resolve, reject) => {
		db.all(query, params, (err, rows) => {
			if (err) {
				reject(err)
			} else {
				resolve(rows)
			}
		})
	})
}

// Initialize database and create tables
export async function initDatabase() {
	const db = await createDatabase()

	// Create requests table
	await runQuery(db, `
		CREATE TABLE IF NOT EXISTS requests (
			timestamp TEXT PRIMARY KEY,
			email_address TEXT,
			title_of_article TEXT,
			amount_requested REAL,
			corresponding_author_name TEXT,
			corresponding_author_orcid TEXT,
			collaborating_author_list TEXT,
			collaborating_author_orcid_list TEXT,
			title_of_journal TEXT,
			journal_issn TEXT,
			publisher TEXT,
			article_status TEXT,
			publication_type TEXT,
			doi TEXT,
			comment TEXT,
			oa_fund_status TEXT
		)
	`)

	// Create budget table (history/audit log)
	await runQuery(db, `
		CREATE TABLE IF NOT EXISTS budget (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp TEXT NOT NULL,
			total_amount REAL NOT NULL,
			change_amount REAL NOT NULL,
			reason TEXT,
			running_total REAL NOT NULL,
			running_total_change REAL NOT NULL
		)
	`)


	// Create urls table
	await runQuery(db, `
		CREATE TABLE IF NOT EXISTS urls (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp TEXT NOT NULL,
			url TEXT NOT NULL,
			email TEXT NOT NULL
		)
	`)

	// Create files table
	await runQuery(db, `
		CREATE TABLE IF NOT EXISTS files (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp TEXT NOT NULL,
			filename TEXT NOT NULL,
			original_filename TEXT NOT NULL,
			email TEXT NOT NULL,
			file_size INTEGER NOT NULL,
			file_path TEXT NOT NULL
		)
	`)

	// Create credentials table
	await runQuery(db, `
		CREATE TABLE IF NOT EXISTS credentials (
			id TEXT PRIMARY KEY,
			pass_hashed TEXT NOT NULL
		)
	`)

	// Create indexes for better performance
	await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp)`)
	await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(oa_fund_status)`)
	await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_budget_timestamp ON budget(timestamp)`)
	await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_urls_timestamp ON urls(timestamp)`)
	await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_files_timestamp ON files(timestamp)`)
	await runQuery(db, `CREATE INDEX IF NOT EXISTS idx_files_email ON files(email)`)

	return db
}

// Get database connection (creates new connection each time)
export async function getDatabase() {
	return await createDatabase()
}

// Helper function for running queries (used by migration script)
export async function runQueryHelper(query, params = []) {
	const db = await createDatabase()
	try {
		const result = await runQuery(db, query, params)
		return result
	} finally {
		db.close()
	}
}

// Requests operations
export async function createRequest(data) {
	const db = await getDatabase()
	try {
		await runQuery(db, `
			INSERT INTO requests (
				timestamp, email_address, title_of_article, amount_requested,
				corresponding_author_name, corresponding_author_orcid,
				collaborating_author_list, collaborating_author_orcid_list,
				title_of_journal, journal_issn, publisher, article_status,
				publication_type, doi, comment, oa_fund_status
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, [
			data.timestamp,
			data.email_address || null,
			data.title_of_article || null,
			data.amount_requested || null,
			data.corresponding_author_name || null,
			data.corresponding_author_orcid || null,
			data.collaborating_author_list || null,
			data.collaborating_author_orcid_list || null,
			data.title_of_journal || null,
			data.journal_issn || null,
			data.publisher || null,
			data.article_status || null,
			data.publication_type || null,
			data.doi || null,
			data.comment || null,
			data.oa_fund_status || 'submitted'
		])
		return true
	} finally {
		db.close()
	}
}

export async function getAllRequests() {
	const db = await getDatabase()
	try {
		const rows = await allQuery(db, `SELECT * FROM requests ORDER BY timestamp DESC`)
		// Convert to format expected by frontend (matching CSV column names)
		return rows.map(row => ({
			'Timestamp': row.timestamp,
			'Email Address': row.email_address,
			'Title of Article / Chapter / Book': row.title_of_article,
			'Amount requested': row.amount_requested,
			'Corresponding Author Name': row.corresponding_author_name,
			'Corresponding Author ORCiD': row.corresponding_author_orcid,
			'Collaborating Author List': row.collaborating_author_list,
			'Collaborating Author ORCiD List (Optional)': row.collaborating_author_orcid_list,
			'Title of Journal': row.title_of_journal,
			'Journal ISSN': row.journal_issn,
			'Publisher': row.publisher,
			'Article Status': row.article_status,
			'Publication Type': row.publication_type,
			'DOI (if applicable)': row.doi,
			'Comment to library publishing team': row.comment,
			'OA fund status': row.oa_fund_status
		}))
	} finally {
		db.close()
	}
}

export async function getRequestByTimestamp(timestamp) {
	const db = await getDatabase()
	try {
		return await getQuery(db, `SELECT * FROM requests WHERE timestamp = ?`, [timestamp])
	} finally {
		db.close()
	}
}

export async function updateRequestStatus(timestamp, status) {
	const db = await getDatabase()
	try {
		const request = await getRequestByTimestamp(timestamp)
		if (!request) {
			throw new Error('Request not found')
		}

		// Validate status transitions
		const currentStatus = request.oa_fund_status?.trim()
		let validTransition = false

		if (status === 'APPROVED' && currentStatus === 'submitted') {
			validTransition = true
		} else if (status === 'DENIED' && currentStatus === 'submitted') {
			validTransition = true
		} else if (status === 'PAID' && (currentStatus === 'APPROVED' || currentStatus === 'PAYMENT_PLANNED')) {
			validTransition = true
		} else if (status === 'CANCELLED' && currentStatus === 'APPROVED') {
			validTransition = true
		} else if (status === 'PAYMENT_PLANNED' && currentStatus === 'APPROVED') {
			validTransition = true
		}

		if (!validTransition) {
			throw new Error('Invalid status transition')
		}

		await runQuery(db, `UPDATE requests SET oa_fund_status = ? WHERE timestamp = ?`, [status, timestamp])
		
		return {
			amount: request.amount_requested,
			email: request.email_address,
			title: request.title_of_article
		}
	} finally {
		db.close()
	}
}

export async function updateRequest(timestamp, updates) {
	const db = await getDatabase()
	try {
		const fields = []
		const values = []

		if (updates.email !== undefined) {
			fields.push('email_address = ?')
			values.push(updates.email)
		}
		if (updates.title !== undefined) {
			fields.push('title_of_article = ?')
			values.push(updates.title)
		}
		if (updates.amount !== undefined) {
			fields.push('amount_requested = ?')
			values.push(updates.amount)
		}
		if (updates.author !== undefined) {
			fields.push('corresponding_author_name = ?')
			values.push(updates.author)
		}
		if (updates.authorORCiD !== undefined) {
			fields.push('corresponding_author_orcid = ?')
			values.push(updates.authorORCiD)
		}
		if (updates.collab !== undefined) {
			fields.push('collaborating_author_list = ?')
			values.push(updates.collab)
		}
		if (updates.collabORCiD !== undefined) {
			fields.push('collaborating_author_orcid_list = ?')
			values.push(updates.collabORCiD)
		}
		if (updates.journal !== undefined) {
			fields.push('title_of_journal = ?')
			values.push(updates.journal)
		}
		if (updates.journalISSN !== undefined) {
			fields.push('journal_issn = ?')
			values.push(updates.journalISSN)
		}
		if (updates.publisher !== undefined) {
			fields.push('publisher = ?')
			values.push(updates.publisher)
		}
		if (updates.status !== undefined) {
			fields.push('article_status = ?')
			values.push(updates.status)
		}
		if (updates.type !== undefined) {
			fields.push('publication_type = ?')
			values.push(updates.type)
		}
		if (updates.DOI !== undefined) {
			fields.push('doi = ?')
			values.push(updates.DOI)
		}
		if (updates.comment !== undefined) {
			fields.push('comment = ?')
			values.push(updates.comment)
		}
		if (updates.OAstatus !== undefined) {
			fields.push('oa_fund_status = ?')
			values.push(updates.OAstatus)
		}

		if (fields.length === 0) {
			return false
		}

		values.push(timestamp)
		await runQuery(db, `UPDATE requests SET ${fields.join(', ')} WHERE timestamp = ?`, values)
		return true
	} finally {
		db.close()
	}
}

// Budget operations
export async function getAllBudgetRecords() {
	const db = await getDatabase()
	try {
		const rows = await allQuery(db, `SELECT * FROM budget ORDER BY timestamp DESC`)
		return rows.map(row => ({
			'Timestamp': row.timestamp,
			'Total Amount': row.total_amount,
			'Change': row.change_amount,
			'Reason': row.reason,
			'RunningTotal': row.running_total,
			'RunningTotalChange': row.running_total_change
		}))
	} finally {
		db.close()
	}
}

export async function getLatestBudget() {
	const db = await getDatabase()
	try {
		const latest = await getQuery(db, `SELECT * FROM budget ORDER BY timestamp DESC LIMIT 1`)
		if (!latest) {
			// Return default values if no budget records exist
			return {
				timestamp: new Date().toISOString(),
				total_amount: 0,
				running_total: 0,
				change_amount: 0,
				running_total_change: 0,
				reason: null
			}
		}
		return latest
	} finally {
		db.close()
	}
}

export async function addBudgetRecord(data) {
	const db = await getDatabase()
	try {
		await runQuery(db, `
			INSERT INTO budget (timestamp, total_amount, change_amount, reason, running_total, running_total_change)
			VALUES (?, ?, ?, ?, ?, ?)
		`, [
			data.timestamp,
			data.total_amount,
			data.change_amount || 0,
			data.reason || null,
			data.running_total || 0,
			data.running_total_change || 0
		])
		return true
	} finally {
		db.close()
	}
}

export async function changeBudgetTotal(amount, reason, updatedBy = null) {
	const latest = await getLatestBudget()
	const newTotal = (latest.total_amount || 0) + amount
	return await addBudgetRecord({
		timestamp: new Date().toISOString(),
		total_amount: newTotal,
		change_amount: amount,
		reason: reason,
		running_total: latest.running_total || 0,
		running_total_change: 0
	})
}

export async function changeRunningTotal(amount, reason, updatedBy = null) {
	const latest = await getLatestBudget()
	const newRunningTotal = (latest.running_total || 0) + amount
	return await addBudgetRecord({
		timestamp: new Date().toISOString(),
		total_amount: latest.total_amount || 0,
		change_amount: 0,
		reason: reason,
		running_total: newRunningTotal,
		running_total_change: amount
	})
}

export async function setBudgetTotal(totalAmount, reason, updatedBy = null) {
	const latest = await getLatestBudget()
	const changeAmount = latest.total_amount !== undefined ? (totalAmount - latest.total_amount) : totalAmount

	return await addBudgetRecord({
		timestamp: new Date().toISOString(),
		total_amount: totalAmount,
		change_amount: changeAmount,
		reason: reason,
		running_total: latest.running_total || 0,
		running_total_change: 0
	})
}

export async function setRunningTotal(totalAmount, reason, updatedBy = null) {
	const latest = await getLatestBudget()
	const changeAmount = latest.running_total !== undefined ? (totalAmount - (latest.running_total || 0)) : totalAmount

	return await addBudgetRecord({
		timestamp: new Date().toISOString(),
		total_amount: latest.total_amount || 0,
		change_amount: 0,
		reason: reason,
		running_total: totalAmount,
		running_total_change: changeAmount
	})
}

// URLs operations
export async function addURL(url, email) {
	const db = await getDatabase()
	try {
		await runQuery(db, `
			INSERT INTO urls (timestamp, url, email)
			VALUES (?, ?, ?)
		`, [new Date().toISOString(), url, email])
		return true
	} finally {
		db.close()
	}
}

export async function getAllURLs() {
	const db = await getDatabase()
	try {
		const rows = await allQuery(db, `SELECT * FROM urls ORDER BY timestamp DESC`)
		return rows.map(row => ({
			'Timestamp': row.timestamp,
			'URL': row.url,
			'Email': row.email
		}))
	} finally {
		db.close()
	}
}

// Files operations
export async function addFile(filename, originalFilename, email, fileSize, filePath) {
	const db = await getDatabase()
	try {
		await runQuery(db, `
			INSERT INTO files (timestamp, filename, original_filename, email, file_size, file_path)
			VALUES (?, ?, ?, ?, ?, ?)
		`, [
			new Date().toISOString(),
			filename,
			originalFilename,
			email,
			fileSize,
			filePath
		])
		return true
	} finally {
		db.close()
	}
}

export async function getAllFiles() {
	const db = await getDatabase()
	try {
		const rows = await allQuery(db, `SELECT * FROM files ORDER BY timestamp DESC`)
		return rows.map(row => ({
			name: row.filename,
			originalName: row.original_filename,
			size: row.file_size,
			mtime: row.timestamp,
			url: `/files/${encodeURIComponent(row.filename)}`,
			email: row.email
		}))
	} finally {
		db.close()
	}
}

export async function getFilesByEmail(email) {
	const db = await getDatabase()
	try {
		const rows = await allQuery(db, `SELECT * FROM files WHERE email = ? ORDER BY timestamp DESC`, [email])
		return rows.map(row => ({
			name: row.filename,
			originalName: row.original_filename,
			size: row.file_size,
			mtime: row.timestamp,
			url: `/files/${encodeURIComponent(row.filename)}`,
			email: row.email
		}))
	} finally {
		db.close()
	}
}

export async function getFileByFilename(filename) {
	const db = await getDatabase()
	try {
		return await getQuery(db, `SELECT * FROM files WHERE filename = ?`, [filename])
	} finally {
		db.close()
	}
}

// Credentials operations
export async function getUserById(id) {
	const db = await getDatabase()
	try {
		return await getQuery(db, `SELECT * FROM credentials WHERE id = ?`, [id])
	} finally {
		db.close()
	}
}

export async function getAllUsers() {
	const db = await getDatabase()
	try {
		return await allQuery(db, `SELECT * FROM credentials`)
	} finally {
		db.close()
	}
}

export async function addUser(id, passHash) {
	const db = await getDatabase()
	try {
		await runQuery(db, `INSERT INTO credentials (id, pass_hashed) VALUES (?, ?)`, [id, passHash])
		return true
	} finally {
		db.close()
	}
}

export async function loadUserMap() {
	const users = await getAllUsers()
	const map = new Map()
	for (const user of users) {
		if (user.id) {
			map.set(user.id, user.pass_hashed)
		}
	}
	return map
}

