import express from 'express'
import cors from 'cors'
import 'dotenv/config' 
import autocompleteRouter from './routes/autocompleteRoute.js'

//Initialize Express
const app = express()

// Middlewares
app.use(cors())

//Connect to database


// Routes
app.get('/', (req, res)=> res.send("API Working"))
app.use('/api/autocomplete', express.json(), autocompleteRouter)

export default app

// Local development
const PORT = process.env.PORT || 5000
app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`)
})
