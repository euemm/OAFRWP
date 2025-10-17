//invoice page - view and upload page : NEED BETTER VISUALIZATION
//login / token feature : DONE?
//upload to the server : DONE
//CSRF TOKEN?? : NO
//Budget page at the top of the requests page

//constant dec
const SUBMITTED = 'submitted'
const APPROVED = 'APPROVED'
const DENIED = 'DENIED'
const PAID = 'PAID'
const PAYMENT_PLANNED = 'PAYMENT_PLANNED'
const CANCELLED = 'CANCELLED'

//Settings for express server
import express from 'express'
const app = express()
const port = 3000

//Settings for csv file editing
import fs, { stat } from 'fs'
import { parse } from 'csv-parse'
const __dirname = new URL(".", import.meta.url).pathname
const __filename = 'requests.csv'
const __budgetFileName = 'budget.csv'
const __urlsFileName = 'urls.csv'
import os from 'os'

//Settings for web views
import path from 'path'
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

//settings for uploading files
import multer from 'multer' //multer is node-js middleware for file-handling
if (!fs.existsSync(path.join(__dirname, 'files'))) { //creates /files directory if it does not exist
	fs.mkdirSync(path.join(__dirname, 'files'))
}

//Settings for security
import fsp from 'fs/promises'
import crypto from 'crypto'
const CREDENTIALS = path.join(__dirname, 'cred.csv')
const TOKEN_TTL_SECONDS = 60 * 60 //this sets the token expiration time. 60 * 60 === 60 minutes of 60 seconds.
import 'dotenv/config'
const TOKEN_SECRET = process.env.TOKEN_SECRET
import cookieParser from 'cookie-parser'
import { time } from 'console'
app.use(cookieParser())

//Settings for apache
app.set('trust proxy', 1); // if exactly one proxy (Apache) is in front

// const LOCAL = 'https://oafund.library.brandeis.edu'
const LOCAL = 'http://localhost:3000'

//MULTER storage settings like default naming
const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, path.join(__dirname, 'files')),
	filename: (req, file, cb) => {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
		const safeBase = path.parse(file.originalname).name.replace(/[^À-\u024f\w\- ]+/g, '_').trim().replace(/\s+/g, '_')
		const email = (req.body && req.body.email) ? String(req.body.email) : ''
		const emailSafe = email.toLowerCase().trim().replace(/[^a-z0-9._+\-@]/gi, '_') || 'NOEMAIL'
		cb(null, `${emailSafe}__${safeBase || 'file'}-${timestamp}.pdf`)
		//saves file as filename-timestamp.pdf or file-timestamp.pdf if filename fails.
	}
})

//MULTER upload settings like filetype check or size limit check
const upload = multer({
	storage,
	fileFilter(req, file, cb) {
		if (isPDF(file)) return cb(null, true)
		cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'only pdf files are allowed'))
	},
	nodlimits: { fileSize: 50 * 1024 * 1024, files: 10 } // up to 10 PDFs, 50MB each
})

//checks if file[MULTER] is .pdf
function isPDF(file) {
	const mime = (file.mimetype || '').toLowerCase()
	return (
		mime === 'application/pdf' ||
		mime === 'application/x-pdf' ||
		mime === 'application/acrobat' ||
		mime === 'application/nappdf' ||
		/\.pdf$/i.test(file.originalname)
	)
}

//settings for req body use of json
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

//serve static files from public directory
app.use('/public', express.static(path.join(__dirname, 'public')))

// Apply SSO attribute extraction to all routes
app.use(extractSSOAttributes)

//settings for viewing files
const filesRouter = express.Router()
const FILES_DIR = path.join(__dirname, 'files')
filesRouter.get('/', async (req, res, next) => {// GET /files -> list files (HTML in browser, JSON for APIs)
	try {
		const entries = await fsp.readdir(FILES_DIR, { withFileTypes: true })
		const files = []
		for (const d of entries) {
			if (!d.isFile()) continue
			if (d.name.startsWith('.')) continue
			const full = path.join(FILES_DIR, d.name)
			const st = await fsp.stat(full)
			files.push({
				name: d.name,
				size: st.size,
				mtime: st.mtime.toISOString(),
				url: `/files/${encodeURIComponent(d.name)}`
			})
		}
		// newest first
		files.sort((a, b) => b.mtime.localeCompare(a.mtime))

		// if (req.accepts('html')) {
		//   // Simple HTML index
		//   const list = files
		//     .map(f => `<li><a href="${f.url}">${f.name}</a> <small>(${(f.size/1024).toFixed(1)} KB)</small></li>`)
		//     .join('')
		//   return res.type('html').send(
		//     `<!doctype html><meta charset="utf-8">
		//      <title>Files</title>
		//      <h1>Files</h1>
		//      <ul>${list || '<li><em>No files found.</em></li>'}</ul>`
		//   )
		// }
		return res.json({ files })
	} catch (err) {
		next(err)
	}
})
filesRouter.use(// Static serving: /files/filename.pdf
	express.static(FILES_DIR, {
		index: false,
		setHeaders(res, filePath) {
			res.set('Content-Type', 'application/pdf; charset=utf-8')
			res.set('Content-Disposition', `inline; filename="${path.basename(filePath)}"`)
			// Avoid shared caching of protected files (optional)
			res.set('Cache-Control', 'private, no-store')
		}
	})
)

//serves all the files at /files
//TODO: DO I WANT THIS or more complicated for security??
app.use('/files', auth, filesRouter)


//debug endpoint to check SSO attributes
app.get('/whoami', (req, res) => {
	// Express lowercases header names
	const h = req.headers;
	res.json({
		email:      h['x-email'] || h['mail'] || null,
		name:       h['x-name']  || h['displayname'] || null,
		eppn:       h['x-eppn']  || h['eppn'] || null,
		remoteUser: h['x-remote-user'] || h['remote-user'] || null,
		given:      h['x-given-name'] || h['givenname'] || null,
		sn:         h['x-surname'] || h['sn'] || null,
		_debugAll:  h, // remove later
	});
});

//web view for the request form
app.get('/', (req, res) => {

	res.render('index', {
		endPoint : LOCAL,
		user: req.ssoUser || null
	})

})

//web view for successful request submissions
// app.get('/success', auth, (req, res) => {

// 	res.render('success', { title: 'success', message: 'hello world' })

// })

//web view for failed request submissions
// app.get('/fail', auth, (req, res) => {

// 	res.render('fail', { title: 'fail', message: 'fail' })

// })

