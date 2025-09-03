//invoice page - view and upload page : NEED BETTER VISUALIZATION
//login / token feature : DONE?
//upload to the server : DONE
//CSRF TOKEN?? : NO
//Budget page at the top of the requests page


//Settings for express server
import express from 'express'
const app = express()
const port = 3000

//Settings for csv file editing
import fs from 'fs'
import { parse } from 'csv-parse'
const __dirname = new URL(".", import.meta.url).pathname
const __filename = 'empty.csv'
const __budgetFileName = 'budget.csv'
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

const LOCAL = 'https://oafund.library.brandeis.edu'
// const LOCAL = 'localhost:3000'

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


//web view for the request form
app.get('/', (req, res) => {

	res.render('index', { title: 'asdf', message: 'hello world' })

})

//web view for successful request submissions
app.get('/success', auth, (req, res) => {

	res.render('success', { title: 'success', message: 'hello world' })

})

//web view for failed request submissions
app.get('/fail', auth, (req, res) => {

	res.render('fail', { title: 'fail', message: 'fail' })

})

//web view to view all the requests
app.get('/requests', auth, (req, res) => {

	// res.render('requests', { title: 'requests', message: 'requests' })
	res.render('requests', {
		pageTitle: 'OA Requests',
		fetchUrl: `http://${LOCAL}/fetch`,
		fetchBudgetUrl: `http://${LOCAL}/fetchBudget`,
		approveUrl: `http://${LOCAL}/approve`,
		denyUrl: `http://${LOCAL}/deny`,
		cancelUrl: `http://${LOCAL}/cancel`,
		paidUrl: `http://${LOCAL}/paid`,
		paymentPlannedUrl: `http://${LOCAL}/planned`,
		headerBgUrl: `/public/header.jpg`// serve this or change the path
  });

})

app.get('/upload', (req, res) => {

	res.render('upload', { title: 'upload', message: 'upload pdf' })

})

