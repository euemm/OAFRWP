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

//Settings for database
import * as db from './db.js'
import fs from 'fs'
import path from 'path'
const __dirname = new URL(".", import.meta.url).pathname

//Settings for web views
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

//settings for uploading files
import multer from 'multer'
if (!fs.existsSync(path.join(__dirname, 'files'))) {
	fs.mkdirSync(path.join(__dirname, 'files'))
}

//Settings for security
import crypto from 'crypto'
const TOKEN_TTL_SECONDS = 60 * 60
import 'dotenv/config'
const TOKEN_SECRET = process.env.TOKEN_SECRET
import cookieParser from 'cookie-parser'
app.use(cookieParser())

// Initialize database on startup
db.initDatabase().then(() => {
	console.log('Database initialized successfully')
}).catch((err) => {
	console.error('Error initializing database:', err)
})

app.set('trust proxy', 1)

const LOCAL = process.env.LOCAL_URL || 'https://oafund.library.brandeis.edu'

//MULTER storage settings like default naming
const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, path.join(__dirname, 'files')),
	filename: (req, file, cb) => {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
		const safeBase = path.parse(file.originalname).name.replace(/[^À-\u024f\w\- ]+/g, '_').trim().replace(/\s+/g, '_')
		const email = (req.body && req.body.email) ? String(req.body.email) : ''
		const emailSafe = email.toLowerCase().trim().replace(/[^a-z0-9._+\-@]/gi, '_') || 'NOEMAIL'
		cb(null, `${emailSafe}__${safeBase || 'file'}-${timestamp}.pdf`)
	}
})

//MULTER upload settings like filetype check or size limit check
const upload = multer({
	storage,
	fileFilter(req, file, cb) {
		if (isPDF(file)) return cb(null, true)
		cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'only pdf files are allowed'))
	},
	nodlimits: { fileSize: 50 * 1024 * 1024, files: 10 }
})

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

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/public', express.static(path.join(__dirname, 'public')))

// Apply SSO attribute extraction to all routes
app.use(extractSSOAttributes)

import fsp from 'fs/promises'
const filesRouter = express.Router()
const FILES_DIR = path.join(__dirname, 'files')
filesRouter.get('/', async (req, res, next) => {
	try {
		// Get files from database (preferred method)
		const files = await db.getAllFiles()
		
		// Also check filesystem for any files not in database (backward compatibility)
		// This handles files uploaded before database tracking was added
		try {
			const entries = await fsp.readdir(FILES_DIR, { withFileTypes: true })
			const dbFilenames = new Set(files.map(f => f.name))
			
			for (const d of entries) {
				if (!d.isFile()) continue
				if (d.name.startsWith('.')) continue
				if (dbFilenames.has(d.name)) continue // Already in database
				
				// File exists on disk but not in database - add to response
				const full = path.join(FILES_DIR, d.name)
				const st = await fsp.stat(full)
				files.push({
					name: d.name,
					originalName: d.name,
					size: st.size,
					mtime: st.mtime.toISOString(),
					url: `/files/${encodeURIComponent(d.name)}`,
					email: null // Unknown email for files not in database
				})
			}
		} catch (fsError) {
			// If filesystem read fails, just use database files
			console.warn('Could not read files directory:', fsError.message)
		}
		
		// Sort by timestamp (mtime) descending
		files.sort((a, b) => b.mtime.localeCompare(a.mtime))
		return res.json({ files })
	} catch (err) {
		next(err)
	}
})
filesRouter.use(
	express.static(FILES_DIR, {
		index: false,
		setHeaders(res, filePath) {
			res.set('Content-Type', 'application/pdf; charset=utf-8')
			res.set('Content-Disposition', `inline; filename="${path.basename(filePath)}"`)
			res.set('Cache-Control', 'private, no-store')
		}
	})
)

app.use('/files', auth, filesRouter)


app.get('/whoami', (req, res) => {
	const h = req.headers;
	res.json({
		email:      h['x-email'] || h['mail'] || null,
		name:       h['x-name']  || h['displayname'] || null,
		eppn:       h['x-eppn']  || h['eppn'] || null,
		remoteUser: h['x-remote-user'] || h['remote-user'] || null,
		given:      h['x-given-name'] || h['givenname'] || null,
		sn:         h['x-surname'] || h['sn'] || null,
		_debugAll:  h
	});
});