//web view to view all the requests
app.get('/requests', auth, (req, res) => {

	// res.render('requests', { title: 'requests', message: 'requests' })
	res.render('requests', {
		endPoint : LOCAL,
		pageTitle: 'OA Requests',
		fetchUrl: `${LOCAL}/fetch`,
		fetchBudgetUrl: `${LOCAL}/fetchBudget`,
		approveUrl: `${LOCAL}/approve`,
		denyUrl: `${LOCAL}/deny`,
		cancelUrl: `${LOCAL}/cancel`,
		paidUrl: `${LOCAL}/paid`,
		paymentPlannedUrl: `${LOCAL}/planned`,
		headerBgUrl: `/public/header.jpg`// serve this or change the path
  });

})

//web view to view budget history
app.get('/budget-history', auth, (req, res) => {
	res.render('budget-history', {
		endPoint: LOCAL,
		pageTitle: 'Budget History',
		fetchBudgetUrl: `${LOCAL}/fetchBudget`,
		headerBgUrl: `/public/header.jpg`// serve this or change the path
  });
})

//web view to view all uploaded files
app.get('/files-page', auth, (req, res) => {
	res.render('files', {
		endPoint: LOCAL,
		pageTitle: 'Uploaded Files',
		fetchFilesUrl: `${LOCAL}/files`,
		headerBgUrl: `/public/header.jpg`// serve this or change the path
  });
})

app.get('/upload', (req, res) => {

	res.render('upload', { endPoint: LOCAL })

})

app.get('/login', (req, res) => {

	res.render('login', { endPoint: LOCAL })

})

//uploading pdf files
// [POST] /upload with form field name "pdfs" and has limit of 10 pdf files with 50mb filesize limit per file
app.post('/upload', upload.array('pdfs', 10), (req, res) => {

	const files = (req.files || []).map(f => ({
		originalName: f.originalName,
		filename: f.filename,
		size: f.size,
		url: `/files/${encodeURIComponent(f.filename)}`
	}))

	res.status(201).json({ uploaded: files })

})

app.post('/uploadURL', (req, res) => {

	const url = req.body.url ? req.body.url : ''
	const email = req.body.email ? req.body.email : ''

	if (!url || url.trim() === '') {
		return res.status(400).json({ error: 'URL is required' })
	}

	if (!email || email.trim() === '') {
		return res.status(400).json({ error: 'Email is required' })
	}
	
	const input = [
		new Date().toISOString(),
		url,
		email
	]

	fs.appendFileSync(path.join(__dirname, 'urls.csv'), input.join(",") + os.EOL)
	
	return res.status(200).json({ message: 'URL uploaded successfully' })

})

// Error handling for file uploads
app.use((err, req, res, next) => {
	if (err instanceof multer.MulterError) {
		const msg =
			err.code === 'LIMIT_FILE_SIZE'
				? 'File too large'
				: err.code === 'LIMIT_UNEXPECTED_FILE'
					? 'Only PDF files are allowed'
					: err.message
		return res.status(400).json({ error: msg, code: err.code })
	}
	console.error(err)
	res.status(500).json({ error: 'Internal server error' })
})

//method to ensure files are ending with os.EOL
function ensureCSV(filePath) {

	try {

		const content = fs.readFileSync(filePath, 'utf8')
	
		const list = content.split(os.EOL)

		const cols = list[0].split(',').length

		for(let i = 1; i < list.length; i ++) {

			if(list[i].split(',').length > cols) {

				list[i] = list[i].split(',').slice(0, cols).join(',')

			}

		}
		
		const newcontent = list.join(os.EOL)

		fs.writeFileSync(filePath, newcontent)

		if(content.length > 0 && content[content.length - 1] !== os.EOL) {

			fs.appendFileSync(filePath, os.EOL)

		}

 	} catch {

		console.log('asdfasdf')

	}

}

//method to validate and fix budget.csv format
function validateBudgetCSV(filePath) {

	try {

		const content = fs.readFileSync(filePath, 'utf8')
		const lines = content.trim().split(os.EOL)
		
		if (lines.length === 0) {
			console.log('Budget file is empty, creating header')
			const header = 'Timestamp,Total Amount,Change,Reason,RunningTotal,RunningTotalChange'
			fs.writeFileSync(filePath, header + os.EOL)
			return
		}

		// Validate header
		const expectedHeader = 'Timestamp,Total Amount,Change,Reason,RunningTotal,RunningTotalChange'
		if (lines[0] !== expectedHeader) {
			console.log('Fixing budget header format')
			lines[0] = expectedHeader
		}

		let needsRewrite = false
		const fixedLines = [lines[0]] // Start with header

		// Process data rows (skip header)
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim()
			if (!line) continue // Skip empty lines

			const fields = line.split(',')
			
			// Ensure we have exactly 6 fields
			if (fields.length !== 6) {
				console.log(`Fixing budget row ${i}: incorrect field count`)
				// Pad with empty fields or truncate as needed
				while (fields.length < 6) {
					fields.push('')
				}
				fields.splice(6) // Remove excess fields
				needsRewrite = true
			}

			// Validate and fix numeric fields
			const numericFields = [1, 2, 4, 5] // Total Amount, Change, RunningTotal, RunningTotalChange
			for (const fieldIndex of numericFields) {
				const value = fields[fieldIndex].trim()
				if (value === '' || value === 'undefined' || value === 'null') {
					fields[fieldIndex] = '0'
					needsRewrite = true
				} else {
					// Try to parse as number and validate
					const numValue = Number(value)
					if (isNaN(numValue) || !isFinite(numValue)) {
						console.log(`Fixing budget row ${i}, field ${fieldIndex}: invalid number "${value}" -> 0`)
						fields[fieldIndex] = '0'
						needsRewrite = true
					} else {
						// Ensure it's formatted as a clean number
						fields[fieldIndex] = numValue.toString()
					}
				}
			}

			fixedLines.push(fields.join(','))
		}

		// Rewrite file if changes were needed
		if (needsRewrite) {
			console.log('Rewriting budget file with corrected format')
			fs.writeFileSync(filePath, fixedLines.join(os.EOL) + os.EOL)
		}

		// Ensure file ends with newline
		const finalContent = fs.readFileSync(filePath, 'utf8')
		if (finalContent.length > 0 && finalContent[finalContent.length - 1] !== os.EOL) {
			fs.appendFileSync(filePath, os.EOL)
		}

	} catch (error) {
		console.error('Error validating budget CSV:', error)
		// Create a basic valid budget file if validation fails
		try {
			const header = 'Timestamp,Total Amount,Change,Reason,RunningTotal,RunningTotalChange'
			const defaultRow = `${new Date().toISOString()},0,0,Initial budget,0,0`
			fs.writeFileSync(filePath, header + os.EOL + defaultRow + os.EOL)
			console.log('Created default budget file')
		} catch (writeError) {
			console.error('Failed to create default budget file:', writeError)
		}
	}

}