app.get('/login', (req, res) => {

	res.render('login')

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
/*
//settings for sending emails
import nodemailer from 'nodemailer'

app.get('/test/email', (req, res) => {

	const transporter = nodemailer.createTransport({
		host: "smtp.gmail.com",
		port: 465,
		secure: false,
		auth: {
			user
		}
	})

	new Promise(async (resolve, reject) => {

	    

	})

})
*/

//updates the status of request from APPROVED to CANCELLED
//this adds the budged requested back to the total budget
//query goes like this
// /cancel/2025-08-06T18:47:06.370Z
//timestamp param is mandatory
app.put('/cancel/:timestamp', auth, (req, res) => {

	let amount = 0

	new Promise((resolve, reject) => {

		// fs.copyFileSync(`${__dirname}/${__filename}`, `${__dirname}/tmp.csv`)

		let timestamp = undefined
		if (req.params.timestamp) { timestamp = req.params.timestamp } else { reject() }

		fs.readFile(`${__dirname}/${__filename}`, 'utf8', (err, data) => {

			if (err) { reject() }

			const lines = data.trim().split(os.EOL)

			if (lines.length == 1) {

				reject()

			}

			let file = []

			for (const i of lines) {

				file.push(i.split(","))

			}

			let edit = false

			for (let i = 1; i < file.length; i++) {

				if (file[i][0] === timestamp && file[i][15] === 'APPROVED') {

					if (file[i][15] === 'APPROVED') { amount = file[i][3] }

					file[i][15] = "CANCELLED"

					edit = true

				}

			}

			if (edit) {

				let output = []

				for (const i of file) {

					output.push(i.join(","))

				}

				fs.writeFile(`${__dirname}/${__filename}`, output.join(os.EOL), (err) => {

					if (err) { reject() }

					console.log('amount is ' + amount)

					resolve(amount)

				})

			} else { reject() }

		})

	}).then((amount) => { //ONCE RESOLVED

		new Promise((resolve, reject) => {//try updating budget [ADD whatever was requested back to total]

			let date_time = new Date()
			const timestamp = date_time.toISOString()

			let totalAmount = undefined
			let changeAmount = undefined
			let reason = 'CANCELLED'

			if (amount) { changeAmount = Number(amount) } else { 
				console.log(amount)
				reject() 
			}

			fs.readFile(`${__dirname}/${__budgetFileName}`, 'utf8', (err, data) => {

				if (err) { reject() }

				const lines = data.trim().split(os.EOL)

				if (lines.length == 1) {

					totalAmount = changeAmount

				} else {

					totalAmount = String(Number(lines[lines.length - 1].split(",")[1]) + Number(changeAmount))

				}

				let input = [
					timestamp,
					totalAmount,
					changeAmount,
					reason
				]

				fs.appendFile(`${__dirname}/${__budgetFileName}`, input.join(",") + os.EOL, (err) => {

					if (err) { 
						console.log('asdfasdf')
						reject() 
					}

					resolve()

				})

			})

		}).then(() => {

			res.status(200).send(200)

		}, () => {//if budget update attempt fails

			// fs.copyFileSync(`${__dirname}/tmp.csv`, `${__dirname}/${__filename}`)

			res.status(400).send(400)

		})

	}, () => { //if file update fail

		// fs.copyFileSync(`${__dirname}/tmp.csv`, `${__dirname}/${__filename}`)

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

		// fs.copyFileSync(path.join(__dirname, __filename), path.join(__dirname, 'tmp.csv'))

		let timestamp
		if (req.params.timestamp) { timestamp = req.params.timestamp } else { reject() }

		fs.readFile(path.join(__dirname, __filename), 'utf8', (err, data) => {

			if (err) { reject() }

			const lines = data.trim().split(os.EOL)

			if (lines.length === 1) { reject() }

			let file = []

			for (const i of lines) { file.push(i.split(",")) }

			let edit = false

			for (let i = 1; i < file.length; i++) {

				if (file[i][0] === timestamp && file[i][15] === 'submitted') {

					file[i][15] = "DENIED"

					edit = true

				}

			}

			if (edit) {

				let output = []

				for (const i of file) { output.push(i.join(",")) }

				fs.writeFile(path.join(__dirname, __filename), output.join(os.EOL), (err) => {

					if (err) { reject() }

					resolve()

				})

			} else { reject() }

		})

	}).then(() => {

		res.status(200).send(200)

	}, () => {

		// fs.copyFileSync(path.join(__dirname, 'tmp.csv'), path.join(__dirname, __filename))

		res.status(400).send(400)

	})

})

//updates the status of request from APPROVED to TRANSACTION_PLANNED
app.put('/planned/:timestamp', auth, (req, res) => {

	new Promise(async (resolve, reject) => {

		// fs.copyFileSync(path.join(__dirname, __filename), path.join(__dirname, 'tmp.csv'))

		let timestamp
		if (req.params.timestamp) { timestamp = req.params.timestamp } else { reject() }

		fs.readFile(path.join(__dirname, __filename), 'utf8', (err, data) => {

			if (err) { reject() }

			const lines = data.trim().split(os.EOL)

			if (lines.length === 1) { reject() }

			let file = []

			for (const i of lines) { file.push(i.split(",")) }

			let edit = false

			for (let i = 1; i < file.length; i++) {

				if (file[i][0] === timestamp && file[i][15] === 'APPROVED') {

					file[i][15] = "TRANSACTION_PLANNED"

					edit = true

				}

			}

			if (edit) {

				let output = []

				for (const i of file) { output.push(i.join(",")) }

				fs.writeFile(path.join(__dirname, __filename), output.join(os.EOL), (err) => {

					if (err) { reject() }

					resolve()

				})

			} else { reject() }

		})

	}).then(() => {

		res.status(200).send(200)

	}, () => {

		// fs.copyFileSync(path.join(__dirname, 'tmp.csv'), path.join(__dirname, __filename))

		res.status(400).send(400)

	})

})

//updates the status of request from APPROVED to PAID
//or
//updates the status of request from TRANSACTION_PLANNED to PAID
//this is the endpoint for the request and no further actions should be done on this request
app.put('/paid/:timestamp', auth, (req, res) => {

	new Promise(async (resolve, reject) => {

		// fs.copyFileSync(path.join(__dirname, __filename), path.join(__dirname, 'tmp.csv'))

		let timestamp
		if (req.params.timestamp) { timestamp = req.params.timestamp } else { reject() }

		fs.readFile(path.join(__dirname, __filename), 'utf8', (err, data) => {

			if (err) { reject() }

			const lines = data.trim().split(os.EOL)

			if (lines.length === 1) { reject() }

			let file = []

			for (const i of lines) { file.push(i.split(",")) }

			let edit = false

			for (let i = 1; i < file.length; i++) {

				if (file[i][0] === timestamp) {

					if (file[i][15] === 'APPROVED' || file[i][15] === 'TRANSACTION_PLANNED') {

						file[i][15] = 'PAID'

						edit = true

					}

				}

			}

			if (edit) {

				let output = []

				for (const i of file) { output.push(i.join(",")) }

				fs.writeFile(path.join(__dirname, __filename), output.join(os.EOL), (err) => {

					if (err) { reject() }

					resolve()

				})

			} else {

				reject()

			}

		})

	}).then(() => {

		res.status(200).send(200)

	}, () => {

		// fs.copyFileSync(path.join(__dirname, 'tmp.csv'), path.join(__dirname, __filename))

		res.status(400).send(400)

	})

})

//Approves one specific line
//query goes like
// [PUT] /approve/2025-08-06T18:47:06.370Z
//timestamp param is mandatory
app.put('/approve/:timestamp', auth, (req, res) => {

	let amount

	new Promise((resolve, reject) => {

		// fs.copyFileSync(`${__dirname}/${__filename}`, `${__dirname}/tmp.csv`)

		let timestamp
		if (req.params.timestamp) { timestamp = req.params.timestamp } else { reject() }

		fs.readFile(`${__dirname}/${__filename}`, 'utf8', (err, data) => {

			if (err) { reject() } 

			const lines = data.trim().split(os.EOL)

			if (lines.length == 1) { reject() }

			let file = []

			for (const i of lines) { file.push(i.split(",")) }

			let edit = false

			for (let i = 1; i < file.length; i++) {

				if (file[i][0] == timestamp && file[i][15] === 'submitted') {

					file[i][15] = 'APPROVED'

					edit = true

					amount = file[i][3]

				}

			}

			if (edit) {

				let output = []

				for (const i of file) { output.push(i.join(",")) }

				fs.writeFile(`${__dirname}/${__filename}`, output.join(os.EOL), (err) => {

					if (err) { reject() }

					console.log(amount)

					resolve(amount)

				})

			} else {

				reject()

			}

		})

	}).then((amount) => {

		new Promise((resolve, reject) => {//try updating budget [ADD whatever was requested back to total]

			let date_time = new Date()
			const timestamp = date_time.toISOString()

			let totalAmount = undefined
			let changeAmount = undefined
			let reason = 'APPROVED'

			if (amount) { changeAmount = -Number(amount) } else { reject() }

			fs.readFile(`${__dirname}/${__budgetFileName}`, 'utf8', (err, data) => {

				if (err) { reject() }

				const lines = data.trim().split(os.EOL)

				if (lines.length == 1) {

					totalAmount = changeAmount

				} else {

					totalAmount = String(Number(lines[lines.length - 1].split(",")[1]) + Number(changeAmount))

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

		}).then(() => {

			res.status(200).send(200)

		}, () => {//if budget update attempt fails

			res.status(400).send(400)

		})

	}, () => {

		// fs.copyFileSync(`${__dirname}/tmp.csv`, `${__dirname}/${__filename}`)

		res.status(400).send(400)

	})

})

//updates budget with specific amount (+ or -)
//query goes like this
// /updateBudget/+5000?reason=donation
// /updateBudget/-100000?reason=librarywidecoffeebreak
//amount param is mandatory and reason query is optional ('update budget' by default)
app.put('/updateBudget/:amount', auth, (req, res) => {

	new Promise((resolve, reject) => {

		let date_time = new Date()
		const timestamp = date_time.toISOString()

		let totalAmount = undefined
		let changeAmount = undefined
		let reason = 'update budget'

		if (req.params.amount) { changeAmount = req.params.amount } else { reject() }
		if (req.query.reason) { reason = req.query.reason }

		fs.readFile(`${__dirname}/${__budgetFileName}`, 'utf8', (err, data) => {

			if (err) { reject() }

			const lines = data.trim().split(os.EOL)

			if (lines.length == 1) {

				totalAmount = changeAmount

			} else {

				totalAmount = String(Number(lines[lines.length - 1].split(",")[1]) + Number(changeAmount))

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

	}).then(() => {

		res.status(200).send(200)

	}, () => {

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
		let reason = 'set budget'

		if (req.params.amount) { totalAmount = req.params.amount } else { reject() }
		if (req.query.reason) { reason = req.query.reason }

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

//Edits specific line
//query goes like
// /update/2025-10-29-04-55-30?email=nobody@brandeis.edu
// /update/2025-10-29-04-55-30?amount=1&OAstatus=approved
//timestamp param is mandatory other queries are optional
app.put('/update/:timestamp', auth, (req, res) => {

	new Promise((resolve, reject) => {

		// fs.copyFileSync(`${__dirname}/${__filename}`, `${__dirname}/tmp.csv`)

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

				// console.log(file[i])

				if (file[i][0] === timestamp) {

					edit = true

					let email = undefined
					let title = undefined
					let amount = undefined
					let author = undefined
					let authorORCiD = undefined
					let collab = undefined
					let collabORCiD = undefined
					let journal = undefined
					let journalISSN = undefined
					let publisher = undefined
					let status = undefined
					let type = undefined
					let DOI = undefined
					let comment = undefined
					let OAstatus = undefined

					if (req.query.email) { email = req.query.email } else { email = file[i][1] }
					if (req.query.title) { title = req.query.title } else { title = file[i][2] }
					if (req.query.amount) { amount = req.query.amount } else { amount = file[i][3] }
					if (req.query.author) { author = req.query.author } else { author = file[i][4] }
					if (req.query.authorORCiD) { authorORCiD = req.query.authorORCiD } else { authorORCiD = file[i][5] }
					if (req.query.collab) { collab = req.query.collab } else { collab = file[i][6] }
					if (req.query.collabORCiD) { collabORCiD = req.query.collabORCiD } else { collabORCiD = file[i][7] }
					if (req.query.journal) { journal = req.query.journal } else { journal = file[i][8] }
					if (req.query.journalISSN) { journalISSN = req.query.journalISSN } else { journalISSN = file[i][9] }
					if (req.query.publisher) { publisher = req.query.publisher } else { publisher = file[i][10] }
					if (req.query.status) { status = req.query.status } else { status = file[i][11] }
					if (req.query.type) { type = req.query.type } else { type = file[i][12] }
					if (req.query.DOI) { DOI = req.query.DOI } else { DOI = file[i][13] }
					if (req.query.comment) { comment = req.query.comment } else { comment = file[i][14] }
					if (req.query.OAstatus) { OAstatus = req.query.OAstatus } else { OAstatus = file[i][15] }

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

		// fs.copyFileSync(`${__dirname}/tmp.csv`, `${__dirname}/${__filename}`)

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

		let date_time = new Date()
		const timestamp = date_time.toISOString()

		let email = undefined			//author email
		let title = undefined			//title of article
		let amount = undefined			//amount requested from the fund
		let author = undefined			//name of the author
		let authorORCiD = undefined		//ORCiD of the author
		let collab = undefined			//name of the collaborating author(s) //THIS COULD BE A LIST OF PEOPLE
		let collabORCiD = undefined		//ORCiD of the collaborating author(s) //OPTIONAL
		let journal = undefined			//name of the journal the article was submitted to
		let journalISSN = undefined		//ISSN of the journal
		let publisher = undefined		//name of the publisher
		let status = undefined			//????
		let type = undefined			//publication type (research article, cover image, open access book, article commentary, review article, rapid communication, or OTHERS)
		let DOI = undefined				//DOI //OPTIONAL
		let comment = undefined			//comment to the library publishing team

		let OAstatus = "submitted"

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

		fs.appendFile(
			`${__dirname}/${__filename}`,
			input.join(",") + os.EOL,
			"utf8",
			(err) => {

				if (err) { reject(err) }

				resolve()

			}
		)

	}).then(() => {

		res.status(200).send(200)

	}, () => {

		res.status(400).send(400)

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

//TESTING PURPOSE ONLY
//Updating CSV
/*
app.get('/test', (req, res) => {

	new Promise((resolve, reject) => {

		let date_time = new Date()
		const timestamp = date_time.toISOString()

		fs.appendFile(
			`${__dirname}/empty.csv`,
			[
				timestamp,
				"1", "2", "3", "4", "5",
				"6", "7", "8", "9", "10",
				"11", "12", "13", "14", "15"
			].join(",") + os.EOL,
			"utf8",
			(err) => {

				if (err) { reject(err) }

				resolve()

			}
		)

	}).then(() => {

		res.status(200).send('asdf')

	}, () => {

		res.status(400).send('err')

	})

})
*/

app.listen(port, () => {

	console.log(`server is listening at http://localhost:${port}`)

})