app.get('/', (req, res) => {
	res.render('index', {
		endPoint : LOCAL,
		user: req.ssoUser || null
	})
})

app.get('/requests', auth, (req, res) => {
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
		headerBgUrl: `/public/header.jpg`
  });

})

app.get('/budget-history', auth, (req, res) => {
	res.render('budget-history', {
		endPoint: LOCAL,
		pageTitle: 'Budget History',
		fetchBudgetUrl: `${LOCAL}/fetchBudget`,
		headerBgUrl: `/public/header.jpg`
  });
})

app.get('/files-page', auth, (req, res) => {
	res.render('files', {
		endPoint: LOCAL,
		pageTitle: 'Uploaded Files',
		fetchFilesUrl: `${LOCAL}/files`,
		headerBgUrl: `/public/header.jpg`
  });
})

app.get('/upload', (req, res) => {

	res.render('upload', { endPoint: LOCAL })

})

app.get('/login', (req, res) => {

	res.render('login', { endPoint: LOCAL })

})

app.post('/upload', upload.array('pdfs', 10), async (req, res) => {

	try {
		const email = req.body.email || ''
		const uploadedFiles = []

		for (const f of req.files || []) {
			// Save file metadata to database
			await db.addFile(
				f.filename,
				f.originalname,
				email,
				f.size,
				f.path
			)

			uploadedFiles.push({
				originalName: f.originalname,
				filename: f.filename,
				size: f.size,
				url: `/files/${encodeURIComponent(f.filename)}`
			})
		}

		res.status(201).json({ uploaded: uploadedFiles })
	} catch (error) {
		console.error('Error uploading files:', error)
		res.status(500).json({ error: 'Failed to upload files' })
	}

})

app.post('/uploadURL', async (req, res) => {

	const url = req.body.url ? req.body.url : ''
	const email = req.body.email ? req.body.email : ''

	if (!url || url.trim() === '') {
		return res.status(400).json({ error: 'URL is required' })
	}

	if (!email || email.trim() === '') {
		return res.status(400).json({ error: 'Email is required' })
	}
	
	try {
		await db.addURL(url, email)
		return res.status(200).json({ message: 'URL uploaded successfully' })
	} catch (error) {
		console.error('Error adding URL:', error)
		return res.status(500).json({ error: 'Failed to upload URL' })
	}

})

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


function hashPass(password) {

	const salt = crypto.randomBytes(16)
	const hash = crypto.scryptSync(password, salt, 64)

	return `script:${salt.toString('hex')}:${hash.toString('hex')}`

}

function verifyPass(password, stored) {

	const [scheme, saltHex, hashHex] = String(stored).split(":")

	if (scheme !== 'script') return false

	const salt = Buffer.from(saltHex, 'hex')
	const hash = Buffer.from(hashHex, 'hex')
	const test = crypto.scryptSync(password, salt, hash.length)

	return (test.length === hash.length && crypto.timingSafeEqual(hash, test))

}

async function loadUserMap() {
	return await db.loadUserMap()
}

async function validateUser(id) {
	const user = await db.getUserById(id)
	return user !== undefined
}

async function addUser(id, passHash) {
	await db.addUser(id, passHash)
}

function b64urlEncode(input) {

	const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input))
	return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

}

function b64urlDecode(input) {

	let string = String(input).replace(/-/g, '+').replace(/_/g, '/')
	while (string.length % 4) string += "="
	return Buffer.from(string, 'base64')

}

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

function verifyToken(token, secret) {

	if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
		console.log('invalid token')
		return null
	}
	const [h, b, s] = token.split('.')

	const msg = `${h}.${b}`

	const expected = crypto.createHmac('sha256', secret).update(msg).digest()
	const actual = b64urlDecode(s)

	if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
		console.log('token doesnt match')
		return null
	}

	try {

		const payload = JSON.parse(b64urlDecode(b).toString('utf8'))

		if (typeof payload.exp !== 'number' && Math.floor(Date.now() / 1000) > payload.exp) {
			console.log('token expired')
			return null
		}

		return payload

	} catch {

		console.log('???')
		return null

	}

}