//method to ensure cred file exists.
async function ensureCredFile() {

	// console.log(TOKEN_SECRET)

	try {

		await fsp.access(CREDENTIALS, fs.constants.F_OK)

	} catch {

		await fsp.writeFile(CREDENTIALS, 'id,pass_hashed' + os.EOL, { mode: 0o600 })

	}

}

//hashes password
//this is used to save the hashed password
function hashPass(password) {

	const salt = crypto.randomBytes(16)
	const hash = crypto.scryptSync(password, salt, 64)

	return `script:${salt.toString('hex')}:${hash.toString('hex')}`

}

//verifies password
//this verifies saved password with the attempted password
function verifyPass(password, stored) {

	const [scheme, saltHex, hashHex] = String(stored).split(":")

	if (scheme !== 'script') return false

	const salt = Buffer.from(saltHex, 'hex')
	const hash = Buffer.from(hashHex, 'hex')
	const test = crypto.scryptSync(password, salt, hash.length)

	return (test.length === hash.length && crypto.timingSafeEqual(hash, test))

}

//loads user credential file into memory as Map
async function loadUserMap() {

	const text = await fsp.readFile(CREDENTIALS, 'utf8')
	const lines = text.split(os.EOL).slice(1)
	const map = new Map()

	for (const line of lines) {

		// console.log(line)

		if (!line) continue

		const idx = line.indexOf(',')

		if (idx === -1) continue

		const id = line.slice(0, idx).trim()
		const passHash = line.slice(idx + 1).trim()

		if (id) map.set(id, passHash)

	}

	return map

}

//validates if user exists in the credentials files
async function validateUser(id) {

	const users = await loadUserMap()
	return users.has(id)

}

//adds user into credentials files.
//TODO: maybe I could remove this from being exposed
async function addUser(id, passHash) {

	const line = `${id},${passHash}` + os.EOL
	await fsp.appendFile(CREDENTIALS, line, { encoding: 'utf8' })

}

//encodes input into base64 string
function b64urlEncode(input) {

	const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input))
	return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

}

//decodes b64 string into string buffer
function b64urlDecode(input) {

	let string = String(input).replace(/-/g, '+').replace(/_/g, '/')
	while (string.length % 4) string += "="
	return Buffer.from(string, 'base64')

}

//signs JWT token with Hash-based Message Authentication Code 
//LOOK FOR JWT for better understanding
//signed token is valid for 1hr by default
function signToken(payload, secret, ttlSeconds = TOKEN_TTL_SECONDS) {

	const header = { alg: 'HS356', typ: 'JWT' }
	const now = Math.floor(Date.now() / 1000)
	const body = { ...payload, iat: now, exp: now + ttlSeconds }
	const h = b64urlEncode(JSON.stringify(header))
	const b = b64urlEncode(JSON.stringify(body))
	const msg = `${h}.${b}`
	const sig = b64urlEncode(crypto.createHmac('sha256', secret).update(msg).digest())
	return `${msg}.${sig}`

}

//verifies if retrieved token is the same as signed token.
function verifyToken(token, secret) {

	if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
		console.log('invalid token')
		return null //verifies if token is valid as 'header.body.sign'
	}
	const [h, b, s] = token.split('.')

	const msg = `${h}.${b}`

	const expected = crypto.createHmac('sha256', secret).update(msg).digest()
	const actual = b64urlDecode(s)

	if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
		console.log('token doesnt match')
		return null //verifies if the signature is same as signed
	}

	try {

		const payload = JSON.parse(b64urlDecode(b).toString('utf8'))

		if (typeof payload.exp !== 'number' && Math.floor(Date.now() / 1000) > payload.exp) {
			console.log('token expired')
			return null //verifies expiriation time
		}

		return payload

	} catch {

		console.log('???')
		return null

	}

}

//middleware that extracts SSO attributes from request headers
function extractSSOAttributes(req, res, next) {
	// Extract SSO attributes from headers (based on actual headers received)
	const ssoAttributes = {
		email: req.get('eppn'),  // eppn contains the email
		name: req.get('displayname'),  // displayname contains the full name
		eppn: req.get('eppn'),
		affiliation: req.get('affiliation'),
		cn: req.get('cn'),
		givenName: req.get('givenname'),
		surname: req.get('sn'),
		uid: req.get('uid'),
		mail: req.get('mail')
	}

	// If we have SSO attributes, create a user object
	if (ssoAttributes.eppn || ssoAttributes.mail) {
		req.ssoUser = {
			email: ssoAttributes.email,
			name: ssoAttributes.name,
			eppn: ssoAttributes.eppn,
			affiliation: ssoAttributes.affiliation,
			cn: ssoAttributes.cn,
			givenName: ssoAttributes.givenName,
			surname: ssoAttributes.surname,
			uid: ssoAttributes.uid,
			mail: ssoAttributes.mail
		}
	}

	next()
}

//middleware that authenticates user by verityfing the token
function auth(req, res, next) {

	const authz = req.get('Authorization') || ''
	let token = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length).trim() : null
	// console.log(token)
	// console.log(req.cookie)
	if (!token) token = req.cookies?.token //TMP
	// console.log(token)
	const payload = verifyToken(token, TOKEN_SECRET)
	if (!payload) return res.status(401).send(401)

	req.user = { id: payload.sub, ip: payload.ip }
	next()

}

//login with id and password, token is issued
app.post('/login', async (req, res) => {

	await ensureCredFile()

	const { id, pass } = req.body || {}

	if (typeof id !== 'string' || typeof pass !== 'string') {

		return res.status(400).send(400)

	}

	const users = await loadUserMap()
	const stored = users.get(id)

	if (!stored || !verifyPass(pass, stored)) {

		// console.log(users)

		return res.status(401).send(401)

	}

	const token = signToken({ sub: id, ip: String(req.ip) }, TOKEN_SECRET)

	const cookieOptions = { //TMP
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: TOKEN_TTL_SECONDS * 1000,
		path: '/'
	}

	res.cookie('token', token, cookieOptions) //TMP

	// res.redirect('/requests') //TMP

	res.json({ token, expiresIn: TOKEN_TTL_SECONDS }) //this would come back if cookie doesn't work when going prod

})

//registers user with specific ID and password
//TODO : INDENT THIS METHOD AFTER REGISTERTING USER

app.post('/register', async (req, res) => {

	await ensureCredFile()

	const {id, pass} = req.body || {}

	if(typeof id !== 'string' || typeof pass !== 'string') {

		return res.status(400).send(400)

	}

	if(await validateUser(id)) {

		return res.status(409).send(409)

	}

	const passHash = hashPass(pass)

	await addUser(id, passHash)

	res.status(201).json(201)

})


//SMTP CODES

//settings for sending emails
import nodemailer from 'nodemailer'

