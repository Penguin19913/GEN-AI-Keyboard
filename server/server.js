import express from 'express'
import 'dotenv/config' 
import autocompleteRouter from './routes/autocompleteRoute.js'

//Initialize Express
const app = express()

//Connect to database


// Routes
app.get('/', (req, res)=> res.send("API Working"))
app.use('/api/autocomplete', express.json(), autocompleteRouter)

// Port
const PORT =  5000

app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`)
})
