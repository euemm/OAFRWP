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
import axios from 'axios'

//Settings for web views
import path from 'path'

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views')) 

app.get('/', (req, res) => {

    res.render('index', {title: 'asdf', message: 'hello world'})

})

app.get('/success', (req, res) => {

    res.render('success', {title: 'success', message: 'hello world'})

})

app.get('/fail', (req, res) => {

    res.render('fail', {title: 'fail', message: 'fail'})

})

app.get('/requests', (req, res) => {

    res.render('requests', {title: 'requests', message: 'requests'})

})

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

//updates the status of request to CANCELLED
//this adds the budged requested back to the total budget
//query goes like this
// /cancel/2025-08-06T18:47:06.370Z
//timestamp param is mandatory
app.put('/cancel/:timestamp', (req, res) => {

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
    let OAstatus = "CACNELLED" 	//APPROVED, PAID, CANCELLED, TRANSACTION PLANNED

	new Promise((resolve, reject) => {

		fs.copyFileSync(`${__dirname}/${__filename}`, `${__dirname}/tmp.csv`)

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

			for (let i = 1; i < file.length; i ++) {

				if (file[i][0] === timestamp) {

					edit = true

					email = file[i][1]
					title = file[i][2]
                    amount = file[i][3]
                    author = file[i][4]
                    authorORCiD = file[i][5]
                    collab = file[i][6]
                    collabORCiD = file[i][7]
                    journal = file[i][8]
                    journalISSN = file[i][9]
                    publisher = file[i][10]
                    status = file[i][11]
                    type = file[i][12]
                    DOI = file[i][13]
                    comment = file[i][14]
					//OAstatus is already set as Cancelled

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

	}).then(() => {

		try {

			axios.put(`http://localhost:${port}/updateBudget/${amount}`) //Once updated, it sends query to itself for budget update.

			res.status(200).send(200)

		} catch (e) {

			fs.copyFileSync(`${__dirname}/tmp.csv`, `${__dirname}/${__filename}`)		

			res.status(400).send('e')

		}

	}, () => {

		fs.copyFileSync(`${__dirname}/tmp.csv`, `${__dirname}/${__filename}`)

		res.status(400).send(400)

	})

})

app.put('/planned/:timestamp', (req,res) => {

	new Promise(async (resolve, reject) => {
		
		let res = undefined
		
		try {
			
			res = await axios.put(`http://localhost:${port}/update/${req.params.timestamp}?OAstatus=TRANSACTIONS_PLANNED`)
		
		} catch (e) {

			reject(e)

		}

		if (res) {

			if (res.status == 200) {

				resolve()

			}

		}

		reject()

	}).then(() => {

		res.status(200).send(200)

	},() => {
		
		res.status(400).send(400)

	})

})

app.put('/paid/:timestamp', (req,res) => {

	new Promise(async (resolve, reject) => {
		
		let res = undefined
		
		try {
			
			res = await axios.put(`http://localhost:${port}/update/${req.params.timestamp}?OAstatus=PAID`)
		
		} catch (e) {

			reject(e)

		}

		if (res) {

			if (res.status == 200) {

				resolve()

			}

		}

		reject()

	}).then(() => {

		res.status(200).send(200)

	},() => {
		
		res.status(400).send(400)

	})

})


//Approves one specific line
//query goes like
// [PUT] /approve/2025-08-06T18:47:06.370Z
//timestamp param is mandatory
app.put('/approve/:timestamp', (req, res) => {

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
    let comment = undefined	        //comment to the library publishing team
    let OAstatus = 'APPROVED'       //ARPROVED, PAID, CANCELLED, TRANSACTIONS PLANNED

    new Promise((resolve, reject) => {

        fs.copyFileSync(`${__dirname}/${__filename}`, `${__dirname}/tmp.csv`)
    
        let timestamp = undefined
        if (req.params.timestamp) { 
            timestamp = req.params.timestamp 
            console.log(timestamp)
        } else { 
            console.log('asdfasdf')
            reject() 
        }

        fs.readFile(`${__dirname}/${__filename}`, 'utf8', (err, data) => {

            if (err) { 
                // console.log(err)
                reject() 
            }

            const lines = data.trim().split(os.EOL)

            if (lines.length == 1) {

                console.log('there is no request??')
                reject()

            }

            let file = []

            for (const i of lines) {
                file.push(i.split(","))
            }

            let edit = false

            for (let i = 1; i < file.length; i ++) {

                // console.log(file[i][0])

                if (file[i][0] == timestamp) {

                    edit = true

                    email = file[i][1]
                    title = file[i][2]
                    amount = file[i][3]
                    author = file[i][4]
                    authorORCiD = file[i][5]
                    collab = file[i][6]
                    collabORCiD = file[i][7]
                    journal = file[i][8]
                    journalISSN = file[i][9]
                    publisher = file[i][10]
                    status = file[i][11]
                    type = file[i][12]
                    DOI = file[i][13]
                    comment = file[i][14]

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

                if (err) { 
                    // console.log(err)
                    reject() 
                }

                resolve()

            }) } else {

                console.log('never edited')

                reject()

            }

        })

    }).then(() => {

        try {
        
            axios.put(`http://localhost:${port}/updateBudget/-${amount}`) //[NOTICE THE NEGATIVE SIGN] Once updated, its sends query to itself for budget update.
        
            res.status(200).send(200)

        } catch (error) {

			fs.copyFileSync(`${__dirname}/tmp.csv`, `${__dirname}/${__filename}`)

            // console.log(error)

            res.status(400).send(error)

        }

    }, () => {

        fs.copyFileSync(`${__dirname}/tmp.csv`,`${__dirname}/${__filename}`)

        res.status(400).send(400)

    })

})

//updates budget with specific amount (+ or -)
//query goes like this
// /updateBudget/+5000?reason=donation
// /updateBudget/-100000?reason=librarywidecoffeebreak
//amount param is mandatory and reason query is optional ('update budget' by default)
app.put('/updateBudget/:amount', (req, res) => {

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

                totalAmount = String(Number(lines[lines.length -1].split(",")[1]) + Number(changeAmount))

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
app.get('/setBudget/:amount', (req, res) => {

    new Promise((resolve, reject) => {

        let date_time = new Date()
        const timestamp = date_time.toISOString()
        
        let totalAmount = undefined
        let changeAmount = undefined
        let reason = 'set budget'
        
        if(req.params.amount) { totalAmount = req.params.amount } else { reject() }
        if(req.query.reason) { reason = req.query.reason }
        
        fs.readFile(`${__dirname}/${__budgetFileName}`, 'utf8', (err, data) => {

            if(err) { reject() }

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

                if(err) { reject() }

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

			for (let i = 1; i < file.length; i ++) {

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

	}, () => {	//ON REJECT

		fs.copyFileSync(`${__dirname}/tmp.csv`,`${__dirname}/${__filename}`)

		// console.log(err)

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

		if (req.query.email) { email = req.query.email.replace(",",".") }
		if (req.query.title) { title = req.query.title.replace(",",".") }
		if (req.query.amount) { amount = req.query.amount.replace(",",".") }
		if (req.query.author) { author = req.query.author.replace(",",".") }
		if (req.query.authorORCiD) { authorORCiD = String(req.query.authorORCiD).replace(",",".") }
		if (req.query.collab) { collab = req.query.collab.replace(",",".") }
		if (req.query.collabORCiD) { collabORCiD = String(req.query.collabORCiD).replace(",",".") }
		if (req.query.journal) { journal = req.query.journal.replace(",",".") }
		if (req.query.journalISSN) { journalISSN = String(req.query.journalISSN).replace(",",".") }
		if (req.query.publisher) { publisher = req.query.publisher.replace(",",".") }
		if (req.query.status) { status = req.query.status.replace(",",".") }
		if (req.query.type) { type = req.query.type.replace(",",".") }
		if (req.query.DOI) { DOI = String(req.query.DOI).replace(",",".") }
		if (req.query.comment) { comment = req.query.comment.replace(",",".") }

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

//Fetching records as JSON
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

//Fetching budget record as JSON
app.get('/fetchBudget', (req, res) => {

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

app.listen(port, () => {

	console.log(`server is listening at http://localhost:${port}`)

})