const TRANSPORTER = nodemailer.createTransport({
	host: "127.0.0.1",
	port: 25,
	secure: false,
	tls: { rejectUnauthorized: false },
	name: "localhost"
})

function sendEmail(to, subject, html, from) {

	TRANSPORTER.sendMail({
		from: from || "no-reply@library.brandeis.edu",
		to: to || "librarypublishing@brandeis.edu",
		subject: subject || "Update on Brandeis University Open Access Fund",
		html: html || "<p>There has been an update to your Open Access Fund request.</p>"
	})

}

// Function to send confirmation email with HTML template
async function sendConfirmationEmail(recipientEmail) {

	try {
		// Render the confirmation EJS template
		const confirmationHtml = await new Promise((resolve, reject) => {
			app.render('confirmation', { 
				pageTitle: 'Request Submitted - Brandeis University Open Access Fund'
			}, (err, html) => {
				if (err) reject(err)
				else resolve(html)
			})
		})

		// Send the email
		await TRANSPORTER.sendMail({
			from: "no-reply@library.brandeis.edu",
			to: recipientEmail,
			subject: "Open Access Fund Request Submitted Successfully",
			html: confirmationHtml
		})

		// console.log(`Confirmation email sent successfully to ${recipientEmail}`)
		return { success: true }
	} catch (error) {
		// console.error('Error sending confirmation email:', error)
		return { success: false, error: error.message }
	}
}

// Function to send application update email
async function sendApplicationUpdateEmail(recipientEmail, status, additionalInfo = {}) {
	try {
		// Status configuration
		const statusConfig = {
			'APPROVED': {
				subject: "Open Access Fund Request Approved",
				message: "Congratulations! Your request has been approved.",
				description: "Your Open Access Fund request has been reviewed and approved by our library publishing team.",
				icon: "✓",
				class: "approved",
				nextSteps: [
					"Funding will be processed according to your publication timeline",
					"You will receive payment details via email within 2-3 business days",
					"Please proceed with your publication as planned",
					"Upload all receipts and documentation of your publication for your payment"
				]
			},
			'DENIED': {
				subject: "Open Access Fund Request Update",
				message: "Your request has been denied.",
				description: "After reviewing your Open Access Fund request, we have decided to deny your request.",
				icon: "!",
				class: "denied",
				nextSteps: [
					"Contact [librarypublishing@brandeis.edu] if you have any questions about the decision",
					"You may resubmit your request once the issues are addressed",	
					"Thank you for your patience"
				]
			},
			'PAID': {
				subject: "Open Access Fund Payment Processed",
				message: "Payment has been processed successfully.",
				description: "Your Open Access Fund payment has been processed and sent to the publisher.",
				icon: "✓",
				class: "paid",
				nextSteps: [
					"Your publication should now be available as open access",
					"Please verify the open access status with your publisher",
					"Keep all payment confirmations of your publication for your records",
					"Contact [librarypublishing@brandeis.edu] if you have any issues with the publication"
				]
			},
			'PAYMENT_PLANNED': {
				subject: "Open Access Fund Payment Scheduled",
				message: "Payment has been scheduled for processing.",
				description: "Your Open Access Fund payment has been approved and scheduled for processing.",
				icon: "⏰",
				class: "payment-planned",
				nextSteps: [
					"Payment will be processed within 5-7 business days",
					"You will receive a confirmation once payment is sent",
					"Please coordinate with your publisher regarding timing",
					"Contact [librarypublishing@brandeis.edu] if you need to adjust the payment schedule"
				]
			},
			'CANCELLED': {
				subject: "Open Access Fund Request Cancelled",
				message: "Your request has been cancelled.",
				description: "Your Open Access Fund request has been cancelled as requested.",
				icon: "✕",
				class: "cancelled",
				nextSteps: [
					"No further action is required on your part",
					"You may submit a new request in the future if needed",
					"Contact [librarypublishing@brandeis.edu] if you have any questions about this cancellation",
					"Sorry for the inconvenience"
				]
			}
		}

		// Get configuration for status or use default
		const config = statusConfig[status.toUpperCase()] || {
			subject: "Open Access Fund Request Update",
			message: "Your request status has been updated.",
			description: "There has been an update to your Open Access Fund request.",
			icon: "ℹ",
			class: "default",
			nextSteps: [
				"Please review the details below",
				"Contact us if you have any questions",
				"Continue to monitor your request status",
				"Thank you for your patience"
			]
		}

		// Render the EJS template
		const updateHtml = await new Promise((resolve, reject) => {
			app.render('application-update', {
				subject: config.subject,
				statusMessage: config.message,
				statusDescription: config.description,
				statusIcon: config.icon,
				statusClass: config.class,
				status: status,
				additionalInfo: additionalInfo,
				nextSteps: config.nextSteps
			}, (err, html) => {
				if (err) reject(err)
				else resolve(html)
			})
		})

		// Send the email
		await TRANSPORTER.sendMail({
			from: "no-reply@oafund.library.brandeis.edu",
			to: recipientEmail,
			subject: config.subject,
			html: updateHtml
		})

		console.log(`Application update email sent successfully to ${recipientEmail} with status ${status}`)
		return { success: true, status: status }
	} catch (error) {
		console.error('Error sending application update email:', error)
		return { success: false, error: error.message }
	}
}



function backupBudget() {

	fs.copyFileSync(path.join(__dirname, __budgetFileName), path.join(__dirname, `${__budgetFileName}_backup.csv`))

}

function revertBudget() {

	fs.copyFileSync(path.join(__dirname, `${__budgetFileName}_backup.csv`), path.join(__dirname, __budgetFileName))

}

function backupFile() {

	fs.copyFileSync(path.join(__dirname, __filename), path.join(__dirname, `${__filename}_backup.csv`))

}

function revertFile() {

	fs.copyFileSync(path.join(__dirname, `${__filename}_backup.csv`), path.join(__dirname, __filename))

}

