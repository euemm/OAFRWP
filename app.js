//Settings for express server
import express from 'express'
const app = express()
const port = 3000

//Settings for csv file editing
import fs from 'fs'
import { parse } from 'csv-parse'
const __dirname = new URL(".", import.meta.url).pathname
const __filename = 'empty.csv'
import os from 'os'

//Edits specific line
//query goes like
// /update/2025-10-29-04-55-30?email=nobody@brandeis.edu
// /update/2025-10-29-04-55-30?amount=1&OAstatus=approved
//timestamp param is mandatory other queries are optional
app.put('/update/:timestamp', (req, res) => {

	new Promise((resolve, reject) => {
		
		fs.copyFileSync(`${__dirname}/${__filename}`, `${__dirname}/tmp.csv`)
		
		let timestamp = undefined
		
		if (req.params.timestamp) { timestamp = req.params.timestamp } else { reject() }
		
		fs.readFile(`${__dirname}/${__filename}`,'utf8', (err, data) => {

			if (err) { reject('asdf') }

			let lines = data.split(os.EOL)
			let file = [] 

			for (const i of lines) {
				file.push(i.split(","))
			}

			let edit = false

			for (let i = 0; i < file.length; i ++) {

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

		res.status(200).send('asdf')

	}, (err) => {	//ON REJECT

		fs.copyFileSync(`${__dirname}/tmp.csv`,`${__dirname}/${__filename}`)

		console.log(err)

		res.status(400).send('err')

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

		const timestamp = date_time.getFullYear() + "-" + date_time.getMonth() + "-" + date_time.getDate() + "-" + date_time.getHours() + "-" + date_time.getMinutes() + "-" + date_time.getSeconds()

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

		if (req.query.email) { email = req.query.email }
		if (req.query.title) { title = req.query.title }
		if (req.query.amount) { amount = req.query.amount }
		if (req.query.author) { author = req.query.author }
		if (req.query.authorORCiD) { authorORCiD = req.query.authorORCiD }
		if (req.query.collab) { collab = req.query.collab }
		if (req.query.collabORCiD) { collabORCiD = req.query.collabORCiD }
		if (req.query.journal) { journal = req.query.journal }
		if (req.query.journalISSN) { journalISSN = req.query.journalISSN }
		if (req.query.publisher) { publisher = req.query.publisher }
		if (req.query.status) { status = req.query.status }
		if (req.query.type) { type = req.query.type }
		if (req.query.DOI) { DOI = req.query.DOI }
		if (req.query.comment) { comment = req.query.comment }

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

		res.status(200).send('asdf')

	}, () => {

		res.status(400).send('err')

	})

})

//Fetching CSV as JSON
app.get('/fetch', (req, res) => {

	new Promise((resolve, reject) => {

		fs.readFile(`${__dirname}/empty.csv`, (err, data) => {

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

//TESTING PURPOSE ONLY
//Updating CSV
app.get('/test', (req, res) => {

	new Promise((resolve, reject) => {

		fs.appendFile(
			`${__dirname}/empty.csv`,
			[
				"0", 
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

app.listen(port, () => {

	console.log(`server is listening at http://localhost:${port}`)

})
