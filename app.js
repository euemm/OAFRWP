//Settings for express server
import express from 'express'
const app = express()
const port = 3000

//Settings for csv file editing
import fs from 'fs'
import { parse } from 'csv-parse'
const __dirname = new URL(".", import.meta.url).pathname
import os from 'os'

//Create new line
//query goes like 
// /create?email=someone@brandeis.edu&title=HarryPotter&amount=9999&...
app.post('/create', (req, res) => {

    new Promise((resolve, reject) => {

        let date_time = new Date()
        
        const timestamp = date_time.getFullYear() + "-" + date_time.getMonth() + "-" + date_time.getDate() + "-" + date_time.getHours() + "-" + date_time.getMinutes()
        
        let email = undefined
        let title = undefined
        let amount = undefined
        let author = undefined
        let authorORCiD = undefined
        let collab = undefined      //THIS COULD BE A LIST OF PEOPLE
        let collabORCiD = undefined //OPTIONAL
        let journal = undefined
        let journalISSN = undefined
        let publisher = undefined
        let status = undefined
        let type = undefined
        let DOI = undefined //OPTIONAL
        let comment = undefined
        
        if (req.query.email) { email = req.query.email }
        if (req.query.title) { title = req.query.title }
        if (req.query.amount) { amount = req.query.amount }
        if (req.query.author) { author = req.query.author }
        if (req.query.authorORCiD) { authorORCiD = req.query.authorORCiD }
        if (req.query.collab) { collab = req.query.collab }
        if (req.query.collabORCiD) { collabORCiD = req.query.collabORCiD }
        if (req.query.journal) { journalISSN = req.query.journalISSN }
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
            comment
        ]

        fs.appendFile(
            `${__dirname}/empty.csv`,
            input.join(",") + os.EOL,
            "utf8",
            (err) => {
                
                if (err) { reject(err) }

                resolve()

            }
        )

    }).then(() => {

        res.status(200).send('asdf')

    },() => {

        res.status(400).send('err')

    })

})

//Updating CSV
//TESTING PURPOSE ONLY
app.get('/update', (req, res) => {

    new Promise((resolve, reject) => {

        fs.appendFile(
            `${__dirname}/empty.csv`,
            [
                "1", "2", "3", "4", "5",
                "6", "7", "8", "9", "10",
                "11", "12", "13", "14", "15"
            ].join(",") + os.EOL,
            "utf8",
            (err) => {

                if(err) { reject(err) }

                resolve()

            }
        )

    }).then(() => {

        res.status(200).send('asdf')

    },() => {

        res.status(400).send('err')

    })

})

//Fetching CSV as JSON
//TESTING PURPOSE ONLY
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

app.listen(port, () => {

    console.log(`server is listening at http://localhost:${port}`)

})