function changeRequestStatus(timestamp, status) {

	let amount
	let email
	let title

	return new Promise((resolve, reject) => {

		fs.readFile(path.join(__dirname, __filename), 'utf8', (err, data) => {

			if (err) { 
				reject(err) 
				return
			}

			const lines = data.trim().split(os.EOL)

			// if (lines.length == 1) { reject() }

			let file = []

			for (const i of lines) { file.push(i.split(",")) }

			let edit = false

			for (let i = 1; i < file.length; i ++) {

				if (file[i][0] === timestamp) {

			if (status == APPROVED && file[i][15] === SUBMITTED) { 
				file[i][15] = APPROVED; 
				edit = true; 
				amount = file[i][3]
				email = file[i][1]
				title = file[i][2]
			}
			if (status == DENIED && file[i][15] === SUBMITTED) { 
				file[i][15] = DENIED; 
				edit = true; 
				amount = file[i][3]
				email = file[i][1]
				title = file[i][2]
			}
			if (status == PAID && file[i][15] === APPROVED) { 
				file[i][15] = PAID; 
				edit = true; 
				amount = file[i][3]
				email = file[i][1]
				title = file[i][2]
			}
			if (status == PAID && file[i][15] === PAYMENT_PLANNED) { 
				file[i][15] = PAID; 
				edit = true; 
				amount = file[i][3]
				email = file[i][1]
				title = file[i][2]
			}
			if (status == CANCELLED && file[i][15] === APPROVED) { 
				file[i][15] = CANCELLED; 
				edit = true; 
				amount = file[i][3]
				email = file[i][1]
				title = file[i][2]
			}
			if (status == PAYMENT_PLANNED && file[i][15] === APPROVED) { 
				file[i][15] = PAYMENT_PLANNED; 
				edit = true; 
				amount = file[i][3]
				email = file[i][1]
				title = file[i][2]
			}

					break; // Found the record, exit loop

				}

			}

			if (!edit) {
				reject('400 No such request found')
				return
			}

			if (edit) {

				let output = []

				for (const i of file) { output.push(i.join(",")) }

				fs.writeFile(path.join(__dirname, __filename), output.join(os.EOL), (err) => {

					if (err) { reject('500 error writing file') }

					else { resolve({ amount, email, title }) }

				})

			} else {

				reject('400 Invalid status change')

			}

		})

	}).catch((error) => {

		return false

	})

}

function changeBudgetTotal(amount, reason) {

	return new Promise((resolve, reject) => {

		const timestamp = new Date().toISOString()

		// Validate budget CSV before reading
		validateBudgetCSV(path.join(__dirname, __budgetFileName))

		fs.readFile(path.join(__dirname, __budgetFileName), 'utf8', (err, data) => {

			if (err) { 
				reject(err)
				return
			}

			const lines = data.trim().split(os.EOL)
			let file = []

			for (const i of lines) { file.push(i.split(",")) }

			console.log('Last budget entry:', file[file.length-1])

			let input = [
				timestamp,
				Number(Number(file[file.length-1][1]) + Number(amount)),
				amount,
				reason,
				file[file.length-1][4],
				0
			]

			fs.appendFile(path.join(__dirname, __budgetFileName), input.join(",") + os.EOL, (err) => {

				if (err) { reject(err) } 
				
				else { resolve(true) }

			})

		})

	}).catch((error) => {

		console.log('rejected budget function:', error)
		return false

	})

}

function changeRunningTotal(amount, reason) {

	return new Promise((resolve, reject) => {

		const timestamp = new Date().toISOString()

		// Validate budget CSV before reading
		validateBudgetCSV(path.join(__dirname, __budgetFileName))

		fs.readFile(path.join(__dirname, __budgetFileName), 'utf8', (err, data) => {

			if (err) { 
				console.log('Error reading budget file for running total:', err)
				reject(err)
				return
			}

			const lines = data.trim().split(os.EOL)
			let file = []

			for (const i of lines) { file.push(i.split(",")) }

			let input = [
				timestamp,
				file[file.length-1][1],
				0,
				reason,
				Number(Number(file[file.length-1][4]) + Number(amount)),
				amount
			]

			fs.appendFile(path.join(__dirname, __budgetFileName), input.join(",") + os.EOL, (err) => {

				if (err) { 
					console.log('Error writing running total:', err)
					reject(err)
				} else { 
					console.log('Running total updated successfully')
					resolve(true)
				}

			})

		})

	}).catch((error) => {

		console.log('Error in changeRunningTotal:', error)
		return false

	})

}

//updates the status of request from APPROVED to CANCELLED
//this adds the budged requested back to the total budget
//query goes like this
// /cancel/2025-08-06T18:47:06.370Z
//timestamp param is mandatory
app.put('/cancel/:timestamp', auth, (req, res) => {

	new Promise(async (resolve, reject) => {

		backupFile(__filename)

		let timestamp
		if (req.params.timestamp) { timestamp = req.params.timestamp } else { reject(); return; }

		try {
			const result = await changeRequestStatus(timestamp, CANCELLED)

			if (result) {
				resolve({ amount: Number(result.amount), timestamp:timestamp, email: result.email, title: result.title })
			} else {
				reject()
			}
		} catch (error) {
			console.log('Error changing request status:', error)
			reject()
		}

	}).then(async (data) => { //ONCE RESOLVED

		backupBudget()

		try {
			const result = await changeRunningTotal(-Number(data.amount), `${data.timestamp} ${CANCELLED}`)
			
			if (result) {
				res.status(200).send(200)

				const additionalInfo = {
					timestamp: data.timestamp,
					title: data.title,
					amount: data.amount
				}
				
				sendApplicationUpdateEmail(data.email, CANCELLED, additionalInfo)

			} else {
				revertBudget()
				res.status(400).send(400)
			}
		} catch (error) {
			console.log('Error updating running total:', error)
			revertBudget()
			res.status(400).send(400)
		}

	}, () => {

		revertFile()

		res.status(400).send(400)

	})

})

//updates the status of request from submitted to DENIED
//this is the endpoint for the request and no further actions should be done on this request
//query goes like this
// /deny/2025-08-06T18:47:06.370Z
//timestamp param is mandatory
app.put('/deny/:timestamp', auth, (req, res) => {

	new Promise(async (resolve, reject) => {

		backupFile()

		let timestamp
		if (req.params.timestamp) { timestamp = req.params.timestamp } else { reject(); return; }

		try {
			const result = await changeRequestStatus(timestamp, DENIED)

			if(result) {
				resolve({ amount: Number(result.amount), timestamp: timestamp, email: result.email, title: result.title })
			} else {
				reject()
			}
		} catch (error) {
			console.log('Error changing request status to DENIED:', error)
			reject()
		}

	}).then((data) => {

		res.status(200).send(200)

		const additionalInfo = {
			timestamp: data.timestamp,
			title: data.title,
			amount: data.amount
		}
		
		sendApplicationUpdateEmail(data.email, DENIED, additionalInfo)

	}, () => {

		revertFile()

		res.status(400).send(400)

	})

})

//updates the status of request from APPROVED to TRANSACTION_PLANNED
app.put('/planned/:timestamp', auth, (req, res) => {

	new Promise(async (resolve, reject) => {

		backupFile()

		let timestamp
		if (req.params.timestamp) { timestamp = req.params.timestamp } else { reject(); return; }

		try {
			const result = await changeRequestStatus(timestamp, PAYMENT_PLANNED)

			if(result) {
				resolve({ amount: Number(result.amount), timestamp: timestamp, email: result.email, title: result.title })
			} else {
				reject()
			}
		} catch (error) {
			console.log('Error changing request status to PAYMENT_PLANNED:', error)
			reject()
		}

	}).then((data) => {

		res.status(200).send(200)

		const additionalInfo = {
			timestamp: data.timestamp,
			title: data.title,
			amount: data.amount
		}
		
		sendApplicationUpdateEmail(data.email, PAYMENT_PLANNED, additionalInfo)


	}, () => {

		revertFile()

		res.status(400).send(400)

	})

})