function extractSSOAttributes(req, res, next) {
	const ssoAttributes = {
		email: req.get('eppn'),
		name: req.get('displayname'),
		eppn: req.get('eppn'),
		affiliation: req.get('affiliation'),
		cn: req.get('cn'),
		givenName: req.get('givenname'),
		surname: req.get('sn'),
		uid: req.get('uid'),
		mail: req.get('mail')
	}

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

function auth(req, res, next) {
	const authz = req.get('Authorization') || ''
	let token = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length).trim() : null
	if (!token) token = req.cookies?.token
	const payload = verifyToken(token, TOKEN_SECRET)
	if (!payload) return res.status(401).send(401)

	req.user = { id: payload.sub, ip: payload.ip }
	next()

}

app.post('/login', async (req, res) => {

	const { id, pass } = req.body || {}

	if (typeof id !== 'string' || typeof pass !== 'string') {

		return res.status(400).send(400)

	}

	const users = await loadUserMap()
	const stored = users.get(id)

	if (!stored || !verifyPass(pass, stored)) {
		return res.status(401).send(401)

	}

	const token = signToken({ sub: id, ip: String(req.ip) }, TOKEN_SECRET)

	const cookieOptions = {
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: TOKEN_TTL_SECONDS * 1000,
		path: '/'
	}

	res.cookie('token', token, cookieOptions)
	res.json({ token, expiresIn: TOKEN_TTL_SECONDS })

})