//updates the status of request from APPROVED to PAID
//or
//updates the status of request from TRANSACTION_PLANNED to PAID
//this is the endpoint for the request and no further actions should be done on this request
app.put('/paid/:timestamp', auth, (req, res) => {

	new Promise(async (resolve, reject) => {

		backupFile()

		let timestamp
		if (req.params.timestamp) { timestamp = req.params.timestamp } else { reject(); return; }

		try {
			const result = await changeRequestStatus(timestamp, PAID)

			if(result) {
				resolve({ amount: Number(result.amount), timestamp: timestamp, email: result.email, title: result.title })
			} else {
				reject()
			}
		} catch (error) {
			console.log('Error changing request status to PAID:', error)
			reject()
		}

	}).then(async (data) => {

		backupBudget()

		try {
			const result = await changeBudgetTotal(-Number(data.amount), `${data.timestamp} ${PAID}`)
			const running = await changeRunningTotal(-Number(data.amount), `${data.timestamp} ${PAID}`)

			if(result && running) {

				res.status(200).send(200)

				const additionalInfo = {
					timestamp: data.timestamp,
					title: data.title,
					amount: data.amount
				}
				
				sendApplicationUpdateEmail(data.email, PAID, additionalInfo)

			} else {
				revertBudget()
				res.status(400).send(400)
			}
		} catch (error) {
			console.log('Error updating budget total:', error)
			revertBudget()
			res.status(400).send(400)
		}

	}, () => {

		revertFile()

		res.status(400).send(400)

	})

})

//Approves one specific line
//query goes like
// [PUT] /approve/2025-08-06T18:47:06.370Z
//timestamp param is mandatory
app.put('/approve/:timestamp', auth, (req, res) => {

	new Promise(async (resolve, reject) => {

		backupFile()

		let timestamp
		if (req.params.timestamp) { timestamp = req.params.timestamp } else { reject(); return; }

		try {
			const result = await changeRequestStatus(timestamp, APPROVED)

			if (result) {
				resolve({ amount: Number(result.amount), timestamp: timestamp, email: result.email, title: result.title })
			} else {
				reject()
			}
			
		} catch (error) {
			console.log('Error changing request status to APPROVED:', error)
			reject()
		}

	}).then(async (data) => {

		backupBudget()

		try {

			const result = await changeRunningTotal(data.amount, `${data.timestamp} ${APPROVED}`)
			
			if (result) {

				res.status(200).send(200)

				const additionalInfo = {
					timestamp: data.timestamp,
					title: data.title,
					amount: data.amount
				}
				
				sendApplicationUpdateEmail(data.email, APPROVED, additionalInfo)

			} else {

				revertBudget()
				res.status(400).send(400)
			}

		} catch (error) {

			console.log('Error updating running total:', error)
			revertBudget()
			res.status(400).send(400)

		}

	}, () => {

		revertFile()

		res.status(400).send(400)

	})

})

//updates budget with specific amount (+ or -)
//query goes like this
// /updateBudget/+5000?reason=donation
// /updateBudget/-100000?reason=librarywidecoffeebreak
//amount param is mandatory and reason query is optional ('update budget' by default)
app.put('/updateBudget/:amount', auth, async (req, res) => {

	backupBudget()

	new Promise(async (resolve, reject) => {

		let amount
		if (req.params.amount) { amount = req.params.amount } else { reject(); return; }
		
		// Validate budget CSV before making changes
		validateBudgetCSV(path.join(__dirname, __budgetFileName))
		
		try {
		
			const result = await changeBudgetTotal(Number(amount), `${new Date().toISOString()} Updated Budget`)
			
			if(result) { 
				resolve() 
			} else { 
				reject() 
			}
		
		} catch (error) {

			console.log('Error in changeBudgetTotal:', error)
			reject()
		
		}

	}).then(() => {

		console.log('resolved request')

		res.status(200).send(200)

	}, () => {

		console.log('rejected request')

		revertBudget()

		res.status(400).send(400)

	})

})

//sets Budget to specific number
//query goes like this
// /setBudget/100000&reason=budget increase
// /setBudget/0&reason=budget cut
//this is used to set initial budget or huge change in total budget
//amount param is mandatory and reason query is optional ('set budget' by default)
app.post('/setBudget/:amount', auth, (req, res) => {

	new Promise((resolve, reject) => {

		let date_time = new Date()
		const timestamp = date_time.toISOString()

		let totalAmount = undefined
		let changeAmount = undefined
		let reason = timestamp + 'Set Budget'

		if (req.params.amount) { totalAmount = req.params.amount } else { reject() }
		if (req.query.reason) { reason = req.query.reason }

		// Validate budget CSV before reading
		validateBudgetCSV(path.join(__dirname, __budgetFileName))

		fs.readFile(`${__dirname}/${__budgetFileName}`, 'utf8', (err, data) => {

			if (err) { reject() }

			const lines = data.trim().split(os.EOL)

			if (lines.length == 1) {

				changeAmount = totalAmount

			} else {

				changeAmount = totalAmount - lines[lines.length - 1].split(',')[1]

			}

			let input = [
				timestamp,
				totalAmount,
				changeAmount,
				reason
			]

			fs.appendFile(`${__dirname}/${__budgetFileName}`, input.join(",") + os.EOL, (err) => {

				if (err) { reject() }

				resolve()

			})

		})

	}).then(() => { //ON RESOLVE

		res.status(200).send(200)

	}, () => {      //ON REJECT

		res.status(400).send(400)

	})

})

//sets Running Total to specific number
//query goes like this
// /setRunning/50000?reason=initial running total
// /setRunning/0?reason=reset running total
//this is used to set initial running total or reset running total
//amount param is mandatory and reason query is optional ('set running total' by default)
app.post('/setRunning/:amount', auth, (req, res) => {

	new Promise((resolve, reject) => {

		let date_time = new Date()
		const timestamp = date_time.toISOString()

		let totalAmount = undefined
		let changeAmount = undefined
		let reason = timestamp + ' Set Running Total'

		if (req.params.amount) { totalAmount = req.params.amount } else { reject() }
		if (req.query.reason) { reason = req.query.reason }

		// Validate budget CSV before reading
		validateBudgetCSV(path.join(__dirname, __budgetFileName))

		fs.readFile(`${__dirname}/${__budgetFileName}`, 'utf8', (err, data) => {

			if (err) { reject() }

			const lines = data.trim().split(os.EOL)

			if (lines.length == 1) {

				changeAmount = totalAmount

			} else {

				changeAmount = totalAmount - Number(lines[lines.length - 1].split(',')[4])

			}

			let input = [
				timestamp,
				lines.length == 1 ? 0 : lines[lines.length - 1].split(',')[1],
				0,
				reason,
				totalAmount,
				changeAmount
			]

			fs.appendFile(`${__dirname}/${__budgetFileName}`, input.join(",") + os.EOL, (err) => {

				if (err) { reject() }

				resolve()

			})

		})

	}).then(() => { //ON RESOLVE

		res.status(200).send(200)

	}, () => {      //ON REJECT

		res.status(400).send(400)

	})

})

//updates Running Total with specific amount (+ or -)
//query goes like this
// /updateRunning/+5000?reason=donation
// /updateRunning/-10000?reason=expense
//amount param is mandatory and reason query is optional ('update running total' by default)
app.put('/updateRunning/:amount', auth, async (req, res) => {

	backupBudget()

	new Promise(async (resolve, reject) => {

		let amount
		if (req.params.amount) { amount = req.params.amount } else { reject(); return; }
		
		// Validate budget CSV before making changes
		validateBudgetCSV(path.join(__dirname, __budgetFileName))
		
		try {
		
			const result = await changeRunningTotal(Number(amount), `${new Date().toISOString()} Updated Running Total`)
			
			if(result) { 
				resolve() 
			} else { 
				reject() 
			}
		
		} catch (error) {

			console.log('Error in changeRunningTotal:', error)
			reject()
		
		}

	}).then(() => {

		console.log('resolved request')

		res.status(200).send(200)

	}, () => {

		console.log('rejected request')

		revertBudget()

		res.status(400).send(400)

	})

})

//Edits specific line
//query goes like
// /update/2025-10-29-04-55-30?email=nobody@brandeis.edu
// /update/2025-10-29-04-55-30?amount=1&OAstatus=approved
//timestamp param is mandatory other queries are optional
app.put('/update/:timestamp', auth, (req, res) => {

	new Promise((resolve, reject) => {

		backupFile()

		let timestamp = undefined

		if (req.params.timestamp) { timestamp = req.params.timestamp } else { reject() }

		fs.readFile(`${__dirname}/${__filename}`, 'utf8', (err, data) => {

			if (err) { reject('asdf') }

			let lines = data.split(os.EOL)
			let file = []

			for (const i of lines) {
				file.push(i.split(","))
			}

			let edit = false

			for (let i = 1; i < file.length; i++) {

				if (file[i][0] === timestamp) {

					edit = true

					let email
					let title
					let amount
					let author
					let authorORCiD
					let collab
					let collabORCiD
					let journal
					let journalISSN 
					let publisher
					let status
					let type 
					let DOI
					let comment
					let OAstatus

					if (req.query.email) { email = req.query.email.replace(",", ".") } else { email = file[i][1] }
					if (req.query.title) { title = req.query.title.replace(",", ".") } else { title = file[i][2] }
					if (req.query.amount) { amount = req.query.amount.replace(",", ".") } else { amount = file[i][3] }
					if (req.query.author) { author = req.query.author.replace(",", ".") } else { author = file[i][4] }
					if (req.query.authorORCiD) { authorORCiD = req.query.authorORCiD.replace(",", ".") } else { authorORCiD = file[i][5] }
					if (req.query.collab) { collab = req.query.collab.replace(",", ".") } else { collab = file[i][6] }
					if (req.query.collabORCiD) { collabORCiD = req.query.collabORCiD.replace(",", ".") } else { collabORCiD = file[i][7] }
					if (req.query.journal) { journal = req.query.journal.replace(",", ".") } else { journal = file[i][8] }
					if (req.query.journalISSN) { journalISSN = req.query.journalISSN.replace(",", ".") } else { journalISSN = file[i][9] }
					if (req.query.publisher) { publisher = req.query.publisher.replace(",", ".") } else { publisher = file[i][10] }
					if (req.query.status) { status = req.query.status.replace(",", ".") } else { status = file[i][11] }
					if (req.query.type) { type = req.query.type.replace(",", ".") } else { type = file[i][12] }
					if (req.query.DOI) { DOI = req.query.DOI.replace(",", ".") } else { DOI = file[i][13] }
					if (req.query.comment) { comment = req.query.comment.replace(",", ".") } else { comment = file[i][14] }
					if (req.query.OAstatus) { OAstatus = req.query.OAstatus.replace(",", ".") } else { OAstatus = file[i][15] }

					file[i] = [
						timestamp,
						email,
						title,
						amount,
						author,
						authorORCiD,
						collab,
						collabORCiD,
						journal,
						journalISSN,
						publisher,
						status,
						type,
						DOI,
						comment,
						OAstatus
					]

				}

			}

			if (edit) {

				let output = []

				for (const i of file) {

					output.push(i.join(","))

				}

				fs.writeFile(`${__dirname}/${__filename}`, output.join(os.EOL), (err) => {

					if (err) { reject() }

					resolve()

				})

			} else {

				reject()

			}

		})

	}).then(() => {	//ON RESOLVE

		res.status(200).send(200)

	}, () => {	//ON REJECT

		revertFile()

		// console.log(err)

		res.status(400).send(400)

	})

})