app.post('/register', async (req, res) => {

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

async function sendConfirmationEmail(recipientEmail) {
	try {
		const confirmationHtml = await new Promise((resolve, reject) => {
			app.render('confirmation', { 
				pageTitle: 'Request Submitted - Brandeis University Open Access Fund'
			}, (err, html) => {
				if (err) reject(err)
				else resolve(html)
			})
		})

		await TRANSPORTER.sendMail({
			from: "no-reply@library.brandeis.edu",
			to: recipientEmail,
			subject: "Open Access Fund Request Submitted Successfully",
			html: confirmationHtml
		})

		return { success: true }
	} catch (error) {
		return { success: false, error: error.message }
	}
}

async function sendApplicationUpdateEmail(recipientEmail, status, additionalInfo = {}) {
	try {
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




async function changeRequestStatus(timestamp, status) {
	try {
		return await db.updateRequestStatus(timestamp, status)
	} catch (error) {
		throw error
	}
}

async function changeBudgetTotal(amount, reason) {
	try {
		await db.changeBudgetTotal(amount, reason)
		return true
	} catch (error) {
		console.log('rejected budget function:', error)
		return false
	}
}

async function changeRunningTotal(amount, reason) {
	try {
		await db.changeRunningTotal(amount, reason)
		return true
	} catch (error) {
		console.log('Error in changeRunningTotal:', error)
		return false
	}
}

app.put('/cancel/:timestamp', auth, async (req, res) => {

	try {
		let timestamp
		if (req.params.timestamp) { 
			timestamp = req.params.timestamp 
		} else { 
			return res.status(400).send(400)
		}

		const result = await changeRequestStatus(timestamp, CANCELLED)

		if (!result) {
			return res.status(400).send(400)
		}

		const budgetResult = await changeRunningTotal(-Number(result.amount), `${timestamp} ${CANCELLED}`)
		
		if (budgetResult) {
			res.status(200).send(200)

			const additionalInfo = {
				timestamp: timestamp,
				title: result.title,
				amount: result.amount
			}
			
			sendApplicationUpdateEmail(result.email, CANCELLED, additionalInfo)
		} else {
			res.status(400).send(400)
		}
	} catch (error) {
		console.log('Error cancelling request:', error)
		res.status(400).send(400)
	}

})

app.put('/deny/:timestamp', auth, async (req, res) => {

	try {
		let timestamp
		if (req.params.timestamp) { 
			timestamp = req.params.timestamp 
		} else { 
			return res.status(400).send(400)
		}

		const result = await changeRequestStatus(timestamp, DENIED)

		if (!result) {
			return res.status(400).send(400)
		}

		res.status(200).send(200)

		const additionalInfo = {
			timestamp: timestamp,
			title: result.title,
			amount: result.amount
		}
		
		sendApplicationUpdateEmail(result.email, DENIED, additionalInfo)

	} catch (error) {
		console.log('Error denying request:', error)
		res.status(400).send(400)
	}

})

app.put('/planned/:timestamp', auth, async (req, res) => {

	try {
		let timestamp
		if (req.params.timestamp) { 
			timestamp = req.params.timestamp 
		} else { 
			return res.status(400).send(400)
		}

		const result = await changeRequestStatus(timestamp, PAYMENT_PLANNED)

		if (!result) {
			return res.status(400).send(400)
		}

		res.status(200).send(200)

		const additionalInfo = {
			timestamp: timestamp,
			title: result.title,
			amount: result.amount
		}
		
		sendApplicationUpdateEmail(result.email, PAYMENT_PLANNED, additionalInfo)

	} catch (error) {
		console.log('Error setting payment planned:', error)
		res.status(400).send(400)
	}

})

app.put('/paid/:timestamp', auth, async (req, res) => {
	try {
		let timestamp
		if (req.params.timestamp) { 
			timestamp = req.params.timestamp 
		} else { 
			return res.status(400).send(400)
		}

		const result = await changeRequestStatus(timestamp, PAID)
		if (!result) {
			return res.status(400).send(400)
		}

		const budgetResult = await changeBudgetTotal(-Number(result.amount), `${timestamp} ${PAID}`)
		const runningResult = await changeRunningTotal(-Number(result.amount), `${timestamp} ${PAID}`)
		
		if (budgetResult && runningResult) {
			res.status(200).send(200)
			const additionalInfo = {
				timestamp: timestamp,
				title: result.title,
				amount: result.amount
			}
			sendApplicationUpdateEmail(result.email, PAID, additionalInfo)
		} else {
			res.status(400).send(400)
		}
	} catch (error) {
		console.log('Error marking as paid:', error)
		res.status(400).send(400)
	}
})

app.put('/approve/:timestamp', auth, async (req, res) => {

	try {
		let timestamp
		if (req.params.timestamp) { 
			timestamp = req.params.timestamp 
		} else { 
			return res.status(400).send(400)
		}

		const result = await changeRequestStatus(timestamp, APPROVED)

		if (!result) {
			return res.status(400).send(400)
		}

		const budgetResult = await changeRunningTotal(result.amount, `${timestamp} ${APPROVED}`)
		
		if (budgetResult) {
			res.status(200).send(200)

			const additionalInfo = {
				timestamp: timestamp,
				title: result.title,
				amount: result.amount
			}
			
			sendApplicationUpdateEmail(result.email, APPROVED, additionalInfo)
		} else {
			res.status(400).send(400)
		}

	} catch (error) {
		console.log('Error approving request:', error)
		res.status(400).send(400)
	}

})

app.put('/updateBudget/:amount', auth, async (req, res) => {

	try {
		let amount
		if (req.params.amount) { 
			amount = req.params.amount 
		} else { 
			return res.status(400).send(400)
		}
		
		const result = await changeBudgetTotal(Number(amount), `${new Date().toISOString()} Updated Budget`)
		
		if (result) {
			res.status(200).send(200)
		} else {
			res.status(400).send(400)
		}

	} catch (error) {
		console.log('Error updating budget:', error)
		res.status(400).send(400)
	}

})

app.post('/setBudget/:amount', auth, async (req, res) => {

	try {
		let totalAmount
		let reason = new Date().toISOString() + ' Set Budget'

		if (req.params.amount) { 
			totalAmount = Number(req.params.amount) 
		} else { 
			return res.status(400).send(400)
		}
		
		if (req.query.reason) { 
			reason = req.query.reason 
		}

		await db.setBudgetTotal(totalAmount, reason)
		res.status(200).send(200)

	} catch (error) {
		console.log('Error setting budget:', error)
		res.status(400).send(400)
	}

})

app.post('/setRunning/:amount', auth, async (req, res) => {

	try {
		let totalAmount
		let reason = new Date().toISOString() + ' Set Running Total'

		if (req.params.amount) { 
			totalAmount = Number(req.params.amount) 
		} else { 
			return res.status(400).send(400)
		}
		
		if (req.query.reason) { 
			reason = req.query.reason 
		}

		await db.setRunningTotal(totalAmount, reason)
		res.status(200).send(200)

	} catch (error) {
		console.log('Error setting running total:', error)
		res.status(400).send(400)
	}

})

app.put('/updateRunning/:amount', auth, async (req, res) => {

	try {
		let amount
		if (req.params.amount) { 
			amount = req.params.amount 
		} else { 
			return res.status(400).send(400)
		}
		
		const result = await changeRunningTotal(Number(amount), `${new Date().toISOString()} Updated Running Total`)
		
		if (result) {
			res.status(200).send(200)
		} else {
			res.status(400).send(400)
		}

	} catch (error) {
		console.log('Error updating running total:', error)
		res.status(400).send(400)
	}

})

app.put('/update/:timestamp', auth, async (req, res) => {

	try {
		let timestamp
		if (req.params.timestamp) { 
			timestamp = req.params.timestamp 
		} else { 
			return res.status(400).send(400)
		}

		const updates = {}
		if (req.query.email) updates.email = req.query.email
		if (req.query.title) updates.title = req.query.title
		if (req.query.amount) updates.amount = req.query.amount
		if (req.query.author) updates.author = req.query.author
		if (req.query.authorORCiD) updates.authorORCiD = req.query.authorORCiD
		if (req.query.collab) updates.collab = req.query.collab
		if (req.query.collabORCiD) updates.collabORCiD = req.query.collabORCiD
		if (req.query.journal) updates.journal = req.query.journal
		if (req.query.journalISSN) updates.journalISSN = req.query.journalISSN
		if (req.query.publisher) updates.publisher = req.query.publisher
		if (req.query.status) updates.status = req.query.status
		if (req.query.type) updates.type = req.query.type
		if (req.query.DOI) updates.DOI = req.query.DOI
		if (req.query.comment) updates.comment = req.query.comment
		if (req.query.OAstatus) updates.OAstatus = req.query.OAstatus

		const result = await db.updateRequest(timestamp, updates)
		
		if (result) {
			res.status(200).send(200)
		} else {
			res.status(400).send(400)
		}

	} catch (error) {
		console.log('Error updating request:', error)
		res.status(400).send(400)
	}

})

app.post('/create', async (req, res) => {

	try {
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

		let OAstatus = SUBMITTED

		if (req.query.email) { email = req.query.email }
		if (req.query.title) { title = req.query.title }
		if (req.query.amount) { amount = req.query.amount }
		if (req.query.author) { author = req.query.author }
		if (req.query.authorORCiD) { authorORCiD = String(req.query.authorORCiD) }
		if (req.query.collab) { collab = req.query.collab }
		if (req.query.collabORCiD) { collabORCiD = String(req.query.collabORCiD) }
		if (req.query.journal) { journal = req.query.journal }
		if (req.query.journalISSN) { journalISSN = String(req.query.journalISSN) }
		if (req.query.publisher) { publisher = req.query.publisher }
		if (req.query.status) { status = req.query.status }
		if (req.query.type) { type = req.query.type }
		if (req.query.DOI) { DOI = String(req.query.DOI) }
		if (req.query.comment) { comment = req.query.comment }

		const requestData = {
			timestamp: new Date().toISOString(),
			email_address: email,
			title_of_article: title,
			amount_requested: amount,
			corresponding_author_name: author,
			corresponding_author_orcid: authorORCiD,
			collaborating_author_list: collab,
			collaborating_author_orcid_list: collabORCiD,
			title_of_journal: journal,
			journal_issn: journalISSN,
			publisher: publisher,
			article_status: status,
			publication_type: type,
			doi: DOI,
			comment: comment,
			oa_fund_status: OAstatus
		}

		await db.createRequest(requestData)

		res.status(200).send(200)

		sendConfirmationEmail(email)

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

	} catch (error) {
		console.log('Error creating request:', error)
		res.status(400).send(400)
	}

})

app.get('/urls', auth, async (req, res) => {
	
	try {
		const urls = await db.getAllURLs()
		res.status(200).json({ urls: urls })
	} catch (error) {
		console.log('Error fetching URLs:', error)
		res.status(400).send(JSON.stringify(error))
	}

})

app.get('/fetch', auth, async (req, res) => {

	try {
		const requests = await db.getAllRequests()
		res.send(JSON.stringify(requests))
	} catch (error) {
		console.log('Error fetching requests:', error)
		res.send(JSON.stringify(error))
	}

})

app.get('/fetchBudget', auth, async (req, res) => {

	try {
		const budget = await db.getAllBudgetRecords()
		res.status(200).send(JSON.stringify(budget))
	} catch (error) {
		console.log('Error fetching budget:', error)
		res.status(400).send(400)
	}

})

app.listen(port, () => {

	console.log(`server is listening at ${port}`)

})