//Create new line
//query goes like 
// /create?email=someone@brandeis.edu&title=HarryPotter&amount=9999&...
/* 
/email/:email
/title/:title
/amount/:amount
/author/:author
/authorORCiD/:authorORCiD
/collab/:collab
/collabORCiD/:collabORCiD
/journal/:journal
/journalISSN/:journalISSN
/publisher/:publisher
/status/:status
/type/:type
/DOI/:DOI
/comment/:comment
*/
app.post('/create', (req, res) => {

	new Promise((resolve, reject) => {

		let email			//author email
		let title			//title of article
		let amount			//amount requested from the fund
		let author			//name of the author
		let authorORCiD		//ORCiD of the author
		let collab			//name of the collaborating author(s) //THIS COULD BE A LIST OF PEOPLE
		let collabORCiD		//ORCiD of the collaborating author(s) //OPTIONAL
		let journal			//name of the journal the article was submitted to
		let journalISSN		//ISSN of the journal
		let publisher		//name of the publisher
		let status			//????
		let type			//publication type (research article, cover image, open access book, article commentary, review article, rapid communication, or OTHERS)
		let DOI				//DOI //OPTIONAL
		let comment			//comment to the library publishing team

		let OAstatus = SUBMITTED

		if (req.query.email) { email = req.query.email.replace(",", ".") }
		if (req.query.title) { title = req.query.title.replace(",", ".") }
		if (req.query.amount) { amount = req.query.amount.replace(",", ".") }
		if (req.query.author) { author = req.query.author.replace(",", ".") }
		if (req.query.authorORCiD) { authorORCiD = String(req.query.authorORCiD).replace(",", ".") }
		if (req.query.collab) { collab = req.query.collab.replace(",", ".") }
		if (req.query.collabORCiD) { collabORCiD = String(req.query.collabORCiD).replace(",", ".") }
		if (req.query.journal) { journal = req.query.journal.replace(",", ".") }
		if (req.query.journalISSN) { journalISSN = String(req.query.journalISSN).replace(",", ".") }
		if (req.query.publisher) { publisher = req.query.publisher.replace(",", ".") }
		if (req.query.status) { status = req.query.status.replace(",", ".") }
		if (req.query.type) { type = req.query.type.replace(",", ".") }
		if (req.query.DOI) { DOI = String(req.query.DOI).replace(",", ".") }
		if (req.query.comment) { comment = req.query.comment.replace(",", ".") }

		const input = [
			new Date().toISOString(),
			email,
			title,
			amount,
			author,
			authorORCiD,
			collab,
			collabORCiD,
			journal,
			journalISSN,
			publisher,
			status,
			type,
			DOI,
			comment,
			OAstatus
		]

		fs.appendFile(path.join(__dirname,__filename), input.join(",") + os.EOL, "utf8", (err) => {

				if (err) { reject(err) }

				else { resolve(email) }

		})

	}).then((email) => {

		res.status(200).send(200)

		sendConfirmationEmail(email)

		// Send notification email to library team about new request
		sendEmail(
			"librarypublishing@brandeis.edu",
			"New Open Access Fund Request Submitted",
			`<p>A new Open Access Fund request has been submitted by ${email}.</p>
			<p>Please review the request in the admin panel.</p>
			<p>Request details:</p>
			<ul>
				<li><strong>Email:</strong> ${email}</li>
				<li><strong>Title:</strong> ${req.query.title || 'Not provided'}</li>
				<li><strong>Amount:</strong> $${req.query.amount || 'Not provided'}</li>
				<li><strong>Author:</strong> ${req.query.author || 'Not provided'}</li>
				<li><strong>Journal:</strong> ${req.query.journal || 'Not provided'}</li>
			</ul>`
		)

	}, () => {

		res.status(400).send(400)

	})

})

//Fetching all uploaded URLs by users
//[GET] /urls
//returns all URLs with email in json format
//check 'urls.csv'
app.get('/urls', auth, (req, res) => {
	
	ensureCSV(path.join(__dirname, __urlsFileName))

	new Promise((resolve, reject) => {

		fs.readFile(path.join(__dirname, __urlsFileName), 'utf8', (err, data) => {

			if (err) { reject(err) }

			parse(data, {

				columns: true,
				skip_empty_lines: true

			}, (err, records) => {

				if (err) { reject(err) }

				resolve(records)

			})

		})

	}).then(parsed => {

		res.status(200).json({ urls: parsed })

	}, rejected => {

		res.status(400).send(JSON.stringify(rejected))

	})

})

//Fetching records as JSON
app.get('/fetch', auth, (req, res) => {

	ensureCSV(path.join(__dirname, __filename))

	new Promise((resolve, reject) => {

		fs.readFile(path.join(__dirname, __filename), (err, data) => {

			if (err) { reject(err) }

			parse(data, {

				columns: true,
				skip_empty_lines: true

			}, (err, records) => {

				if (err) { reject(err) }

				resolve(records) //this goes to .then as 'parsed'

			})

		})

	}).then(parsed => {

		res.send(JSON.stringify(parsed))

	}, rejected => {

		res.send(JSON.stringify(rejected))

	})

})

//Fetching budget record as JSON
app.get('/fetchBudget', auth, (req, res) => {

	// Validate budget CSV format before processing
	validateBudgetCSV(path.join(__dirname, __budgetFileName))
	ensureCSV(path.join(__dirname, __budgetFileName))

	new Promise((resolve, reject) => {

		fs.readFile(`${__dirname}/${__budgetFileName}`, (err, data) => {

			if (err) { reject(err) }

			parse(data, {

				columns: true,
				skip_empty_lines: true

			}, (err, records) => {

				if (err) { reject(err) }

				resolve(records) //this goes to .then as 'parsed'

			})

		})

	}).then((parsed) => {

		res.status(200).send(JSON.stringify(parsed))

	}, () => {

		res.status(400).send(400)

	})

})

// app.get('/test/email', (req, res) => {

// 	sendEmail(
// 		"superjames19@brandeis.edu", 
// 		"Test Email", 
// 		"<p>This is a test email</p>",
// 		"no-reply@oafund.library.brandeis.edu"
// 	)

// })

// Test endpoint for confirmation email
// app.get('/test/confirmation-email', async (req, res) => {
// 	const recipientEmail = req.query.email || "superjames19@brandeis.edu"
// 	const requestId = req.query.requestId || null
	
// 	try {
// 		const result = await sendConfirmationEmail(recipientEmail, requestId)
// 		if (result.success) {
// 			res.json({ 
// 				message: 'Confirmation email sent successfully', 
// 				requestId: result.requestId,
// 				recipient: recipientEmail
// 			})
// 		} else {
// 			res.status(500).json({ 
// 				error: 'Failed to send confirmation email', 
// 				details: result.error 
// 			})
// 		}
// 	} catch (error) {
// 		res.status(500).json({ 
// 			error: 'Failed to send confirmation email', 
// 			details: error.message 
// 		})
// 	}
// })

// Test endpoint for application update email
// app.get('/test/update-email', async (req, res) => {
// 	const recipientEmail = req.query.email || "superjames19@brandeis.edu"
// 	const requestId = req.query.requestId || "OA-TEST-12345"
// 	const status = req.query.status || "DENIED"
// 	const additionalInfo = {
// 		title: req.query.title || "Sample Research Article",
// 		amount: req.query.amount || "1500.00",
// 		feedback: req.query.feedback || null
// 	}
	
// 	try {
// 		const result = await sendApplicationUpdateEmail(recipientEmail, requestId, status, additionalInfo)
// 		if (result.success) {
// 			res.json({ 
// 				message: 'Application update email sent successfully', 
// 				requestId: requestId,
// 				status: status,
// 				recipient: recipientEmail
// 			})
// 		} else {
// 			res.status(500).json({ 
// 				error: 'Failed to send application update email', 
// 				details: result.error 
// 			})
// 		}
// 	} catch (error) {
// 		res.status(500).json({ 
// 			error: 'Failed to send application update email', 
// 			details: error.message 
// 		})
// 	}
// })

app.listen(port, () => {

	console.log(`server is listening at ${port}`)

})
